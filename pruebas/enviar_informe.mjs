#!/usr/bin/env node
/**
 * Envía un informe de auditoría por correo (Resend) y a Telegram.
 *
 *   node pruebas/enviar_informe.mjs informes/2026-08-18-auditoria.md
 *
 * Variables que necesita:
 *   RESEND_API_KEY        ya existe en Vercel (se usa para invitaciones y reportes)
 *   INFORME_EMAIL_TO      destinatarios separados por coma
 *   INFORME_EMAIL_FROM    remitente verificado en Resend
 *   TELEGRAM_BOT_TOKEN    el que da @BotFather
 *   TELEGRAM_CHAT_ID      el chat o grupo donde llega
 *
 * Los dos canales son independientes A PROPÓSITO: si Telegram falla, el correo
 * sale igual. Un informe que no llega por un fallo del mensajero es un informe
 * que nadie echa de menos — y el silencio se confunde con "no había nada".
 *
 * Sale con código 1 si NINGÚN canal pudo entregar, para que el cron lo marque
 * en rojo. Si al menos uno entregó, sale con 0 y avisa del otro.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Falta la ruta del informe. Uso: node pruebas/enviar_informe.mjs <archivo.md>');
  process.exit(1);
}

const markdown = readFileSync(ruta, 'utf8');
const titulo = markdown.match(/^#\s+(.+)$/m)?.[1] ?? basename(ruta);

/** La primera sección "## Resumen" — lo único que se lee en el móvil. */
const resumen =
  markdown.split(/^##\s+Resumen\s*$/m)[1]?.split(/^##\s/m)[0]?.trim() ?? '';

const resultados = [];

/* ── Correo ────────────────────────────────────────────────────────────────*/
async function enviarCorreo() {
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.INFORME_EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const from = process.env.INFORME_EMAIL_FROM;
  if (!key || !to.length || !from) return { canal: 'correo', ok: false, motivo: 'sin configurar' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: titulo,
      // Se manda el informe COMPLETO por correo: es donde se lee con calma.
      // El <pre> conserva el markdown legible sin depender de un conversor.
      html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55;white-space:pre-wrap">${escapar(markdown)}</pre>`,
    }),
  });
  if (!res.ok) return { canal: 'correo', ok: false, motivo: `HTTP ${res.status} ${await res.text()}` };
  return { canal: 'correo', ok: true };
}

/* ── Telegram ──────────────────────────────────────────────────────────────*/
async function enviarTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { canal: 'telegram', ok: false, motivo: 'sin configurar' };

  // Telegram corta en 4096 caracteres. Al móvil va el RESUMEN, no el informe
  // entero: el detalle está en el correo y en el repo. Un muro de texto en el
  // teléfono se ignora igual que no mandar nada.
  const cuerpo = [`*${escaparMd(titulo)}*`, '', escaparMd(resumen || 'Sin resumen.')]
    .join('\n')
    .slice(0, 3900);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: cuerpo, parse_mode: 'MarkdownV2' }),
  });
  if (!res.ok) return { canal: 'telegram', ok: false, motivo: `HTTP ${res.status} ${await res.text()}` };
  return { canal: 'telegram', ok: true };
}

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** MarkdownV2 de Telegram exige escapar casi todo signo. */
const escaparMd = (s) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);

for (const enviar of [enviarCorreo, enviarTelegram]) {
  try {
    resultados.push(await enviar());
  } catch (e) {
    resultados.push({ canal: enviar.name, ok: false, motivo: e.message });
  }
}

for (const r of resultados) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.canal}${r.ok ? '' : ` — ${r.motivo}`}`);
}

if (!resultados.some((r) => r.ok)) {
  console.error('\nNingún canal pudo entregar el informe.');
  process.exit(1);
}
