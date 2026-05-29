import { supabase, usingRemote } from './supabase';
import type { Client } from '@/types/client';
import type { Task } from '@/types/task';
import type { Meeting } from '@/types/meeting';
import type { RopreItem } from '@/types/ropre';
import { seedClients, seedMeetings, seedTasks } from '@/data/seed';
import { useRopreStore } from '@/store/useRopreStore';

/**
 * Repositorios con dos modos de operación:
 *  - REMOTE (cuando `usingRemote` es true) → tabla Supabase
 *  - LOCAL (modo dev, sin env) → lee del seed / store en memoria
 *
 * Los stores Zustand siguen siendo la única fuente de verdad en la UI.
 * Estos repos los hidratan al iniciar la sesión (`bootstrapFromRemote`).
 */

/* ─────────────── CLIENTS ─────────────── */

export const ClientsRepo = {
  async list(agencyId?: string): Promise<Client[]> {
    if (!usingRemote || !supabase) return seedClients;
    const q = supabase.from('clients').select('*');
    const { data, error } = agencyId ? await q.eq('agency_id', agencyId) : await q;
    if (error) throw error;
    return (data ?? []).map(rowToClient);
  },

  async create(client: Client): Promise<Client> {
    if (!usingRemote || !supabase) return client;
    const { data, error } = await supabase.from('clients').insert(clientToRow(client)).select().single();
    if (error) throw error;
    return rowToClient(data);
  },

  async update(id: string, patch: Partial<Client>): Promise<void> {
    if (!usingRemote || !supabase) return;
    const row = clientToRow(patch as Client, true);
    const { error } = await supabase.from('clients').update(row).eq('id', id);
    if (error) throw error;
  },
};

/* ─────────────── TASKS ─────────────── */

export const TasksRepo = {
  async listByClient(clientId: string): Promise<Task[]> {
    if (!usingRemote || !supabase) return seedTasks.filter((t) => t.clientId === clientId);
    const { data, error } = await supabase.from('tasks').select('*').eq('client_id', clientId);
    if (error) throw error;
    return (data ?? []).map(rowToTask);
  },
  async create(task: Task): Promise<Task> {
    if (!usingRemote || !supabase) return task;
    const { data, error } = await supabase.from('tasks').insert(taskToRow(task)).select().single();
    if (error) throw error;
    return rowToTask(data);
  },
  async update(id: string, patch: Partial<Task>): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('tasks').update(taskToRow(patch as Task, true)).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },
};

/* ─────────────── MEETINGS ─────────────── */

export const MeetingsRepo = {
  async listByClient(clientId: string): Promise<Meeting[]> {
    if (!usingRemote || !supabase) return seedMeetings.filter((m) => m.clientId === clientId);
    const { data, error } = await supabase.from('meetings').select('*').eq('client_id', clientId);
    if (error) throw error;
    return (data ?? []).map(rowToMeeting);
  },
  async create(meeting: Meeting): Promise<Meeting> {
    if (!usingRemote || !supabase) return meeting;
    const { data, error } = await supabase.from('meetings').insert(meetingToRow(meeting)).select().single();
    if (error) throw error;
    return rowToMeeting(data);
  },
  async update(id: string, patch: Partial<Meeting>): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('meetings').update(meetingToRow(patch as Meeting, true)).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) throw error;
  },
};

/* ─────────────── ROPRE ─────────────── */

export const RopreRepo = {
  async listByClient(clientId: string): Promise<RopreItem[]> {
    if (!usingRemote || !supabase) return useRopreStore.getState().items.filter((i) => i.clientId === clientId);
    const { data, error } = await supabase.from('ropre_items').select('*').eq('client_id', clientId);
    if (error) throw error;
    return (data ?? []).map(rowToRopre);
  },
  async create(item: RopreItem): Promise<RopreItem> {
    if (!usingRemote || !supabase) return item;
    const { data, error } = await supabase.from('ropre_items').insert(ropreToRow(item)).select().single();
    if (error) throw error;
    return rowToRopre(data);
  },
  async update(id: string, patch: Partial<RopreItem>): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('ropre_items').update(ropreToRow(patch as RopreItem, true)).eq('id', id);
    if (error) throw error;
  },
};

/* ─────────────── Mappers snake_case ↔ camelCase ─────────────── */

