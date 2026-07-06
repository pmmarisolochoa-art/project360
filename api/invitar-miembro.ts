/**
 * Vercel Edge Function — Invitar a un miembro (crea su login + acceso).
 *
 * Crear un usuario de Auth requiere la SERVICE ROLE KEY, que jamás puede vivir
 * en el navegador. Por eso esto es backend: la llave vive solo aquí
 * (SUPABASE_SERVICE_ROLE_KEY en Vercel).
 *
 * Seguridad:
 *   1. Verifica el token del que invita (debe ser un usuario válido).
 *   2. Confirma que ES EL OWNER de la agencia dueña del cliente. Si no, 403.
 *   3. Recién ahí crea el login + las filas (users + team_members).
 * Si algún paso falla, revierte el usuario de Auth para no dejar basura.
 */

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ALLOWED_DEPTS = ['pm', 'finanzas', 'content'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ error: 'Falta configuración del servidor (SUPABASE_SERVICE_ROLE_KEY en Vercel).' }, 500);
  }

  // ── 1. Autenticar al que invita ──────────────────────────────────────────
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autorizado.' }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) return json({ error: 'Sesión inválida.' }, 401);
  const callerId = callerData.user.id;

  // ── 2. Leer y validar el body ─────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Body inválido.' }, 400);
  }

  const clientId = String(body.clientId ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const nombre = String(body.nombre ?? '').trim();
  const rol = String(body.rol ?? '').trim();
  const accessLevel = body.accessLevel === 'viewer' ? 'viewer' : 'editor';
  const password = String(body.password ?? '');
  const avatarColor = String(body.avatarColor ?? '#6366F1');
  const departamentos = Array.isArray(body.departamentos)
    ? (body.departamentos as unknown[]).filter((d) => ALLOWED_DEPTS.includes(d as string))
    : [];
  const funciones = Array.isArray(body.funciones)
    ? (body.funciones as unknown[]).slice(0, 40).map((f) => String(f))
    : [];

  if (!clientId || !email || !nombre || !rol) {
    return json({ error: 'Faltan datos: cliente, correo, nombre o rol.' }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Correo inválido.' }, 400);
  if (password.length < 8) return json({ error: 'La contraseña temporal debe tener al menos 8 caracteres.' }, 400);

  // ── 3. Autorizar: el que invita debe ser OWNER de la agencia del cliente ──
  const { data: cli, error: cliErr } = await admin
    .from('clients')
    .select('agency_id')
    .eq('id', clientId)
    .maybeSingle();
  if (cliErr || !cli) return json({ error: 'Cliente no encontrado.' }, 404);

  const { data: agency } = await admin
    .from('agencies')
    .select('id')
    .eq('id', cli.agency_id as string)
    .eq('owner_id', callerId)
    .maybeSingle();
  if (!agency) return json({ error: 'No tienes permiso para invitar en este cliente.' }, 403);

  // ── 4. Crear el login (usuario de Auth) ───────────────────────────────────
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: nombre },
  });
  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return json({ error: 'Ese correo ya tiene un login. Usa otro correo o gestiónalo en Supabase.' }, 409);
    }
    return json({ error: `No se pudo crear el login: ${createErr?.message ?? 'desconocido'}` }, 500);
  }
  const userId = created.user.id;

  // ── 5. Fila gemela en public.users (role 'team' = miembro de agencia) ─────
  const { error: userErr } = await admin
    .from('users')
    .upsert({ id: userId, email, name: nombre, role: 'team' }, { onConflict: 'id' });
  if (userErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return json({ error: `No se pudo crear el perfil: ${userErr.message}` }, 500);
  }

  // ── 6. Fila en team_members (identidad + acceso: departamentos + nivel) ───
  const { data: tm, error: tmErr } = await admin
    .from('team_members')
    .insert({
      client_id: clientId,
      nombre,
      rol,
      email,
      avatar_color: avatarColor,
      funciones,
      access_level: accessLevel,
      departamentos,
      user_id: userId,
    })
    .select('id')
    .single();
  if (tmErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return json({ error: `No se pudo crear el miembro: ${tmErr.message}` }, 500);
  }

  return json({ ok: true, memberId: tm.id, userId, email });
}
