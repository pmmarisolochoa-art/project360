/**
 * Vercel Edge Function — Post-reunión: envía a cada responsable SUS tareas.
 *
 * Al confirmar las tareas de una reunión, el frontend llama aquí con la lista
 * de tareas recién creadas. Resolvemos cada responsable → correo (por NOMBRE de
 * persona O por ROL, igual que el cron de recordatorios) y mandamos UN correo
 * por persona con sus tareas y enlace directo a cada una. Usa Resend vía HTTP.
 *
 * Seguridad:
 *   1. Verifica el token del que dispara (sesión válida).
 *   2. Autoriza si es OWNER de la agencia del cliente O miembro de ese cliente.
 *
 * Requiere en Vercel: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL,
 *   RESEND_API_KEY, RESEND_FROM, APP_URL (opcional).
 */

import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppViaGHL, ghlConfigured } from './_ghl';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const CO_OFFSET_MS = -5 * 60 * 60 * 1000; // Colombia GMT-5

function coDate(d: Date): string {
  return new Date(d.getTime() + CO_OFFSET_MS).toISOString().slice(0, 10);
}

interface TaskIn {
  id: string;
  title: string;
  assignedTo: string | null;
  dueDate: string | null;
}

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

  // ── 1. Autenticar ──────────────────────────────────────────────────────────
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autorizado.' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) return json({ error: 'Sesión inválida.' }, 401);
  const callerId = callerData.user.id;

  // ── 2. Body ────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Body inválido.' }, 400);
  }
  const clientId = String(body.clientId ?? '').trim();
  const meetingTitle = String(body.meetingTitle ?? 'Reunión').trim();
  const tasks = (Array.isArray(body.tasks) ? body.tasks : [])
    .map((t) => t as Record<string, unknown>)
    .map((t) => ({
      id: String(t.id ?? '').trim(),
      title: String(t.title ?? '').trim(),
      assignedTo: t.assignedTo ? String(t.assignedTo).trim() : null,
      dueDate: t.dueDate ? String(t.dueDate) : null,
    }))
    .filter((t) => t.id && t.title) as TaskIn[];

  if (!clientId) return json({ error: 'Falta el cliente.' }, 400);
  if (tasks.length === 0) return json({ error: 'No hay tareas para enviar.' }, 400);

  // ── 3. Autorizar: owner de la agencia O miembro del cliente ────────────────
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

  // ── 4. Resolver responsable → correo (por nombre O por rol) ────────────────
  const { data: members } = await admin
    .from('team_members')
    .select('nombre, rol, email, telefono')
    .eq('client_id', clientId);
  interface Recip { email: string; nombre: string; telefono: string }
  const byName = new Map<string, Recip>();
  const byRole = new Map<string, Recip[]>();
  for (const m of members ?? []) {
    const email = m.email ? String(m.email) : '';
    const nombre = m.nombre ? String(m.nombre) : '';
    const telefono = m.telefono ? String(m.telefono).trim() : '';
    if (!email || !nombre) continue;
    const recip: Recip = { email, nombre, telefono };
    byName.set(nombre.trim().toLowerCase(), recip);
    if (m.rol) {
      const rk = String(m.rol).trim().toLowerCase();
      const arr = byRole.get(rk) ?? [];
      arr.push(recip);
      byRole.set(rk, arr);
    }
  }

  // ── 5. Agrupar tareas por correo de cada persona ───────────────────────────
  interface Item { title: string; due: string | null; taskId: string }
  const byEmail = new Map<string, { nombre: string; telefono: string; items: Item[] }>();
  let unassigned = 0;
  const missing = new Set<string>(); // responsables (nombre/rol) sin correo para avisar
  for (const t of tasks) {
    const key = (t.assignedTo ?? '').toLowerCase();
    if (!key) { unassigned++; missing.add('(sin responsable)'); continue; }
    const nameMatch = byName.get(key);
    const recipients = nameMatch ? [nameMatch] : (byRole.get(key) ?? []);
    if (recipients.length === 0) { unassigned++; missing.add(t.assignedTo ?? key); continue; }
    for (const r of recipients) {
      const bucket = byEmail.get(r.email) ?? { nombre: r.nombre, telefono: r.telefono, items: [] };
      bucket.items.push({ title: t.title, due: t.dueDate, taskId: t.id });
      byEmail.set(r.email, bucket);
    }
  }

  if (byEmail.size === 0) {
    return json({
      ok: true, sent: 0, people: 0, unassigned,
      missing: [...missing],
      note: 'Ninguna tarea tiene un responsable con correo.',
    });
  }

  // ── 6. Enviar un correo por persona. Si hay teléfono + GHL, también WhatsApp.
  let sent = 0;
  let whatsapp = 0;
  const errors: string[] = [];
  const useWhatsApp = ghlConfigured();
  const taskUrl = (i: Item) => `${appUrl}/client/${clientId}/tasks?task=${i.taskId}`;
  for (const [email, { nombre, telefono, items }] of byEmail) {
    const html = renderEmail(nombre, meetingTitle, items, clientId, appUrl);
    const subject = `📋 ${items.length} tarea${items.length === 1 ? '' : 's'} para ti — ${meetingTitle}`;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject, html }),
      });
      if (res.ok) sent++;
      else errors.push(`${email}: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 200));
    } catch (e) {
      errors.push(`${email}: ${e instanceof Error ? e.message : 'error'}`);
    }

    if (useWhatsApp && telefono) {
      const first = (nombre.split(' ')[0] || '').trim();
      const lineas = items.map((i) => `• ${i.title}`).join('\n');
      const mainLink = items.length === 1 ? taskUrl(items[0]) : `${appUrl}/mi-espacio`;
      const mensaje = `Hola ${first} 👋 De la reunión "${meetingTitle}" quedaron ${items.length} tarea${items.length === 1 ? '' : 's'} a tu cargo:\n${lineas}\n\nÁbrelas aquí: ${mainLink}`;
      const r = await sendWhatsAppViaGHL({
        tipo: 'post-reunion',
        nombre, telefono, mensaje, link: mainLink, clientId,
        tareas: items.map((i) => ({ title: i.title, link: taskUrl(i) })),
      });
      if (r.ok) whatsapp++;
      else if (r.error) errors.push(`wa ${telefono}: ${r.error}`);
    }
  }

  return json({
    ok: true, sent, whatsapp, people: byEmail.size, unassigned,
    missing: missing.size ? [...missing] : undefined,
    errors: errors.length ? errors : undefined,
  });
}

function renderEmail(
  nombre: string,
  meetingTitle: string,
  items: Array<{ title: string; due: string | null; taskId: string }>,
  clientId: string,
  appUrl: string,
): string {
  const first = (nombre.split(' ')[0] || '').trim();
  const taskUrl = (i: { taskId: string }) => `${appUrl}/client/${clientId}/tasks?task=${i.taskId}`;
  const fmtDue = (iso: string | null) => {
    if (!iso) return '';
    const d = coDate(new Date(iso));
    const [y, m, day] = d.split('-');
    return `Entrega: ${day}/${m}/${y}`;
  };
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:0;border-bottom:1px solid #eee">
          <a href="${taskUrl(i)}" style="display:block;padding:12px 12px;font-size:14px;color:#111;text-decoration:none">${escapeHtml(i.title)} <span style="color:#4f8cff">→</span></a>
        </td>
        <td style="padding:12px 12px;border-bottom:1px solid #eee;font-size:13px;color:#666;white-space:nowrap">${escapeHtml(fmtDue(i.due))}</td>
      </tr>`,
    )
    .join('');
  const mainHref = items.length === 1 ? taskUrl(items[0]) : `${appUrl}/mi-espacio`;
  const mainLabel = items.length === 1 ? 'Abrir la tarea →' : 'Ver mis tareas →';
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Inter,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:28px 16px">
      <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8eaee">
        <div style="background:linear-gradient(135deg,#4f8cff,#37c9a6);padding:20px 24px;color:#fff">
          <div style="font-size:12px;letter-spacing:2px;opacity:.9;text-transform:uppercase">Project360 · Tareas de reunión</div>
          <div style="font-size:20px;font-weight:800;margin-top:4px">Hola ${escapeHtml(first)} 👋</div>
        </div>
        <div style="padding:22px 24px">
          <p style="font-size:14px;color:#444;margin:0 0 14px">De la reunión <b>${escapeHtml(meetingTitle)}</b> quedaron estas tareas a tu cargo — <b>toca cada una para abrirla</b>:</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">${rows}</table>
          <a href="${mainHref}" style="display:inline-block;margin-top:18px;background:#4f8cff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px">${mainLabel}</a>
          <p style="font-size:12px;color:#999;margin:18px 0 0">Enviado desde Project360 al cerrar la reunión.</p>
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
