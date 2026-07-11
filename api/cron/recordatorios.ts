/**
 * Vercel Cron — Recordatorios de tareas por email.
 *
 * Corre 1x al día (ver vercel.json). Por cada persona con tareas pendientes que
 * vencen HOY o EN 2 DÍAS, envía UN solo correo con el resumen (no un correo por
 * tarea → sin spam). Usa Resend vía HTTP (sin dependencias).
 *
 * Requiere en Vercel:
 *   - SUPABASE_SERVICE_ROLE_KEY (ya configurada para el botón invitar)
 *   - VITE_SUPABASE_URL
 *   - RESEND_API_KEY        (de resend.com)
 *   - RESEND_FROM           (ej. "Project360 <recordatorios@tudominio.com>")
 *   - CRON_SECRET           (string aleatorio; Vercel lo manda como Bearer)
 *   - APP_URL               (opcional, para el botón del correo; default prod)
 */

import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppViaGHL, ghlConfigured } from '../_ghl';

export const config = { runtime: 'edge' };

const CO_OFFSET_MS = -5 * 60 * 60 * 1000; // Colombia GMT-5

/** Fecha calendario en Colombia (YYYY-MM-DD) de un instante dado. */
function coDate(d: Date): string {
  return new Date(d.getTime() + CO_OFFSET_MS).toISOString().slice(0, 10);
}

interface TaskRow {
  id: string;
  client_id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
}

export default async function handler(req: Request): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Project360 <onboarding@resend.dev>';
  const appUrl = process.env.APP_URL || 'https://project360-pearl.vercel.app';
  const cronSecret = process.env.CRON_SECRET;

  // Diagnóstico seguro (no revela valores): /api/cron/recordatorios?debug=1
  const debug = new URL(req.url).searchParams.get('debug') === '1';
  if (debug) {
    const authRaw = req.headers.get('authorization') || '';
    const received = authRaw.replace(/^Bearer\s+/i, '').trim();
    return json({
      cronSecretSet: !!cronSecret,
      cronSecretLen: (cronSecret ?? '').length,
      receivedLen: received.length,
      match: !!cronSecret && received === cronSecret.trim(),
      resendSet: !!resendKey,
      fromSet: !!process.env.RESEND_FROM,
      supabaseSet: !!(url && serviceKey),
      ghlSet: ghlConfigured(),
    });
  }

  // Protección: si hay CRON_SECRET, el llamado debe traerlo (Vercel Cron lo hace).
  // Tolerante a espacios/nueva-línea al copiar la variable en Vercel.
  if (cronSecret) {
    const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (auth !== cronSecret.trim()) {
      return json({ error: 'No autorizado.' }, 401);
    }
  }
  if (!url || !serviceKey) return json({ error: 'Falta config Supabase.' }, 500);
  if (!resendKey) return json({ error: 'Falta RESEND_API_KEY.' }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const now = new Date();
  const today = coDate(now);
  const inTwo = coDate(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));

  // 1. Tareas pendientes con fecha de vencimiento.
  const { data: tasksRaw, error: tErr } = await admin
    .from('tasks')
    .select('id, client_id, title, status, due_date, assigned_to')
    .neq('status', 'completed')
    .not('due_date', 'is', null);
  if (tErr) return json({ error: `tasks: ${tErr.message}` }, 500);

  const tasks = (tasksRaw ?? []) as TaskRow[];
  // Solo las que vencen hoy o en 2 días (por fecha calendario en Colombia).
  const relevant = tasks
    .map((t) => ({ t, due: t.due_date ? coDate(new Date(t.due_date)) : null }))
    .filter(({ due }) => due === today || due === inTwo);

  if (relevant.length === 0) return json({ ok: true, sent: 0, note: 'Sin tareas que venzan hoy o en 2 días.' });

  // 2. Resolver responsable → email(s). Las tareas se asignan por NOMBRE de
  //    persona O por ROL (slug: strategist, copywriter…). Soportamos ambos.
  //    Un rol puede tener varias personas → se les avisa a todas.
  const clientIds = [...new Set(relevant.map((r) => r.t.client_id))];
  const { data: members } = await admin
    .from('team_members')
    .select('client_id, nombre, rol, email, telefono')
    .in('client_id', clientIds);
  interface Recip { email: string; nombre: string; telefono: string }
  const byName = new Map<string, Recip>();          // client::nombre_lower
  const byRole = new Map<string, Recip[]>();         // client::rol_lower
  for (const m of members ?? []) {
    const email = m.email ? String(m.email) : '';
    const nombre = m.nombre ? String(m.nombre) : '';
    const telefono = m.telefono ? String(m.telefono).trim() : '';
    if (!email || !nombre) continue;
    const recip: Recip = { email, nombre, telefono };
    byName.set(`${m.client_id}::${nombre.trim().toLowerCase()}`, recip);
    if (m.rol) {
      const rk = `${m.client_id}::${String(m.rol).trim().toLowerCase()}`;
      const arr = byRole.get(rk) ?? [];
      arr.push(recip);
      byRole.set(rk, arr);
    }
  }

  // 3. Agrupar tareas por email de cada persona (match por nombre, si no, por rol).
  interface Item { title: string; when: 'hoy' | 'en 2 días'; clientId: string; taskId: string }
  const byEmail = new Map<string, { nombre: string; telefono: string; items: Item[] }>();
  for (const { t, due } of relevant) {
    const key = (t.assigned_to ?? '').trim().toLowerCase();
    if (!key) continue;
    const nameMatch = byName.get(`${t.client_id}::${key}`);
    const recipients = nameMatch ? [nameMatch] : (byRole.get(`${t.client_id}::${key}`) ?? []);
    if (recipients.length === 0) continue; // nadie a quién avisar
    const when: Item['when'] = due === today ? 'hoy' : 'en 2 días';
    for (const r of recipients) {
      const bucket = byEmail.get(r.email) ?? { nombre: r.nombre, telefono: r.telefono, items: [] };
      bucket.items.push({ title: t.title, when, clientId: t.client_id, taskId: t.id });
      byEmail.set(r.email, bucket);
    }
  }

  if (byEmail.size === 0) {
    return json({ ok: true, sent: 0, note: 'Hay tareas por vencer, pero sin email de responsable para avisar.' });
  }

  // 4. Enviar un correo por persona. Si hay teléfono + GHL, también WhatsApp.
  let sent = 0;
  let whatsapp = 0;
  const errors: string[] = [];
  const useWhatsApp = ghlConfigured();
  for (const [email, { nombre, telefono, items }] of byEmail) {
    const html = renderEmail(nombre, items, appUrl);
    const subject = `⏰ Tienes ${items.length} entrega${items.length === 1 ? '' : 's'} próxima${items.length === 1 ? '' : 's'} — Project360`;
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

    // WhatsApp vía GHL (solo si la persona tiene teléfono).
    if (useWhatsApp && telefono) {
      const taskLink = (i: Item) => `${appUrl}/client/${i.clientId}/tasks?task=${i.taskId}`;
      const first = (nombre.split(' ')[0] || '').trim();
      const lineas = items.map((i) => `• ${i.title} (${i.when === 'hoy' ? 'vence hoy' : 'en 2 días'})`).join('\n');
      const mainLink = items.length === 1 ? taskLink(items[0]) : `${appUrl}/mi-espacio`;
      const mensaje = `Hola ${first} 👋 Tienes ${items.length} entrega${items.length === 1 ? '' : 's'} próxima${items.length === 1 ? '' : 's'}:\n${lineas}\n\nÁbrelas aquí: ${mainLink}`;
      const r = await sendWhatsAppViaGHL({
        tipo: 'recordatorio',
        nombre, telefono, mensaje, link: mainLink,
        clientId: items[0]?.clientId ?? '',
        tareas: items.map((i) => ({ title: i.title, link: taskLink(i) })),
      });
      if (r.ok) whatsapp++;
      else if (r.error) errors.push(`wa ${telefono}: ${r.error}`);
    }
  }

  return json({ ok: true, sent, whatsapp, people: byEmail.size, errors: errors.length ? errors : undefined });
}

