/**
 * Webhook de Meta Lead Ads (formularios instantáneos) — genérico, para
 * CUALQUIER cliente.
 *
 * Meta nunca manda el `client_id`: manda un `page_id` y un `leadgen_id`.
 * Este archivo no sabe qué cliente es cuál — eso vive en la tabla
 * `meta_lead_pages` (migración 051). Dar de alta un cliente nuevo en esta
 * integración es una fila en esa tabla, no una línea de código aquí.
 *
 * FLUJO:
 *   1. Meta hace GET una vez para verificar la URL (handshake de suscripción).
 *   2. Cuando alguien llena un formulario, Meta hace POST con `leadgen_id` —
 *      NUNCA con las respuestas. Hay que pedirlas aparte a la Graph API con
 *      el Page Access Token de esa página.
 *   3. El lead entra por `api_lead_crear` (la misma función que usa
 *      `/api/v1/leads`), idempotente por `leadgen_id` como `external_id`.
 *
 * SEGURIDAD:
 *   - GET: exige que `hub.verify_token` coincida con `META_WEBHOOK_VERIFY_TOKEN`.
 *   - POST: exige la firma `X-Hub-Signature-256` de Meta, HMAC-SHA256 del
 *     cuerpo crudo con `META_APP_SECRET`. Sin firma válida, no se procesa
 *     nada — cualquiera en internet podría inventar leads falsos si no.
 *   - El Page Access Token vive SOLO en `meta_lead_pages`, sin policies RLS:
 *     ni siquiera la dueña lo ve desde la app hoy. Se administra por SQL.
 *
 * ESTADO (30-sep-2026): escrito y listo para conectar, SIN una página real
 * probándolo todavía — Meta exige el permiso `leads_retrieval`, que para
 * páginas ajenas a la propia cuenta de desarrollador pide revisión de la
 * app (puede tardar semanas). Antes de activarlo para un cliente hace falta:
 *   1. Una app de Meta con el producto "Webhooks" + permiso leads_retrieval.
 *   2. Suscribir esta URL en esa app, con META_WEBHOOK_VERIFY_TOKEN.
 *   3. Un Page Access Token de larga duración de la página del cliente.
 *   4. Insertar la fila en `meta_lead_pages` (page_id, client_id, token).
 *
 * Requiere en Vercel: META_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET,
 *   SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL.
 */

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const GRAPH_API_VERSION = 'v21.0';

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') return manejarVerificacion(req);
  if (req.method === 'POST') return manejarEvento(req);
  return texto('Solo GET (verificación) y POST (eventos).', 405);
}

// ── GET: handshake de suscripción de Meta ──────────────────────────────────
function manejarVerificacion(req: Request): Response {
  const url = new URL(req.url);
  const modo = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const esperado = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!esperado) return texto('Webhook sin configurar (falta META_WEBHOOK_VERIFY_TOKEN).', 503);

  if (modo === 'subscribe' && token && igualSeguro(token, esperado) && challenge) {
    // Meta espera EXACTAMENTE el challenge de vuelta, como texto plano.
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return texto('Token de verificación inválido.', 403);
}

