/**
 * Envío de WhatsApp vía GoHighLevel (GHL).
 *
 * Project360 NO habla WhatsApp directo: le manda un POST a un "Inbound Webhook"
 * de un workflow de GHL, y GHL (que ya tiene el canal de WhatsApp montado) envía
 * el mensaje. Así no aprobamos plantillas con Meta ni pagamos otro proveedor.
 *
 * El workflow en GHL recibe este JSON y puede usar sus campos como
 * {{inboundWebhookRequest.telefono}}, {{inboundWebhookRequest.mensaje}}, etc.
 *
 * Configurar en Vercel: GHL_WEBHOOK_URL = la URL del inbound webhook del workflow.
 * Si no está seteada, el WhatsApp simplemente se omite (el email sigue igual).
 *
 * Helper compartido (prefijo `_` → Vercel no lo trata como endpoint).
 */

export interface GhlWhatsAppPayload {
  tipo: 'recordatorio' | 'post-reunion';
  nombre: string;
  telefono: string;
  mensaje: string; // texto ya armado, listo para WhatsApp
  link: string; // enlace principal (a la tarea o a /mi-espacio)
  clientId: string;
  tareas: Array<{ title: string; link: string }>;
}

export interface GhlSendResult {
  ok: boolean;
  skipped?: 'no-url' | 'no-phone';
  error?: string;
}

/** Devuelve true si hay webhook configurado (para no intentar en vano). */
export function ghlConfigured(): boolean {
  return !!process.env.GHL_WEBHOOK_URL;
}

export async function sendWhatsAppViaGHL(payload: GhlWhatsAppPayload): Promise<GhlSendResult> {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) return { ok: false, skipped: 'no-url' };
  if (!payload.telefono || !payload.telefono.trim()) return { ok: false, skipped: 'no-phone' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `${res.status} ${await res.text().catch(() => '')}`.slice(0, 200) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error' };
  }
}
