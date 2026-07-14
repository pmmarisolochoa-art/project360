import { supabase } from './supabase';

export interface MeetingTaskToSend {
  id: string;
  title: string;
  assignedTo: string | null;
  dueDate: string | null;
}

export interface SendMeetingTasksResult {
  sent: number;
  whatsapp: number;
  people: number;
  unassigned: number;
  missing?: string[];
  note?: string;
  errors?: string[];
}

/**
 * Post-reunión: manda a cada responsable sus tareas de la reunión vía la Edge
 * Function segura (`/api/enviar-tareas-reunion`). Envía el token de sesión para
 * que el backend confirme el permiso.
 */
export async function sendMeetingTasks(payload: {
  clientId: string;
  meetingTitle?: string; // sin él → recordatorio genérico (desde Tareas)
  tasks: MeetingTaskToSend[];
}): Promise<SendMeetingTasksResult> {
  if (!supabase) throw new Error('Sin conexión a Supabase.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo.');

  const res = await fetch('/api/enviar-tareas-reunion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<SendMeetingTasksResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || 'No se pudieron enviar las tareas.');
  return {
    sent: data.sent ?? 0,
    whatsapp: data.whatsapp ?? 0,
    people: data.people ?? 0,
    unassigned: data.unassigned ?? 0,
    missing: data.missing,
    note: data.note,
    errors: data.errors,
  };
}

/**
 * Recordatorio de tareas (desde el módulo Tareas): manda a cada responsable de
 * las tareas dadas un correo (y WhatsApp si aplica) con sus pendientes. Reusa
 * `sendMeetingTasks` sin `meetingTitle` → el backend usa el texto genérico.
 */
export async function sendTaskReminders(payload: {
  clientId: string;
  tasks: MeetingTaskToSend[];
}): Promise<SendMeetingTasksResult> {
  return sendMeetingTasks({ clientId: payload.clientId, tasks: payload.tasks });
}
