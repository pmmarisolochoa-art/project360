/**
 * Vercel Edge Function — Métricas reales de Meta Ads (Graph API Marketing).
 *
 * El token del Usuario del Sistema de Meta ve TODAS las cuentas publicitarias
 * que se le asignaron (de cualquier cliente). Se queda aquí, en
 * `META_SYSTEM_USER_TOKEN`; el navegador solo ve el resultado de UN cliente a
 * la vez, y solo si ese cliente pertenece a la agencia de quien pregunta.
 *
 * Requiere en Vercel: META_SYSTEM_USER_TOKEN, SUPABASE_SERVICE_ROLE_KEY,
 * VITE_SUPABASE_URL.
 */

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const GRAPH_VERSION = 'v21.0';

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Método no permitido.' }, 405);

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const metaToken = process.env.META_SYSTEM_USER_TOKEN;

  if (!supaUrl || !serviceKey) return json({ error: 'Falta config Supabase.' }, 500);
  if (!metaToken) return json({ error: 'Falta META_SYSTEM_USER_TOKEN. Configúralo en Vercel.' }, 503);

  // ── 1. Autenticar: sesión válida de Project360 ─────────────────────────────
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autorizado.' }, 401);

  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json({ error: 'Sesión inválida.' }, 401);

  // ── 2. Qué cliente se pide — y que su cuenta esté REALMENTE declarada ──────
  const clientId = new URL(req.url).searchParams.get('clientId')?.trim() || '';
  if (!clientId) return json({ error: 'Falta clientId.' }, 400);

  const { data: cliente, error: clienteErr } = await admin
    .from('clients')
    .select('id, name, meta_ad_account_id')
    .eq('id', clientId)
    .maybeSingle();
  if (clienteErr || !cliente) return json({ error: 'Cliente no encontrado.' }, 404);
  if (!cliente.meta_ad_account_id) {
    return json({ error: `${cliente.name} no tiene una cuenta de Meta conectada (meta_ad_account_id vacío).` }, 422);
  }

  // ── 3. Traer insights de Meta ────────────────────────────────────────────
  const datePreset = new URL(req.url).searchParams.get('rango') === '7d' ? 'last_7d' : 'last_30d';
  const fields = 'spend,impressions,clicks,ctr,cpc,actions';
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cliente.meta_ad_account_id}/insights` +
    `?fields=${fields}&date_preset=${datePreset}&access_token=${encodeURIComponent(metaToken)}`;

  let payload: { data?: unknown[]; error?: { message?: string; code?: number } };
  try {
    const r = await fetch(url);
    payload = await r.json();
    if (!r.ok || payload.error) {
      const msg = payload.error?.message || `Meta respondió ${r.status}.`;
      // 190 = token vencido/revocado. Se dice tal cual, no es un fallo nuestro.
      if (payload.error?.code === 190) {
        return json({ error: `El token de Meta está vencido o revocado: ${msg}` }, 502);
      }
      return json({ error: `Meta: ${msg}` }, 502);
    }
  } catch (e) {
    return json({ error: `No se pudo hablar con Meta: ${(e as Error).message}` }, 502);
  }

  const fila = Array.isArray(payload.data) && payload.data.length > 0
    ? (payload.data[0] as Record<string, unknown>)
    : null;

  if (!fila) {
    return json({ cliente: cliente.name, sinDatos: true, spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, leads: 0 });
  }

  const acciones = Array.isArray(fila.actions) ? (fila.actions as Array<{ action_type?: string; value?: string }>) : [];
  const leads = acciones.find((a) => a.action_type === 'lead')?.value;

  return json({
    cliente: cliente.name,
    sinDatos: false,
    spend: Number(fila.spend ?? 0),
    impressions: Number(fila.impressions ?? 0),
    clicks: Number(fila.clicks ?? 0),
    ctr: Number(fila.ctr ?? 0),
    cpc: Number(fila.cpc ?? 0),
    leads: leads ? Number(leads) : 0,
    rango: datePreset,
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
