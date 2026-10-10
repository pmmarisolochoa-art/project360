/**
 * Vercel Edge Function — Campañas reales de Meta Ads, una por una, con su
 * insight del rango pedido. Endpoint aparte de `metricas.ts` (que es el
 * agregado de toda la cuenta) porque pedir insights POR campaña es una
 * llamada distinta a Graph API, con su propio costo y forma de respuesta.
 *
 * Requiere en Vercel: META_SYSTEM_USER_TOKEN, SUPABASE_SERVICE_ROLE_KEY,
 * VITE_SUPABASE_URL (mismas que metricas.ts).
 */

import { createClient } from '@supabase/supabase-js';
import { callerCanAccessClient } from './_lib/clientAccess';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const GRAPH_VERSION = 'v21.0';

interface CampaignMeta {
  id: string;
  name: string;
  effective_status: string;
  insights?: { data?: Array<Record<string, unknown>> };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Método no permitido.' }, 405);

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const metaToken = process.env.META_SYSTEM_USER_TOKEN;
  if (!supaUrl || !serviceKey) return json({ error: 'Falta config Supabase.' }, 500);
  if (!metaToken) return json({ error: 'Falta META_SYSTEM_USER_TOKEN. Configúralo en Vercel.' }, 503);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autorizado.' }, 401);

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json({ error: 'Sesión inválida.' }, 401);

  const params = new URL(req.url).searchParams;
  const clientId = params.get('clientId')?.trim() || '';
  if (!clientId) return json({ error: 'Falta clientId.' }, 400);

  const { data: cliente, error: clienteErr } = await admin
    .from('clients').select('id, name, meta_ad_account_id').eq('id', clientId).maybeSingle();
  if (clienteErr || !cliente) return json({ error: 'Cliente no encontrado.' }, 404);
  if (!cliente.meta_ad_account_id) {
    return json({ error: `${cliente.name} no tiene una cuenta de Meta conectada.` }, 422);
  }

  // ¿El usuario puede ver ESTE cliente? (dueño de su agencia, dirección de
  // esa agencia, o miembro de equipo asignado a él) — mismo chequeo que
  // metricas.ts, ambos endpoints comparten el helper.
  const autorizado = await callerCanAccessClient(admin, caller.user.id, clientId);
  if (!autorizado) return json({ error: 'No tienes acceso a este cliente.' }, 403);

  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const rangoLibre = !!desde && !!hasta && /^\d{4}-\d{2}-\d{2}$/.test(desde) && /^\d{4}-\d{2}-\d{2}$/.test(hasta);
  const diasParam = Number(params.get('dias'));
  const dias = [7, 14, 30].includes(diasParam) ? diasParam : 30;
  const datePreset = dias === 7 ? 'last_7d' : dias === 14 ? 'last_14d' : 'last_30d';
  // Sintaxis de campo ANIDADO de Graph API: paréntesis, no "clave=valor" como
  // en el endpoint top-level de metricas.ts — son dos sintaxis distintas,
  // probada contra la API real antes de integrarla (las dos formas).
  const tiempoAnidado = rangoLibre
    ? `time_range(${JSON.stringify({ since: desde, until: hasta })})`
    : `date_preset(${datePreset})`;

  // `effective_status` incluye ACTIVE/PAUSED/ARCHIVED/etc — "activa" de verdad,
  // no un texto fijo como tenía la versión simulada. Insights anidados: una
  // sola llamada en vez de N+1 (una por campaña).
  const insightsFields = 'spend,ctr,cpc,actions';
  const fieldsParam = `id,name,effective_status,insights.${tiempoAnidado}{${insightsFields}}`;
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${cliente.meta_ad_account_id}/campaigns`);
  url.searchParams.set('fields', fieldsParam);
  url.searchParams.set('limit', '100');
  url.searchParams.set('access_token', metaToken);

  let payload: { data?: CampaignMeta[]; error?: { message?: string; code?: number } };
  try {
    const r = await fetch(url);
    payload = await r.json();
    if (!r.ok || payload.error) {
      const msg = payload.error?.message || `Meta respondió ${r.status}.`;
      if (payload.error?.code === 190) return json({ error: `El token de Meta está vencido o revocado: ${msg}` }, 502);
      return json({ error: `Meta: ${msg}` }, 502);
    }
  } catch (e) {
    return json({ error: `No se pudo hablar con Meta: ${(e as Error).message}` }, 502);
  }

  const campanas = (payload.data ?? []).map((c) => {
    const ins = c.insights?.data?.[0];
    const spend = Number(ins?.spend ?? 0);
    const acciones = Array.isArray(ins?.actions) ? (ins!.actions as Array<{ action_type?: string; value?: string }>) : [];
    const leads = Number(acciones.find((a) => a.action_type === 'lead')?.value ?? 0);
    return {
      id: c.id,
      nombre: c.name,
      // ACTIVE / PAUSED / ARCHIVED / DELETED / … tal cual lo da Meta.
      estado: c.effective_status,
      spend,
      ctr: Number(ins?.ctr ?? 0),
      cpc: Number(ins?.cpc ?? 0),
      leads,
      cpl: leads > 0 ? spend / leads : 0,
    };
  });

  return json({ cliente: cliente.name, total: campanas.length, campanas });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}
