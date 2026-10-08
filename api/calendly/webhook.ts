/**
 * Webhook de Calendly — cuando un lead agenda una llamada, crea (o enlaza) el
 * `Meeting` con el link de la reunión y avanza al lead a "Cita agendada".
 *
 * SOLO procesa `invitee.created` (v1). `invitee.canceled` es un gap conocido
 * y aceptado a propósito (founder, 08-oct-2026): una cancelación/reprograma-
 * ción no se refleja sola todavía — se corrige a mano. Ver `SOP_Calendly.md`.
 *
 * Runtime EDGE a propósito, y es correcto aquí (a diferencia de Fathom, que
 * tuvo que salir de edge): esto es UNA invocación por reserva, con UN GET a
 * la API de Calendly + unos inserts a Supabase — nada de recorrer una cuenta
 * entera ni de IA. Si alguna vez se ve lento cerca del tope de 25s para
 * empezar a responder (límite fijo de Edge, no negociable con menos
 * trabajo), migrar a función Node siguiendo EXACTAMENTE lo ya aprendido con
 * Fathom: exportar con el nombre `fetch` (no `export default`, que en Node
 * usa la firma vieja `(req,res)`), imports a `src/` con extensión `.js`
 * explícita (el bundler de Node no empaqueta como un solo archivo), y
 * `maxDuration` en `vercel.json`.
 *
 * FLUJO (ver `SOP_Calendly.md` para el detalle operativo completo):
 *   1. Calendly dispara `invitee.created` con un payload "delgado" (identidad
 *      del invitee, no trae hora/link/host).
 *   2. Se verifica la firma `Calendly-Webhook-Signature` (HMAC-SHA256,
 *      formato Stripe-like `t=<ts>,v1=<hex>`, con anti-replay de 180s).
 *   3. Se pide el detalle real a `GET /scheduled_events/{uuid}` con el
 *      Personal Access Token — de ahí sale la hora, el link de la llamada y
 *      el host (closer).
 *   4. Se resuelve o crea el lead (por email/teléfono normalizado, dentro
 *      del cliente), se resuelve el closer por email contra `team_members`,
 *      y se crea el `Meeting` enlazado.
 *
 * Nada se adivina: cliente no habilitado → se ignora; closer sin email
 * cargado → la reunión se crea igual, sin participante asignado (visible,
 * corregible a mano); lead no encontrado → se crea uno nuevo (fuente 'otro' —
 * Calendly es DÓNDE se agenda, no de dónde vino el lead).
 *
 * Requiere en Vercel: CALENDLY_SIGNING_KEY, CALENDLY_PERSONAL_ACCESS_TOKEN,
 *   SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL.
 */

import { createClient } from '@supabase/supabase-js';
import { CALENDLY_CLIENTES, externalIdInviteeCalendly } from '../../src/config/calendly';
import { normalizar, normalizarTelefono } from '../../src/utils/csvLeads';
import type { LeadStage } from '../../src/types/lead';

export const config = { runtime: 'edge' };