// ── POST: evento real de leadgen ────────────────────────────────────────────
async function manejarEvento(req: Request): Promise<Response> {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return texto('Webhook sin configurar (falta META_APP_SECRET).', 503);

  const crudo = await req.text();
  const firma = req.headers.get('x-hub-signature-256') ?? '';
  const valida = await firmaValida(crudo, appSecret, firma);
  if (!valida) return texto('Firma inválida.', 401);

  let cuerpo: MetaWebhookBody;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return texto('JSON inválido.', 400);
  }

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return texto('Falta configuración de Supabase.', 500);
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const eventos = (cuerpo.entry ?? []).flatMap((e) =>
    (e.changes ?? []).filter((c) => c.field === 'leadgen').map((c) => ({ pageId: e.id, ...c.value })),
  );

  // Se procesa cada lead por separado: uno que falle (página no mapeada,
  // Graph API caída) no debe tumbar a los demás que sí vinieron en el mismo
  // POST. Y se responde 200 SIEMPRE que la firma fue válida — si no, Meta
  // reintenta el webhook entero indefinidamente, y como es idempotente por
  // leadgen_id, un reintento no duplica nada.
  for (const ev of eventos) {
    try {
      await procesarLead(admin, ev.pageId, ev.leadgen_id);
    } catch (e) {
      console.error('[meta-leads] no se pudo procesar un lead', ev.leadgen_id, e);
    }
  }

  return texto('OK', 200);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function procesarLead(admin: any, pageId: string, leadgenId: string): Promise<void> {
  const { data: pagina } = await admin
    .from('meta_lead_pages')
    .select('client_id, page_access_token, activo')
    .eq('page_id', pageId)
    .maybeSingle();

  if (!pagina || !pagina.activo) {
    console.warn('[meta-leads] página sin mapear o inactiva, se ignora', pageId);
    return;
  }

  const { data: cliente } = await admin.from('clients').select('agency_id').eq('id', pagina.client_id).maybeSingle();
  if (!cliente) {
    console.error('[meta-leads] client_id en meta_lead_pages ya no existe', pagina.client_id);
    return;
  }

  const detalle = await obtenerLeadDeGraphAPI(leadgenId, pagina.page_access_token as string);
  if (!detalle) return;

  const { error } = await admin.rpc('api_lead_crear', {
    p_agencia: cliente.agency_id,
    p_client_id: pagina.client_id,
    p_nombre: detalle.nombre,
    p_telefono: detalle.telefono ?? null,
    p_email: detalle.email ?? null,
    p_fuente: 'meta_ads',
    p_external_id: leadgenId,
  });
  if (error) console.error('[meta-leads] api_lead_crear falló', leadgenId, error);
}

interface DetalleLead {
  nombre: string;
  telefono?: string;
  email?: string;
}

/**
 * Meta no manda un esquema fijo de campos — cada formulario define los suyos.
 * Se buscan los nombres más comunes; lo que no se reconoce se ignora (no se
 * inventa un valor). Si no hay ningún nombre reconocible, se usa el email o
 * el teléfono como identificador — un lead sin ningún dato de contacto no se
 * puede trabajar, así que se descarta y se loguea en vez de crear una fila
 * vacía.
 */
async function obtenerLeadDeGraphAPI(leadgenId: string, pageAccessToken: string): Promise<DetalleLead | null> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}?access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[meta-leads] Graph API respondió', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = (await res.json()) as { field_data?: Array<{ name: string; values: string[] }> };
  const campos = new Map((data.field_data ?? []).map((f) => [f.name.toLowerCase(), f.values?.[0] ?? '']));

  const nombre =
    campos.get('full_name') ||
    [campos.get('first_name'), campos.get('last_name')].filter(Boolean).join(' ').trim() ||
    campos.get('email') ||
    campos.get('phone_number') ||
    '';

  if (!nombre) {
    console.warn('[meta-leads] lead sin ningún dato de contacto reconocible, se descarta', leadgenId);
    return null;
  }

  return {
    nombre,
    telefono: campos.get('phone_number') || undefined,
    email: campos.get('email') || undefined,
  };
}

interface MetaWebhookBody {
  object?: string;
  entry?: Array<{
    id: string; // page_id
    changes?: Array<{ field: string; value: { leadgen_id: string; page_id?: string; form_id?: string; created_time?: number } }>;
  }>;
}

async function firmaValida(cuerpoCrudo: string, secreto: string, cabecera: string): Promise<boolean> {
  const esperada = cabecera.replace(/^sha256=/, '');
  if (!esperada) return false;

  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(cuerpoCrudo));
  const calculada = Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return igualSeguro(calculada, esperada);
}

/** Comparación en tiempo constante — mismo motivo que en el webhook de Paralelo. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function texto(mensaje: string, status: number): Response {
  return new Response(mensaje, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
