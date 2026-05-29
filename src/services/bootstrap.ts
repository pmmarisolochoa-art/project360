import { supabase, usingRemote } from './supabase';
import { useClientStore } from '@/store/useClientStore';
import type { Client } from '@/types/client';
import type { Task } from '@/types/task';
import type { Meeting } from '@/types/meeting';

/**
 * Llamado al iniciar la app. Si hay Supabase configurado, hidrata los stores
 * con clientes + tareas + reuniones remotos; si no, deja el seed in-memory.
 *
 * Si Supabase está configurado pero falla (tabla vacía, error de red),
 * cae a modo local sin romper la app.
 */
export async function bootstrapFromRemote(): Promise<{ source: 'remote' | 'local' }> {
  if (!usingRemote || !supabase) return { source: 'local' };
  try {
    const [clientsRes, tasksRes, meetingsRes] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('meetings').select('*'),
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (meetingsRes.error) throw meetingsRes.error;

    const clients: Client[] = (clientsRes.data ?? []).map((r: Record<string, unknown>) => {
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
    });

    const tasks: Task[] = (tasksRes.data ?? []).map((r: Record<string, unknown>) => {
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
    });

    const meetings: Meeting[] = (meetingsRes.data ?? []).map((r: Record<string, unknown>) => {
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
    });

    if (clients.length > 0) {
      useClientStore.setState({ clients, tasks, meetings });
      // eslint-disable-next-line no-console
      console.info(`[bootstrap] Hidratado desde Supabase: ${clients.length} clientes, ${tasks.length} tareas, ${meetings.length} reuniones.`);
    } else {
      // eslint-disable-next-line no-console
      console.info('[bootstrap] Supabase conectado pero sin datos — usando seed in-memory.');
    }
    return { source: 'remote' };
  } catch (e) {
    console.warn('[bootstrap] Supabase fetch falló — usando seed local.', e);
    return { source: 'local' };
  }
}