const REPLAY_MAX_SEGUNDOS = 180;
// Una vez agendada, solo subir la etapa si el lead sigue en un punto
// temprano del embudo — si ya avanzó más (propuesta, ganado...), agendar de
// nuevo no debe retroceder su etapa.
const ETAPAS_QUE_SUBEN_A_CITA_AGENDADA: LeadStage[] = ['nuevo', 'contactado', 'calificado'];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') return texto('OK', 200);
  if (req.method !== 'POST') return texto('Solo GET y POST.', 405);

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const signingKey = process.env.CALENDLY_SIGNING_KEY;
  const accessToken = process.env.CALENDLY_PERSONAL_ACCESS_TOKEN;

  if (!supaUrl || !serviceKey) return texto('Falta config Supabase.', 500);
  if (!signingKey) return texto('Falta CALENDLY_SIGNING_KEY.', 503);
  if (!accessToken) return texto('Falta CALENDLY_PERSONAL_ACCESS_TOKEN.', 503);

  const crudo = await req.text();
  const cabecera = req.headers.get('calendly-webhook-signature') ?? '';
  if (!(await firmaValida(crudo, signingKey, cabecera))) return texto('Firma inválida.', 401);

  let body: CalendlyWebhookBody;
  try {
    body = JSON.parse(crudo);
  } catch {
    return texto('Body no es JSON válido.', 400);
  }

  // invitee.canceled y cualquier otro evento: gap de v1, aceptado a propósito.
  if (body.event !== 'invitee.created') return texto('OK (evento ignorado)', 200);

  const invitee = body.payload;
  if (!invitee?.uri || !invitee.event) return texto('Payload sin uri/event.', 400);

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const externalId = externalIdInviteeCalendly(invitee.uri);

  // Idempotencia: Calendly puede reintentar la misma entrega.
  const { data: existente } = await admin.from('meetings').select('id').eq('external_id', externalId).maybeSingle();
  if (existente) return texto('OK (ya procesado)', 200);

  // Hoy solo hay un cliente habilitado (Alejo) — si mañana hay más, esto
  // necesitará distinguir CUÁL org/evento de Calendly es cuál cliente (ver
  // nota en `src/config/calendly.ts`).
  const declarado = CALENDLY_CLIENTES[0];
  if (!declarado) {
    console.warn('[calendly] no hay ningún cliente habilitado, se ignora', externalId);
    return texto('OK (sin cliente habilitado)', 200);
  }

  const { data: cliente } = await admin.from('clients').select('agency_id').eq('id', declarado.clientId).maybeSingle();
  if (!cliente) {
    console.error('[calendly] client_id declarado ya no existe', declarado.clientId);
    return texto('OK (cliente no encontrado)', 200);
  }

  // ── Detalle real del evento (hora, link, host) ──────────────────────────
  const eventoId = invitee.event.split('/').pop();
  const detalle = await traerDetalleEvento(eventoId!, accessToken);
  if (!detalle) return texto('OK (no se pudo traer el detalle del evento)', 200);

  // ── Resolver closer por email, dentro de este cliente ───────────────────
  const hostEmail = detalle.event_memberships?.[0]?.user_email;
  let closer: { id: string; nombre: string } | null = null;
  if (hostEmail) {
    const { data: tm } = await admin
      .from('team_members')
      .select('id, nombre')
      .eq('client_id', declarado.clientId)
      .ilike('email', hostEmail)
      .maybeSingle();
    if (tm) closer = { id: tm.id as string, nombre: tm.nombre as string };
  }

  // ── Resolver o crear el lead ─────────────────────────────────────────────
  const email = invitee.email?.trim() || undefined;
  const telefono = invitee.text_reminder_number?.trim() || undefined;
  let leadId: string | undefined;
  let leadEtapaActual: LeadStage | undefined;

  if (email || telefono) {
    const { data: candidatos } = await admin
      .from('leads')
      .select('id, etapa, email, telefono')
      .eq('client_id', declarado.clientId);
    const match = (candidatos ?? []).find((l: Record<string, unknown>) => {
      const lEmail = l.email ? normalizar(l.email as string) : '';
      const lTel = l.telefono ? normalizarTelefono(l.telefono as string) : '';
      return (email && lEmail && lEmail === normalizar(email)) ||
        (telefono && lTel && lTel === normalizarTelefono(telefono));
    });
    if (match) {
      leadId = match.id as string;
      leadEtapaActual = match.etapa as LeadStage;
    }
  }

  if (!leadId) {
    // Sin match: se crea un lead nuevo vía la misma RPC que usa el resto de
    // la app — fuente 'otro' porque Calendly es DÓNDE se agenda, no de dónde
    // vino el lead (LeadSource describe canal de origen: reel/dm/referido...).
    const { data: nuevoId, error } = await admin.rpc('api_lead_crear', {
      p_agencia: cliente.agency_id,
      p_client_id: declarado.clientId,
      p_nombre: invitee.name || email || telefono || 'Sin nombre',
      p_telefono: telefono ?? null,
      p_email: email ?? null,
      p_fuente: 'otro',
      p_external_id: externalId,
    });
    if (error) {
      console.error('[calendly] api_lead_crear falló', externalId, error);
    } else {
      leadId = nuevoId as string;
      leadEtapaActual = 'nuevo';
    }
  } else if (leadEtapaActual && ETAPAS_QUE_SUBEN_A_CITA_AGENDADA.includes(leadEtapaActual)) {
    await admin
      .from('leads')
      .update({ etapa: 'cita_agendada', fecha_agenda: detalle.start_time })
      .eq('id', leadId);
    await admin.from('lead_events').insert({
      lead_id: leadId,
      etapa_anterior: leadEtapaActual,
      etapa_nueva: 'cita_agendada',
      nota: 'Agendado por Calendly',
      actor_id: closer?.id ?? null,
      actor_nombre: closer?.nombre ?? 'Calendly',
    });
  } else if (leadId) {
    // Ya estaba más adelante en el embudo: no se retrocede la etapa, solo se
    // registra la fecha de la nueva llamada.
    await admin.from('leads').update({ fecha_agenda: detalle.start_time }).eq('id', leadId);
  }

  // ── Crear el Meeting ─────────────────────────────────────────────────────
  const duracionMin = minutosEntre(detalle.start_time, detalle.end_time);
  const { error: errMeeting } = await admin.from('meetings').insert({
    client_id: declarado.clientId,
    title: `Llamada agendada — ${invitee.name || 'Sin nombre'}`,
    type: 'general',
    scheduled_at: detalle.start_time,
    duration_min: duracionMin,
    participants: closer ? [{ userId: closer.id, name: closer.nombre }] : [],
    video_call_link: detalle.location?.join_url ?? undefined,
    origen: 'calendly',
    external_id: externalId,
    lead_id: leadId ?? null,
  });
  if (errMeeting) console.error('[calendly] no se pudo crear el meeting', externalId, errMeeting);

  return texto('OK', 200);
}