function renderEmail(nombre: string, items: Array<{ title: string; when: string; clientId: string; taskId: string }>, appUrl: string): string {
  const first = (nombre.split(' ')[0] || '').trim();
  // Cada fila enlaza DIRECTO a su tarea (?task=<id> abre el detalle en la app).
  const taskUrl = (i: { clientId: string; taskId: string }) =>
    `${appUrl}/client/${i.clientId}/tasks?task=${i.taskId}`;
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:0;border-bottom:1px solid #eee">
          <a href="${taskUrl(i)}" style="display:block;padding:12px 12px;font-size:14px;color:#111;text-decoration:none">${escapeHtml(i.title)} <span style="color:#4f8cff">→</span></a>
        </td>
        <td style="padding:12px 12px;border-bottom:1px solid #eee;font-size:13px;color:${i.when === 'hoy' ? '#dc2626' : '#d97706'};white-space:nowrap;font-weight:600">${i.when === 'hoy' ? 'Vence hoy' : 'En 2 días'}</td>
      </tr>`,
    )
    .join('');
  // Botón principal: si es una sola tarea, va directo a ella; si son varias, al listado.
  const mainHref = items.length === 1 ? taskUrl(items[0]) : `${appUrl}/mi-espacio`;
  const mainLabel = items.length === 1 ? 'Abrir la tarea →' : 'Ver mis tareas →';
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Inter,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:28px 16px">
      <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8eaee">
        <div style="background:linear-gradient(135deg,#4f8cff,#37c9a6);padding:20px 24px;color:#fff">
          <div style="font-size:12px;letter-spacing:2px;opacity:.9;text-transform:uppercase">Project360</div>
          <div style="font-size:20px;font-weight:800;margin-top:4px">Hola ${escapeHtml(first)} 👋</div>
        </div>
        <div style="padding:22px 24px">
          <p style="font-size:14px;color:#444;margin:0 0 14px">Estas entregas tuyas están por vencer — <b>toca cada una para abrirla</b>:</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">${rows}</table>
          <a href="${mainHref}" style="display:inline-block;margin-top:18px;background:#4f8cff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px">${mainLabel}</a>
          <p style="font-size:12px;color:#999;margin:18px 0 0">Recordatorio automático de Project360.</p>
        </div>
      </div>
    </div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
