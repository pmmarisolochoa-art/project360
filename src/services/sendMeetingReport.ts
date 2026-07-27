import { supabase } from './supabase';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import { buildReportFromMeeting, type Commitment } from './meetingReportEditorial';

export interface SendMeetingReportResult {
  sent: number;
  people: number;
  note?: string;
}

/**
 * Genera el reporte editorial (PDF) de una reunión y lo envía por correo a todo
 * el equipo del cliente vía la Edge Function segura. Devuelve cuántos correos
 * salieron. No lanza si no hay destinatarios — devuelve `note` para avisar.
 */
export async function sendMeetingReport(
  client: Client,
  meeting: Meeting,
  commitments?: Commitment[],
): Promise<SendMeetingReportResult> {
  if (!supabase) throw new Error('Sin conexión a Supabase.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo.');

  // 1. Sintetiza con IA + arma el PDF (en el navegador).
  const { base64, fileName } = await buildReportFromMeeting(client, meeting, commitments);

  // 2. Reconstruye un deck corto para el cuerpo del correo (best-effort).
  const dateLabel = format(parseISO(meeting.scheduledAt), "d 'de' MMMM yyyy", { locale: es });

  // 3. Envía al backend para adjuntarlo y mandarlo al equipo.
  const res = await fetch('/api/enviar-reporte-reunion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId: client.id,
      clientName: client.name,
      meetingTitle: meeting.title,
      deck: (meeting.summary || '').slice(0, 400),
      dateLabel,
      pdfBase64: base64,
      fileName,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<SendMeetingReportResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || 'No se pudo enviar el reporte.');
  return { sent: data.sent ?? 0, people: data.people ?? 0, note: data.note };
}