interface CalendlyInvitee {
  uri: string;
  email?: string;
  name?: string;
  text_reminder_number?: string;
  event: string; // URI del scheduled event
  status?: 'active' | 'canceled';
}

interface CalendlyWebhookBody {
  event?: string; // 'invitee.created' | 'invitee.canceled' | ...
  payload?: CalendlyInvitee;
}

interface DetalleEvento {
  start_time: string;
  end_time: string;
  location?: { join_url?: string };
  event_memberships?: Array<{ user_email?: string }>;
}

async function traerDetalleEvento(eventoId: string, accessToken: string): Promise<DetalleEvento | null> {
  const res = await fetch(`https://api.calendly.com/scheduled_events/${eventoId}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error('[calendly] scheduled_events respondió', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = (await res.json()) as { resource?: DetalleEvento };
  return data.resource ?? null;
}

/**
 * `Calendly-Webhook-Signature: t=<timestamp>,v1=<hex>` — HMAC-SHA256 de
 * `${timestamp}.${cuerpoCrudo}` con la signing key de la suscripción.
 * Rechaza timestamps de más de 180s (anti-replay).
 */
async function firmaValida(cuerpoCrudo: string, signingKey: string, cabecera: string): Promise<boolean> {
  const partes = Object.fromEntries(cabecera.split(',').map((p) => p.split('=') as [string, string]));
  const ts = partes.t;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const ahora = Math.floor(Date.now() / 1000);
  if (Math.abs(ahora - Number(ts)) > REPLAY_MAX_SEGUNDOS) return false;

  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`${ts}.${cuerpoCrudo}`));
  const calculada = Array.from(new Uint8Array(firma)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return igualSeguro(calculada, v1);
}

/** Comparación en tiempo constante — mismo motivo que en Meta/Paralelo. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function minutosEntre(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 30;
  return Math.max(1, Math.round(ms / 60000));
}

function texto(mensaje: string, status: number): Response {
  return new Response(mensaje, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
