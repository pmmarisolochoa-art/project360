import { supabase } from './supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import type { RopreItem } from '@/types/ropre';
import { buildRopreReport } from './ropreReport';

export interface SendRopreReportResult {
  sent: number;
  people: number;
  note?: string;
}

/**
 * Genera el informe ROPRE (PDF) y lo envía por correo al equipo del cliente,
 * por el MISMO endpoint que el reporte de reunión: no valida nada específico
 * de reunión y ya autoriza por clientId, así que no hacía falta uno nuevo.
 *
 * Manda `kind: 'ropre'` solo para que el asunto y el cuerpo hablen del ROPRE.
 * Si ese deploy aún no propagó, el backend cae a su default y el correo llega
 * igual — con el texto de reunión, pero llega.
 */
export async function sendRopreReport(
  client: Client,
  items: RopreItem[],
  opts?: { recipients?: string[]; meeting?: Meeting },
): Promise<SendRopreReportResult> {
  if (!supabase) throw new Error('Sin conexión a Supabase.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo.');

  // 1. Arma el PDF (en el navegador). Sin IA: todo va contado desde los items.
  const { base64, fileName, deck } = await buildRopreReport(client, items, { meeting: opts?.meeting });

  const dateLabel = format(new Date(), "d 'de' MMMM yyyy", { locale: es });

  // 2. Envía al backend para adjuntarlo y mandarlo al equipo.
  const res = await fetch('/api/enviar-reporte-reunion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      kind: 'ropre',
      clientId: client.id,
      clientName: client.name,
      meetingTitle: `ROPRE — ${client.name}`,
      deck: deck.slice(0, 400),
      dateLabel,
      pdfBase64: base64,
      fileName,
      recipients: opts?.recipients && opts.recipients.length ? opts.recipients : undefined,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<SendRopreReportResult> & { error?: string };
  if (!res.ok) {
    // 413 = el PDF pesa demasiado para el servidor; otros = error real del backend.
    const hint = res.status === 413 ? 'el PDF pesa demasiado' : `HTTP ${res.status}`;
    throw new Error(data.error || `No se pudo enviar el informe ROPRE (${hint}).`);
  }
  return { sent: data.sent ?? 0, people: data.people ?? 0, note: data.note };
}
