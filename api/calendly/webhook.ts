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
import { CALENDLY_CLIENTES, externalIdInviteeCalendly, tipoReunionDesdeNombreEvento } from '../../src/config/calendly';
import { normalizar, normalizarTelefono } from '../../src/utils/csvLeads';

export const config = { runtime: 'edge' };

const REPLAY_MAX_SEGUNDOS = 180;
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
  if (!/^https:\/\/api\.calendly\.com\/scheduled_events\/[a-f0-9-]{36}$/i.test(invitee.event) ||
      !invitee.uri.startsWith(invitee.event + '/invitees/')) return texto('URI de Calendly inválida.', 400);

  try {
    const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const externalId = externalIdInviteeCalendly(invitee.uri);
    if (CALENDLY_CLIENTES.length !== 1) return texto('Configuración de cliente Calendly incompleta o ambigua.', 503);

    // Idempotencia: Calendly puede reintentar la misma entrega.
    const { data: existente, error: lookupError } = await admin.from('meetings').select('id').eq('external_id', externalId).eq('client_id', CALENDLY_CLIENTES[0].clientId).eq('origen', 'calendly').maybeSingle();
    if (lookupError) throw lookupError;
    if (existente) return texto('OK (ya procesado)', 200);

    const declarado = CALENDLY_CLIENTES[0];

    const { data: cliente, error: clientError } = await admin.from('clients').select('agency_id').eq('id', declarado.clientId).maybeSingle();
    if (clientError) throw clientError;
    if (!cliente) {
      console.error('[calendly] client_id declarado ya no existe', declarado.clientId);
      return texto('Cliente configurado no encontrado.', 503);
    }

    // ── Detalle real del evento (hora, link, host) ──────────────────────────
    const eventoId = invitee.event.split('/').pop();
    const detalle = await traerDetalleEvento(eventoId!, accessToken);
    if (!detalle) return texto('No se pudo consultar Calendly. Reintentar.', 502);

    // ── Resolver closer por email, dentro de este cliente ───────────────────
    const hostEmail = detalle.event_memberships?.[0]?.user_email;
    let closer: { id: string; nombre: string } | null = null;
    if (hostEmail) {
      const { data: tm, error: closerError } = await admin
        .from('team_members')
        .select('id, nombre')
        .eq('client_id', declarado.clientId)
        .ilike('email', hostEmail)
        .maybeSingle();
      if (closerError) throw closerError;
      if (tm) closer = { id: tm.id as string, nombre: tm.nombre as string };
    }

    // ── Resolver o crear el lead ─────────────────────────────────────────────
    const email = invitee.email?.trim() || undefined;
    // El número de SMS (text_reminder_number) es OPCIONAL y aparte de las
    // preguntas del formulario — este Event Type en particular pide el
    // teléfono como pregunta custom, no como ese campo. Se intentan los dos.
    const telefono = invitee.text_reminder_number?.trim() || telefonoDesdePreguntas(invitee.questions_and_answers);
    const notasPreguntas = formatearPreguntas(invitee.questions_and_answers);
    let leadId: string | undefined;

    if (email || telefono) {
      const { data: candidatos, error: leadsError } = await admin
        .from('leads')
        .select('id, etapa, email, telefono')
        .eq('client_id', declarado.clientId);
      if (leadsError) throw leadsError;
      const match = (candidatos ?? []).find((l: Record<string, unknown>) => {
        const lEmail = l.email ? normalizar(l.email as string) : '';
        const lTel = l.telefono ? normalizarTelefono(l.telefono as string) : '';
        return (email && lEmail && lEmail === normalizar(email)) ||
          (telefono && lTel && lTel === normalizarTelefono(telefono));
      });
      if (match) {
        leadId = match.id as string;
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
        throw error;
      } else {
        leadId = nuevoId as string;
      }
    }

    if (!leadId) throw new Error('Calendly no obtuvo un lead guardado.');

    // ── Crear el Meeting ─────────────────────────────────────────────────────
    // Título y tipo salen del Event Type REAL agendado en Calendly (ej.
    // "Sesión Estratégica de Patrocinios"), no de un genérico — cada Event
    // Type puede ser una reunión de naturaleza distinta.
    const nombreEvento = detalle.name?.trim() || `Llamada agendada — ${invitee.name || 'Sin nombre'}`;
    const tipoReunion = tipoReunionDesdeNombreEvento(detalle.name ?? '') ?? 'general';
    const duracionMin = minutosEntre(detalle.start_time, detalle.end_time);
    const { error: errMeeting } = await admin.rpc('calendly_guardar_reserva', {
      p_client_id: declarado.clientId, p_lead_id: leadId, p_external_id: externalId,
      p_actor_id: closer?.id ?? null, p_actor_nombre: closer?.nombre ?? 'Calendly',
      p_meeting: {
        title: invitee.name ? `${nombreEvento} — ${invitee.name}` : nombreEvento,
        type: tipoReunion,
        scheduled_at: detalle.start_time,
        duration_min: duracionMin,
        participants: closer ? [{ userId: closer.id, name: closer.nombre }] : [],
        video_call_link: detalle.location?.join_url ?? undefined,
        // Lo que respondió el invitee en el formulario de reserva — cada Event
        // Type trae sus propias preguntas, así que se guardan TODAS tal cual
        // (no se adivina cuáles importan para cada caso).
        notes: notasPreguntas,
      },
    });
    if (errMeeting) throw errMeeting;

    return texto('OK', 200);
  } catch (error) {
    console.error('[calendly] reserva no confirmada', error);
    return texto('No se guardó la reserva. Reintentar.', 500);
  }
}

