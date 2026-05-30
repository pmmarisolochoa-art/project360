import { supabase, usingRemote } from './supabase';
import { useClientStore } from '@/store/useClientStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { Client } from '@/types/client';
import type { Task } from '@/types/task';
import type { Meeting } from '@/types/meeting';

/**
 * Llamado al iniciar la app y al cambiar de sesión.
 * Si hay Supabase + agencia del usuario, hidrata clientes/tareas/reuniones
 * filtrados por agency_id. Si no, deja el seed in-memory.
 */
export async function bootstrapFromRemote(): Promise<{ source: 'remote' | 'local' }> {
  if (!usingRemote || !supabase) return { source: 'local' };
  const agencyId = useAuthStore.getState().agencyId;

  try {
    const clientsQuery = supabase.from('clients').select('*');
    const { data: clientsRaw, error: clientsErr } = agencyId
      ? await clientsQuery.eq('agency_id', agencyId)
      : await clientsQuery;
    if (clientsErr) throw clientsErr;

    const clientIds = (clientsRaw ?? []).map((c) => c.id);

    const tasksQuery = supabase.from('tasks').select('*');
    const meetingsQuery = supabase.from('meetings').select('*');

    const [tasksRes, meetingsRes] = await Promise.all([
      clientIds.length > 0 ? tasksQuery.in('client_id', clientIds) : tasksQuery,
      clientIds.length > 0 ? meetingsQuery.in('client_id', clientIds) : meetingsQuery,
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (meetingsRes.error) throw meetingsRes.error;

    const clients: Client[] = (clientsRaw ?? []).map(rowToClient);
    const tasks: Task[] = (tasksRes.data ?? []).map(rowToTask);
    const meetings: Meeting[] = (meetingsRes.data ?? []).map(rowToMeeting);

    if (clients.length > 0) {
      useClientStore.setState({ clients, tasks, meetings });
      // eslint-disable-next-line no-console
      console.info(`[bootstrap] Hidratado desde Supabase: ${clients.length} clientes, ${tasks.length} tareas, ${meetings.length} reuniones.${agencyId ? ` (agency=${agencyId.slice(0, 8)}…)` : ''}`);
    } else {
      // eslint-disable-next-line no-console
      console.info('[bootstrap] Sin clientes en esta agencia — usando seed in-memory.');
    }
    return { source: 'remote' };
  } catch (e) {
    console.warn('[bootstrap] Supabase fetch falló — usando seed local.', e);
    return { source: 'local' };
  }
}

function rowToClient(r: Record<string, unknown>): Client {
  const x = r as Record<string, any>;
  return {
    id: x.id,
    agencyId: x.agency_id,
    name: x.name,
    industry: x.industry,
    businessType: x.business_type,
    primaryColor: x.primary_color,
    status: x.status,
    projectType: x.project_type,
    onboardingData: x.onboarding_data ?? {},
    aiBrainData: x.ai_brain_data ?? {},
    metrics: x.metrics ?? { roas: null, pendingTasksToday: 0, nextMeetingAt: null, progressPercent: 0 },
    adsConnected: x.ads_connected ?? { meta: false, google: false, tiktok: false, ga4: false },
    monthlyAdsBudget: Number(x.monthly_ads_budget ?? 0),
    createdAt: x.created_at,
    updatedAt: x.updated_at,
  };
}

function rowToTask(r: Record<string, unknown>): Task {
  const x = r as Record<string, any>;
  return {
    id: x.id,
    clientId: x.client_id,
    title: x.title,
    description: x.description ?? undefined,
    status: x.status,
    priority: x.priority,
    assignedTo: x.assigned_to,
    dueDate: x.due_date,
    completedAt: x.completed_at ?? undefined,
    parentTaskId: x.parent_task_id ?? undefined,
    moduleTag: x.module_tag ?? undefined,
    isDelayed: !!x.is_delayed,
    delayDays: x.delay_days ?? 0,
    createdAt: x.created_at,
  };
}

function rowToMeeting(r: Record<string, unknown>): Meeting {
  const x = r as Record<string, any>;
  return {
    id: x.id,
    clientId: x.client_id,
    title: x.title,
    type: x.type,
    scheduledAt: x.scheduled_at,
    durationMin: x.duration_min,
    participants: x.participants ?? [],
    agenda: x.agenda ?? undefined,
    recordingUrl: x.recording_url ?? undefined,
    transcription: x.transcription ?? undefined,
    summary: x.summary ?? undefined,
    extractedTasks: x.extracted_tasks ?? [],
    videoCallLink: x.video_call_link ?? undefined,
    notes: x.notes ?? undefined,
    notesUpdatedAt: x.notes_updated_at ?? undefined,
    completed: x.completed ?? undefined,
  };
}
