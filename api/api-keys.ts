/**
 * Vercel Edge Function — Administración de llaves de la API pública.
 *
 * OJO: este endpoint NO es parte de la API pública. Es el panel de control que
 * usa Configuración → API y Desarrolladores, y se autentica con la sesión de la
 * dueña de la agencia (JWT de Supabase), no con una API key.
 *
 * POR QUÉ ES BACKEND Y NO UNA ESCRITURA DIRECTA DESDE REACT
 * Generar la llave y guardar SOLO su hash tiene que pasar en un sitio donde el
 * usuario no pueda intervenir. Si el frontend insertara la fila, podría mandar
 * el hash que se le antojara — por ejemplo el de una llave que ya conoce — y la
 * autenticación dejaría de significar nada. Por eso la migración 032 no tiene
 * policy de INSERT: esta ruta es el único camino.
 *
 *   GET    /api/api-keys              → lista las llaves de tu agencia
 *   POST   /api/api-keys              → crea una (devuelve el secreto UNA vez)
 *   PATCH  /api/api-keys?id=<uuid>    → revoca (activa = false)
 */

import { createClient } from '@supabase/supabase-js';
import { generarKey, hashKey, SCOPES_VALIDOS } from './v1/_lib/keys';

export const config = { runtime: 'edge' };

/**
 * Sin `Access-Control-Allow-Origin: *`, a diferencia de los endpoints viejos
 * de este repo. Esto administra credenciales: que cualquier página de internet
 * pueda llamarlo desde el navegador de quien esté logueada es justo lo que no
 * queremos. Se llama desde la propia app, mismo origen.
 */
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/** Duraciones ofrecidas en la UI. `null` = no expira. */
const EXPIRACIONES: Record<string, number | null> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  nunca: null,
};

const RATE_LIMITS = [60, 100, 300];

/**
 * Cliente con service key. Se envuelve en una función para poder derivar su
 * tipo (`Admin`) sin escribir a mano los genéricos de supabase-js, que cambian
 * entre versiones.
 */
function crearAdmin(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
type Admin = ReturnType<typeof crearAdmin>;

export default async function handler(req: Request): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ error: 'Falta configuración del servidor.' }, 500);
  }

  // ── 1. Autenticar a quien llama ────────────────────────────────────────────
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autorizado.' }, 401);

  const admin = crearAdmin(url, serviceKey);

  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) return json({ error: 'Sesión inválida.' }, 401);
  const callerId = callerData.user.id;

  // ── 2. Autorizar: solo la DUEÑA de una agencia administra sus llaves ───────
  // La agencia se deduce del usuario, nunca se acepta del request. Si viniera
  // en el body, cualquiera podría pedir llaves de la agencia de otra persona.
  const { data: agencia } = await admin
    .from('agencies')
    .select('id')
    .eq('owner_id', callerId)
    .maybeSingle();

  if (!agencia) {
    return json({ error: 'Solo la dueña de la agencia puede administrar las API keys.' }, 403);
  }
  const agenciaId = agencia.id as string;

  // ── 3. Rutas ───────────────────────────────────────────────────────────────
  if (req.method === 'GET') return listar(admin, agenciaId);
  if (req.method === 'POST') return crear(req, admin, agenciaId, callerId);
  if (req.method === 'PATCH') return revocar(req, admin, agenciaId);
  return json({ error: 'Método no permitido.' }, 405);
}

/**
 * Lista las llaves. `key_hash` NO va en el select: aunque un hash no sea
 * usable para autenticar, no hay razón para que salga del servidor.
 */
async function listar(admin: Admin, agenciaId: string) {
  const { data, error } = await admin
    .from('api_keys')
    .select('id, nombre, key_prefix, scopes, rate_limit, activa, ultimo_uso, expira_en, created_at')
    .eq('agencia_id', agenciaId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api-keys] listar', error);
    return json({ error: 'No se pudieron cargar las llaves.' }, 500);
  }
  return json({ keys: data ?? [] });
}

async function crear(
  req: Request,
  admin: Admin,
  agenciaId: string,
  callerId: string,
) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Body inválido.' }, 400);
  }

  const nombre = String(body.nombre ?? '').trim().slice(0, 80);
  if (!nombre) return json({ error: 'Ponle un nombre a la aplicación.' }, 400);

  // Los scopes se filtran contra la whitelist, no se aceptan tal cual. Un scope
  // inventado moriría igual en el CHECK de la base, pero con un 500 feo en vez
  // de un mensaje entendible.
  const scopes = Array.isArray(body.scopes)
    ? [...new Set(body.scopes.map(String))].filter((s) =>
        (SCOPES_VALIDOS as readonly string[]).includes(s),
      )
    : [];
  if (scopes.length === 0) {
    return json({ error: 'Elige al menos un permiso.' }, 400);
  }

  const rateLimit = RATE_LIMITS.includes(Number(body.rateLimit)) ? Number(body.rateLimit) : 100;

  const expClave = String(body.expiracion ?? '90d');
  if (!(expClave in EXPIRACIONES)) return json({ error: 'Expiración inválida.' }, 400);
  const dias = EXPIRACIONES[expClave];
  const expiraEn = dias === null ? null : new Date(Date.now() + dias * 86_400_000).toISOString();

  // ── Generar y guardar SOLO el hash ───────────────────────────────────────
  const { key, prefix } = generarKey();
  const key_hash = await hashKey(key);

  const { data, error } = await admin
    .from('api_keys')
    .insert({
      nombre,
      key_hash,
      key_prefix: prefix,
      agencia_id: agenciaId,
      scopes,
      rate_limit: rateLimit,
      expira_en: expiraEn,
      created_by: callerId,
    })
    .select('id, nombre, key_prefix, scopes, rate_limit, activa, ultimo_uso, expira_en, created_at')
    .single();

  if (error) {
    console.error('[api-keys] crear', error);
    return json({ error: 'No se pudo crear la llave.' }, 500);
  }

  // Única vez en toda la vida de la llave que el secreto sale de aquí.
  return json({ key, registro: data }, 201);
}

/**
 * Revoca. No borra: la fila se conserva para que el audit log siga teniendo a
 * quién apuntar. `activa = false` corta el acceso en la siguiente llamada.
 */
async function revocar(
  req: Request,
  admin: Admin,
  agenciaId: string,
) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Llave inválida.' }, 400);

  // El `.eq('agencia_id', …)` es el aislamiento: sin él, conociendo un uuid
  // ajeno se podría revocar la llave de otra agencia.
  const { data, error } = await admin
    .from('api_keys')
    .update({ activa: false })
    .eq('id', id)
    .eq('agencia_id', agenciaId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[api-keys] revocar', error);
    return json({ error: 'No se pudo revocar.' }, 500);
  }
  if (!data) return json({ error: 'Llave no encontrada.' }, 404);
  return json({ ok: true });
}