function rowToClient(row: Record<string, unknown>): Client {
  const r = row as any;
  return {
    id: r.id,
    agencyId: r.agency_id,
    name: r.name,
    industry: r.industry,
    businessType: r.business_type,
    primaryColor: r.primary_color,
    status: r.status,
    projectType: r.project_type,
    onboardingData: r.onboarding_data ?? {},
    aiBrainData: r.ai_brain_data ?? {},
    metrics: r.metrics ?? { roas: null, pendingTasksToday: 0, nextMeetingAt: null, progressPercent: 0 },
    adsConnected: r.ads_connected ?? { meta: false, google: false, tiktok: false, ga4: false },
    monthlyAdsBudget: Number(r.monthly_ads_budget ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function clientToRow(c: Partial<Client>, partial = false): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const map: Record<keyof Client, string> = {
    id: 'id',
    agencyId: 'agency_id',
    name: 'name',
    industry: 'industry',
    businessType: 'business_type',
    primaryColor: 'primary_color',
    status: 'status',
    projectType: 'project_type',
    onboardingData: 'onboarding_data',
    aiBrainData: 'ai_brain_data',
    metrics: 'metrics',
    adsConnected: 'ads_connected',
    monthlyAdsBudget: 'monthly_ads_budget',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
  for (const key of Object.keys(c) as Array<keyof Client>) {
    if (partial && c[key] === undefined) continue;
    row[map[key]] = c[key];
  }
  return row;
}

function rowToTask(row: Record<string, unknown>): Task {
  const r = row as any;
  return {
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    description: r.description ?? undefined,
    status: r.status,
    priority: r.priority,
    assignedTo: r.assigned_to,
    dueDate: r.due_date,
    completedAt: r.completed_at ?? undefined,
    parentTaskId: r.parent_task_id ?? undefined,
    moduleTag: r.module_tag ?? undefined,
    isDelayed: !!r.is_delayed,
    delayDays: r.delay_days ?? 0,
    createdAt: r.created_at,
  };
}

function taskToRow(t: Partial<Task>, partial = false): Record<string, unknown> {
  const map: Record<keyof Task, string> = {
    id: 'id',
    clientId: 'client_id',
    title: 'title',
    description: 'description',
    status: 'status',
    priority: 'priority',
    assignedTo: 'assigned_to',
    dueDate: 'due_date',
    completedAt: 'completed_at',
    parentTaskId: 'parent_task_id',
    moduleTag: 'module_tag',
    isDelayed: 'is_delayed',
    delayDays: 'delay_days',
    createdAt: 'created_at',
  };
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(t) as Array<keyof Task>) {
    if (partial && t[key] === undefined) continue;
    row[map[key]] = t[key];
  }
  return row;
}

function rowToMeeting(row: Record<string, unknown>): Meeting {
  const r = row as any;
  return {
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    type: r.type,
    scheduledAt: r.scheduled_at,
    durationMin: r.duration_min,
    participants: r.participants ?? [],
    agenda: r.agenda ?? undefined,
    recordingUrl: r.recording_url ?? undefined,
    transcription: r.transcription ?? undefined,
    summary: r.summary ?? undefined,
    extractedTasks: r.extracted_tasks ?? [],
    videoCallLink: r.video_call_link ?? undefined,
    notes: r.notes ?? undefined,
    notesUpdatedAt: r.notes_updated_at ?? undefined,
    completed: r.completed ?? undefined,
  };
}

function meetingToRow(m: Partial<Meeting>, partial = false): Record<string, unknown> {
  const map: Record<keyof Meeting, string> = {
    id: 'id',
    clientId: 'client_id',
    title: 'title',
    type: 'type',
    scheduledAt: 'scheduled_at',
    durationMin: 'duration_min',
    participants: 'participants',
    agenda: 'agenda',
    recordingUrl: 'recording_url',
    transcription: 'transcription',
    summary: 'summary',
    extractedTasks: 'extracted_tasks',
    videoCallLink: 'video_call_link',
    notes: 'notes',
    notesUpdatedAt: 'notes_updated_at',
    completed: 'completed',
  };
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(m) as Array<keyof Meeting>) {
    if (partial && m[key] === undefined) continue;
    row[map[key]] = m[key];
  }
  return row;
}

function rowToRopre(row: Record<string, unknown>): RopreItem {
  const r = row as any;
  return {
    id: r.id,
    clientId: r.client_id,
    type: r.type,
    title: r.title,
    description: r.description ?? undefined,
    riskLevel: r.risk_level ?? undefined,
    mitigation: r.mitigation ?? undefined,
    status: r.status ?? undefined,
    startDate: r.start_date ?? undefined,
    dueDate: r.due_date ?? undefined,
    responsible: r.responsible ?? undefined,
    targetValue: r.target_value ?? undefined,
    currentValue: r.current_value ?? undefined,
    createdAt: r.created_at,
  };
}

function ropreToRow(i: Partial<RopreItem>, partial = false): Record<string, unknown> {
  const map: Record<keyof RopreItem, string> = {
    id: 'id',
    clientId: 'client_id',
    type: 'type',
    title: 'title',
    description: 'description',
    riskLevel: 'risk_level',
    mitigation: 'mitigation',
    status: 'status',
    startDate: 'start_date',
    dueDate: 'due_date',
    responsible: 'responsible',
    targetValue: 'target_value',
    currentValue: 'current_value',
    createdAt: 'created_at',
  };
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(i) as Array<keyof RopreItem>) {
    if (partial && i[key] === undefined) continue;
    row[map[key]] = i[key];
  }
  return row;
}
