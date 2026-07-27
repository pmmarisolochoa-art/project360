/**
 * Vercel Edge Function — envía el REPORTE EJECUTIVO de una reunión (PDF) por
 * correo a todo el equipo del cliente que tenga correo registrado.
 *
 * El PDF se genera en el navegador (estética editorial) y llega aquí en base64;
 * lo adjuntamos vía Resend en UN correo dirigido a todo el equipo.
 *
 * Seguridad (igual que enviar-tareas-reunion):
 *   1. Token de sesión válido.
 *   2. Owner de la agencia del cliente O miembro de ese cliente.
 *
 * Requiere en Vercel: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL,
 *   RESEND_API_KEY, RESEND_FROM, APP_URL (opcional).
 */

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Project360 <onboarding@resend.dev>';
  const appUrl = process.env.APP_URL || 'https://project360-pearl.vercel.app';

  if (!url || !serviceKey) return json({ error: 'Falta config Supabase.' }, 500);
  if (!resendKey) return json({ error: 'Falta RESEND_API_KEY.' }, 500);

  // ── 1. Autenticar ──
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autorizado.' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) return json({ error: 'Sesión inválida.' }, 401);
  const callerId = callerData.user.id;

  // ── 2. Body ──
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Body inválido.' }, 400);
  }
  const clientId = String(body.clientId ?? '').trim();
  const meetingTitle = String(body.meetingTitle ?? 'Reunión').trim();
  const clientName = String(body.clientName ?? '').trim();
  const deck = String(body.deck ?? '').trim();
  const dateLabel = String(body.dateLabel ?? '').trim();
  const pdfBase64 = String(body.pdfBase64 ?? '').trim();
  const fileName = String(body.fileName ?? 'Reporte_Reunion.pdf').trim();

  if (!clientId) return json({ error: 'Falta el cliente.' }, 400);
  if (!pdfBase64) return json({ error: 'Falta el PDF del reporte.' }, 400);

  // ── 3. Autorizar: owner de la agencia O miembro del cliente ──
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
  let authorized = !!agency;
  if (!authorized) {
    const { data: tm } = await admin
      .from('team_members')
      .select('id')
      .eq('client_id', clientId)
      .eq('user_id', callerId)
      .maybeSingle();
    authorized = !!tm;
  }
  if (!authorized) return json({ error: 'No tienes permiso para enviar en este cliente.' }, 403);

  // ── 4. Destinatarios: todo el equipo del cliente con correo ──
  const { data: members } = await admin
    .from('team_members')
    .select('nombre, email')
    .eq('client_id', clientId);

  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const m of members ?? []) {
    const email = (m.email ? String(m.email) : '').trim().toLowerCase();
    if (email && !seen.has(email)) { seen.add(email); recipients.push(email); }
  }

  if (recipients.length === 0) {
    return json({ ok: true, sent: 0, people: 0, note: 'Ningún miembro del equipo tiene correo registrado.' });
  }

  // ── 5. Enviar UN correo al equipo con el PDF adjunto ──
  const subject = `📄 Reporte de reunión — ${meetingTitle}${clientName ? ` · ${clientName}` : ''}`;
  const html = renderEmail({ meetingTitle, clientName, deck, dateLabel, appUrl, clientId });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        attachments: [{ filename: fileName, content: pdfBase64 }],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return json({ error: `Resend ${res.status}: ${t.slice(0, 200)}` }, 502);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error al enviar.' }, 502);
  }

  return json({ ok: true, sent: 1, people: recipients.length });
}

function renderEmail(a: {
  meetingTitle: string; clientName: string; deck: string; dateLabel: string; appUrl: string; clientId: string;
}): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Inter,Arial,sans-serif">
    <div style="max-width:540px;margin:0 auto;padding:28px 16px">
      <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8eaee">
        <div style="background:#111318;padding:22px 26px;color:#fff">
          <div style="font-size:11px;letter-spacing:2px;opacity:.7;text-transform:uppercase">Project360 · Reporte de reunión</div>
          <div style="font-size:21px;font-weight:800;margin-top:6px">${escapeHtml(a.meetingTitle)}</div>
          ${a.clientName ? `<div style="font-size:13px;opacity:.75;margin-top:2px">${escapeHtml(a.clientName)}${a.dateLabel ? ` · ${escapeHtml(a.dateLabel)}` : ''}</div>` : ''}
        </div>
        <div style="padding:24px 26px">
          ${a.deck ? `<p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 16px">${escapeHtml(a.deck)}</p>` : ''}
          <p style="font-size:14px;color:#555;margin:0 0 18px">Adjuntamos el <b>reporte ejecutivo completo</b> de la reunión en PDF: decisiones, compromisos con responsables, riesgos y próximos pasos.</p>
          <a href="${a.appUrl}/client/${a.clientId}/meetings" style="display:inline-block;background:#111318;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px">Ver la reunión →</a>
          <p style="font-size:12px;color:#999;margin:20px 0 0">Generado automáticamente por Project360 al cerrar la reunión.</p>
        </div>
      </div>
    </div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}