interface CalendlyQA {
  question?: string;
  answer?: string;
  position?: number;
}

interface CalendlyInvitee {
  uri: string;
  email?: string;
  name?: string;
  text_reminder_number?: string;
  event: string; // URI del scheduled event
  status?: 'active' | 'canceled';
  // Respuestas al formulario de reserva — cada Event Type de Calendly trae
  // las suyas (acá no se adivina cuáles son: se guardan TODAS en las notas
  // de la reunión, y solo se intenta sacar un teléfono si hay una pregunta
  // que claramente pregunta por eso).
  questions_and_answers?: CalendlyQA[];
}

/** Formatea las preguntas/respuestas del formulario de reserva para Notas. */
function formatearPreguntas(qa: CalendlyQA[] | undefined): string | undefined {
  if (!qa || qa.length === 0) return undefined;
  return qa
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((p) => `${(p.question ?? '').trim()}: ${(p.answer ?? '').trim()}`)
    .join('\n');
}

/** Si ninguna pregunta de "teléfono"/"whatsapp" trae el número, no se inventa. */
function telefonoDesdePreguntas(qa: CalendlyQA[] | undefined): string | undefined {
  const pregunta = (qa ?? []).find((p) => /tel[eé]fono|whatsapp|celular|phone/i.test(p.question ?? ''));
  return pregunta?.answer?.trim() || undefined;
}

interface CalendlyWebhookBody {
  event?: string; // 'invitee.created' | 'invitee.canceled' | ...
  payload?: CalendlyInvitee;
}

interface DetalleEvento {
  name?: string; // nombre real del Event Type agendado, ej. "Sesión Estratégica de Patrocinios"
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
    console.error('[calendly] scheduled_events respondió', res.status);
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
  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[a-f0-9]{64}$/i.test(v1)) return false;

  const ahora = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(Number(ts))) return false;
  if (Math.abs(ahora - Number(ts)) > REPLAY_MAX_SEGUNDOS) return false;

  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`${ts}.${cuerpoCrudo}`));
  const calculada = Array.from(new Uint8Array(firma)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return igualSeguro(calculada, v1.toLowerCase());
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
