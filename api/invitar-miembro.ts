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
  // Correo de invitación (best-effort: si falla, el alta NO se cae).
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || 'Project360 <onboarding@resend.dev>';
  const appUrl = process.env.APP_URL || 'https://project360-pearl.vercel.app';

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
  const telefono = String(body.telefono ?? '').trim();
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

  // ── 6. Fila en team_members — DAR ACCESO A QUIEN YA ESTÁ, NO CREARLO OTRA VEZ
  //
  // Aquí había un `insert` a ciegas, y por eso invitar duplicaba personas: casi
  // todo el equipo ya existía como ficha creada con "Agregar persona" (sin
  // login), así que invitar a Santiago Ruiz creaba un SEGUNDO Santiago Ruiz.
  // Quedaban dos tarjetas: una con sus KPIs y otra con su acceso.
  //
  // Invitar a alguien es darle acceso, no darlo de alta. Se busca su ficha
  // primero: por correo, que es la identidad de acceso, y si no por nombre
  // dentro de ese cliente (las fichas creadas a mano suelen no tener correo).
  const { data: existentes } = await admin
    .from('team_members')
    .select('id, nombre, email, user_id')
    .eq('client_id', clientId);

  const norm = (v: unknown) =>
    String(v ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const ficha =
    (existentes ?? []).find((m) => m.email && norm(m.email) === norm(email)) ??
    (existentes ?? []).find((m) => norm(m.nombre) === norm(nombre));

  // Una ficha que YA tiene otro login no se toca: son dos personas distintas
  // con el mismo nombre, o un error que hay que mirar a mano. Reutilizarla le
  // daría a alguien el acceso de otro, que es mucho peor que una ficha de más.
  if (ficha?.user_id && ficha.user_id !== userId) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return json(
      {
        error:
          `Ya existe "${ficha.nombre}" en este cliente con un acceso distinto. ` +
          'Revisa si son la misma persona antes de invitar.',
      },
      409,
    );
  }

  const datosAcceso = {
    email,
    telefono: telefono || null,
    avatar_color: avatarColor,
    funciones,
    access_level: accessLevel,
    departamentos,
    user_id: userId,
  };

  // OJO: al actualizar NO se tocan `kpis` ni `created_at`. Son el historial de
  // esa persona y no tienen nada que ver con darle acceso.
  const { data: tm, error: tmErr } = ficha
    ? await admin
        .from('team_members')
        .update({ ...datosAcceso, nombre, rol })
        .eq('id', ficha.id)
        .select('id')
        .single()
    : await admin
        .from('team_members')
        .insert({ client_id: clientId, nombre, rol, ...datosAcceso })
        .select('id')
        .single();

  if (tmErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return json({ error: `No se pudo crear el miembro: ${tmErr.message}` }, 500);
  }

  // ── 7. Correo de invitación con su acceso (best-effort) ───────────────────
  // El miembro ya está creado; si el correo falla, se lo compartes a mano.
  let emailSent = false;
  let emailError: string | undefined;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: resendFrom,
          to: [email],
          subject: '🔑 Tu acceso a Project360',
          html: renderInviteEmail(nombre, email, password, appUrl),
        }),
      });
      if (res.ok) emailSent = true;
      else emailError = `${res.status} ${await res.text().catch(() => '')}`.slice(0, 200);
    } catch (e) {
      emailError = e instanceof Error ? e.message : 'error';
    }
  } else {
    emailError = 'no-resend-key';
  }

  return json({ ok: true, memberId: tm.id, userId, email, emailSent, emailError });
}

/** Correo de bienvenida con las credenciales de acceso del nuevo miembro. */
function renderInviteEmail(nombre: string, email: string, password: string, appUrl: string): string {
  const first = (nombre.split(' ')[0] || '').trim();
  const loginUrl = `${appUrl}/login`;
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Inter,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:28px 16px">
      <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8eaee">
        <div style="background:linear-gradient(135deg,#4f8cff,#37c9a6);padding:20px 24px;color:#fff">
          <div style="font-size:12px;letter-spacing:2px;opacity:.9;text-transform:uppercase">Project360 · Acceso al equipo</div>
          <div style="font-size:20px;font-weight:800;margin-top:4px">Hola ${escapeHtml(first)} 👋</div>
        </div>
        <div style="padding:22px 24px">
          <p style="font-size:14px;color:#444;margin:0 0 16px">Te dieron acceso a <b>Project360</b>, donde vas a ver tus tareas, tu agenda y tus KPIs. Entra con estos datos:</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:6px">
            <tr>
              <td style="padding:12px 14px;border-bottom:1px solid #eee;font-size:13px;color:#666;white-space:nowrap">Correo</td>
              <td style="padding:12px 14px;border-bottom:1px solid #eee;font-size:14px;color:#111;font-weight:600">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;font-size:13px;color:#666;white-space:nowrap">Contraseña temporal</td>
              <td style="padding:12px 14px;font-size:14px;color:#111;font-family:monospace;font-weight:700;letter-spacing:.5px">${escapeHtml(password)}</td>
            </tr>
          </table>
          <a href="${loginUrl}" style="display:inline-block;margin-top:16px;background:#4f8cff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px">Entrar a Project360 →</a>
          <p style="font-size:12px;color:#999;margin:18px 0 0">Por seguridad, cambia tu contraseña la primera vez que entres. Si no esperabas este correo, ignóralo.</p>
        </div>
      </div>
    </div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
