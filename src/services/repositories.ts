import { supabase, usingRemote } from './supabase';
import type { Client } from '@/types/client';
import type { Task } from '@/types/task';
import type { Meeting } from '@/types/meeting';
import type { RopreItem } from '@/types/ropre';
import type { ContentPiece } from '@/types/content';
import type { ProjectionState } from '@/types/projection';
import type { Funnel, FunnelPhase } from '@/types/funnel';
import type { TeamMember } from '@/types/teamMember';
import type { TeamRoleSlug } from '@/types/team';
import type { Program } from '@/types/program';
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

  async remove(id: string): Promise<void> {
    if (!usingRemote || !supabase) return;
    // Las tablas hijas (tasks, meetings, funnels, ropre_items, content) tienen
    // FK con ON DELETE CASCADE → todo lo del cliente se borra también.
    const { error } = await supabase.from('clients').delete().eq('id', id);
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
  async listByClientIds(clientIds: string[]): Promise<RopreItem[]> {
    if (!usingRemote || !supabase || clientIds.length === 0) return [];
    const { data, error } = await supabase.from('ropre_items').select('*').in('client_id', clientIds);
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
  async remove(id: string): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('ropre_items').delete().eq('id', id);
    if (error) throw error;
  },
};

/* ─────────────── TEAM (client_team_members) ─────────────── */

export interface TeamAssignmentRow {
  clientId: string;
  roleSlug: string;
  memberName: string;
  bottleneck: string;
  weeklyAchievements: string;
  kpiValues: Record<string, number>;
}

export const TeamRepo = {
  async listByClientIds(clientIds: string[]): Promise<TeamAssignmentRow[]> {
    if (!usingRemote || !supabase || clientIds.length === 0) return [];
    const { data, error } = await supabase.from('client_team_members').select('*').in('client_id', clientIds);
    if (error) throw error;
    return (data ?? []).map(rowToTeam);
  },
  /** Upsert por (client_id, role_slug) — crea o actualiza el assignment. */
  async upsert(a: TeamAssignmentRow): Promise<void> {
    if (!usingRemote || !supabase) return;
    const row = {
      client_id: a.clientId,
      role_slug: a.roleSlug,
      member_name: a.memberName,
      bottleneck: a.bottleneck,
      weekly_achievements: a.weeklyAchievements,
      kpi_values: a.kpiValues,
    };
    const { error } = await supabase.from('client_team_members').upsert(row, { onConflict: 'client_id,role_slug' });
    if (error) throw error;
  },
};

/* ─────────────── TEAM MEMBERS (personas — tabla team_members) ─────────────── */

export const TeamMembersRepo = {
  async listByClientIds(clientIds: string[]): Promise<TeamMember[]> {
    if (!usingRemote || !supabase || clientIds.length === 0) return [];
    const { data, error } = await supabase.from('team_members').select('*').in('client_id', clientIds);
    if (error) throw error;
    return (data ?? []).map(rowToTeamMember);
  },
  async create(m: TeamMember): Promise<TeamMember> {
    if (!usingRemote || !supabase) return m;
    const { data, error } = await supabase.from('team_members').insert(teamMemberToRow(m)).select().single();
    if (error) throw error;
    return rowToTeamMember(data);
  },
  async update(id: string, patch: Partial<TeamMember>): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('team_members').update(teamMemberToRow(patch as TeamMember, true)).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) throw error;
  },
};

function rowToTeamMember(row: Record<string, unknown>): TeamMember {
  const r = row as any;
  return {
    id: r.id,
    clientId: r.client_id,
    nombre: r.nombre,
    rol: r.rol as TeamRoleSlug,
    email: r.email ?? undefined,
    avatarColor: r.avatar_color ?? '#6366F1',
    funciones: Array.isArray(r.funciones) ? r.funciones : [],
    kpis: r.kpis_custom && typeof r.kpis_custom === 'object'
      ? { values: r.kpis_custom.values ?? {}, history: r.kpis_custom.history ?? {}, custom: r.kpis_custom.custom ?? [] }
      : { values: {}, history: {}, custom: [] },
    createdAt: r.created_at,
  };
}

function teamMemberToRow(m: Partial<TeamMember>, partial = false): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (!partial || m.id !== undefined) row.id = m.id;
  if (!partial || m.clientId !== undefined) row.client_id = m.clientId;
  if (!partial || m.nombre !== undefined) row.nombre = m.nombre;
  if (!partial || m.rol !== undefined) row.rol = m.rol;
  if (!partial || m.email !== undefined) row.email = m.email ?? null;
  if (!partial || m.avatarColor !== undefined) row.avatar_color = m.avatarColor;
  if (!partial || m.funciones !== undefined) row.funciones = m.funciones ?? [];
  if (!partial || m.kpis !== undefined) row.kpis_custom = m.kpis ?? { values: {}, history: {}, custom: [] };
  return row;
}

/* ─────────────── PROGRAMS (tabla programs) ─────────────── */

export const ProgramsRepo = {
  async listByClientIds(clientIds: string[]): Promise<Program[]> {
    if (!usingRemote || !supabase || clientIds.length === 0) return [];
    const { data, error } = await supabase.from('programs').select('*').in('client_id', clientIds);
    if (error) throw error;
    return (data ?? []).map(rowToProgram);
  },
  async create(p: Program): Promise<Program> {
    if (!usingRemote || !supabase) return p;
    const { data, error } = await supabase.from('programs').insert(programToRow(p)).select().single();
    if (error) throw error;
    return rowToProgram(data);
  },
  async update(id: string, patch: Partial<Program>): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('programs').update(programToRow(patch as Program, true)).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (error) throw error;
  },
};

function rowToProgram(row: Record<string, unknown>): Program {
  const r = row as any;
  return {
    id: r.id,
    clientId: r.client_id,
    nombre: r.nombre,
    tipo: r.tipo,
    descripcion: r.descripcion ?? undefined,
    fechaInicio: r.fecha_inicio ?? undefined,
    fechaEvento: r.fecha_evento ?? undefined,
    fechaCierre: r.fecha_cierre ?? undefined,
    estado: r.estado ?? 'activo',
    funnelTemplate: r.funnel_template ?? undefined,
    color: r.color ?? undefined,
    createdAt: r.created_at,
  };
}

function programToRow(p: Partial<Program>, partial = false): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (!partial || p.id !== undefined) row.id = p.id;
  if (!partial || p.clientId !== undefined) row.client_id = p.clientId;
  if (!partial || p.nombre !== undefined) row.nombre = p.nombre;
  if (!partial || p.tipo !== undefined) row.tipo = p.tipo;
  if (!partial || p.descripcion !== undefined) row.descripcion = p.descripcion ?? null;
  if (!partial || p.fechaInicio !== undefined) row.fecha_inicio = p.fechaInicio ?? null;
  if (!partial || p.fechaEvento !== undefined) row.fecha_evento = p.fechaEvento ?? null;
  if (!partial || p.fechaCierre !== undefined) row.fecha_cierre = p.fechaCierre ?? null;
  if (!partial || p.estado !== undefined) row.estado = p.estado;
  if (!partial || p.funnelTemplate !== undefined) row.funnel_template = p.funnelTemplate ?? null;
  if (!partial || p.color !== undefined) row.color = p.color ?? null;
  return row;
}

/* ─────────────── CONTENT PIECES ─────────────── */

export const ContentRepo = {
  async listByClient(clientId: string): Promise<ContentPiece[]> {
    if (!usingRemote || !supabase) return [];
    const { data, error } = await supabase.from('content_pieces').select('*').eq('client_id', clientId);
    if (error) throw error;
    return (data ?? []).map(rowToContent);
  },
  async listByClientIds(clientIds: string[]): Promise<ContentPiece[]> {
    if (!usingRemote || !supabase || clientIds.length === 0) return [];
    const { data, error } = await supabase.from('content_pieces').select('*').in('client_id', clientIds);
    if (error) throw error;
    return (data ?? []).map(rowToContent);
  },
  async create(piece: ContentPiece): Promise<ContentPiece> {
    if (!usingRemote || !supabase) return piece;
    const { data, error } = await supabase.from('content_pieces').insert(contentToRow(piece)).select().single();
    if (error) throw error;
    return rowToContent(data);
  },
  async update(id: string, patch: Partial<ContentPiece>): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('content_pieces').update(contentToRow(patch as ContentPiece, true)).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error } = await supabase.from('content_pieces').delete().eq('id', id);
    if (error) throw error;
  },
};

/* ─────────────── PROJECTIONS ─────────────── */

export const ProjectionsRepo = {
  async listByClientIds(clientIds: string[]): Promise<Record<string, ProjectionState>> {
    if (!usingRemote || !supabase || clientIds.length === 0) return {};
    const { data, error } = await supabase.from('projections').select('*').in('client_id', clientIds);
    if (error) throw error;
    const out: Record<string, ProjectionState> = {};
    (data ?? []).forEach((r: Record<string, unknown>) => {
      const state = rowToProjection(r);
      out[state.clientId] = state;
    });
    return out;
  },
  /** Upsert: crea o actualiza el state de una agencia/cliente. */
  async save(state: ProjectionState): Promise<void> {
    if (!usingRemote || !supabase) return;
    const row = projectionToRow(state);
    const { error } = await supabase.from('projections').upsert(row, { onConflict: 'client_id' });
    if (error) throw error;
  },
};

/* ─────────────── FUNNEL LAUNCH (embudos con fases) ─────────────── */

export const FunnelLaunchRepo = {
  async listByClientIds(clientIds: string[]): Promise<{ funnels: Funnel[]; phases: FunnelPhase[] }> {
    if (!usingRemote || !supabase || clientIds.length === 0) return { funnels: [], phases: [] };
    const { data: fData, error: fErr } = await supabase.from('funnels').select('*').in('client_id', clientIds);
    if (fErr) throw fErr;
    const funnels = (fData ?? []).map(rowToFunnel);
    if (funnels.length === 0) return { funnels, phases: [] };
    const { data: pData, error: pErr } = await supabase.from('funnel_phases').select('*').in('funnel_id', funnels.map((f) => f.id));
    if (pErr) throw pErr;
    const phases = (pData ?? []).map(rowToFunnelPhase);
    return { funnels, phases };
  },
  async create(funnel: Funnel, phases: FunnelPhase[]): Promise<void> {
    if (!usingRemote || !supabase) return;
    const { error: fErr } = await supabase.from('funnels').insert(funnelToRow(funnel));
    if (fErr) throw fErr;
    if (phases.length > 0) {
      const { error: pErr } = await supabase.from('funnel_phases').insert(phases.map(funnelPhaseToRow));
      if (pErr) throw pErr;
    }
  },
  async update(id: string, patch: Partial<Funnel>): Promise<void> {
    if (!usingRemote || !supabase) return;
    const row = funnelToRow(patch, true);
    const { error } = await supabase.from('funnels').update(row).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    if (!usingRemote || !supabase) return;
    // Las fases se borran en cascada por FK.
    const { error } = await supabase.from('funnels').delete().eq('id', id);
    if (error) throw error;
  },
  /**
   * Llamada pública (anon) desde el portal cliente.
   * Usa RPC SECURITY DEFINER que devuelve { funnel, phases, tasks, client } o null.
   */
  async getByShareToken(token: string): Promise<{
    funnel: Funnel;
    phases: FunnelPhase[];
    tasks: Array<{ id: string; title: string; status: string; priority: string; phaseId: string; funnelId: string; dueDate: string; startDate?: string }>;
    client: { id: string; name: string; primaryColor: string };
  } | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_funnel_by_share_token', { p_token: token });
    if (error) {
      console.warn('[funnel.getByShareToken]', error);
      return null;
    }
    if (!data) return null;
    const d = data as Record<string, any>;
    if (!d.funnel) return null;
    return {
      funnel: rowToFunnel(d.funnel),
      phases: (d.phases ?? []).map(rowToFunnelPhase),
      tasks: (d.tasks ?? []).map((t: Record<string, any>) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        phaseId: t.phase_id,
        funnelId: t.funnel_id,
        dueDate: t.due_date,
        startDate: t.start_date ?? undefined,
      })),
      client: {
        id: d.client.id,
        name: d.client.name,
        primaryColor: d.client.primary_color,
      },
    };
  },
};

function rowToFunnel(row: Record<string, unknown>): Funnel {
  const r = row as Record<string, any>;
  return {
    id: r.id,
    clientId: r.client_id,
    templateKey: r.template_key,
    name: r.name,
    status: r.status,
    startDate: r.start_date,
    eventDate: r.event_date ?? undefined,
    endDate: r.end_date ?? undefined,
    shareToken: r.share_token ?? '',
    programId: r.program_id ?? undefined,
    createdAt: r.created_at,
  };
}

function funnelToRow(f: Partial<Funnel>, partial = false): Record<string, unknown> {
  const map: Record<keyof Funnel, string> = {
    id: 'id',
    clientId: 'client_id',
    templateKey: 'template_key',
    name: 'name',
    status: 'status',
    startDate: 'start_date',
    eventDate: 'event_date',
    endDate: 'end_date',
    shareToken: 'share_token',
    programId: 'program_id',
    createdAt: 'created_at',
  };
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(f) as Array<keyof Funnel>) {
    if (partial && f[key] === undefined) continue;
    row[map[key]] = f[key];
  }
  return row;
}

function rowToFunnelPhase(row: Record<string, unknown>): FunnelPhase {
  const r = row as Record<string, any>;
  return {
    id: r.id,
    funnelId: r.funnel_id,
    order: r.order_idx,
    name: r.name,
    color: r.color,
    dayStart: r.day_start,
    dayEnd: r.day_end,
  };
}

function funnelPhaseToRow(p: FunnelPhase): Record<string, unknown> {
  return {
    id: p.id,
    funnel_id: p.funnelId,
    order_idx: p.order,
    name: p.name,
    color: p.color,
    day_start: p.dayStart,
    day_end: p.dayEnd,
  };
}

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
    activeFunnelId: r.active_funnel_id ?? undefined,
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
    activeFunnelId: 'active_funnel_id',
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
    input: r.input ?? undefined,
    output: r.output ?? undefined,
    dependsOn: r.depends_on ?? undefined,
    startDate: r.start_date ?? undefined,
    origin: r.origin ?? undefined,
    subtasks: r.subtasks ?? [],
    comments: r.comments ?? [],
    tag: r.tag ?? undefined,
    driveLink: r.drive_link ?? undefined,
    funnelId: r.funnel_id ?? undefined,
    phaseId: r.phase_id ?? undefined,
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
    input: 'input',
    output: 'output',
    dependsOn: 'depends_on',
    startDate: 'start_date',
    origin: 'origin',
    subtasks: 'subtasks',
    comments: 'comments',
    tag: 'tag',
    driveLink: 'drive_link',
    funnelId: 'funnel_id',
    phaseId: 'phase_id',
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
    linkedTaskId: r.linked_task_id ?? undefined,
    lastEditedInMeetingId: r.last_edited_in_meeting_id ?? undefined,
    lastEditedAt: r.last_edited_at ?? undefined,
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
    linkedTaskId: 'linked_task_id',
    lastEditedInMeetingId: 'last_edited_in_meeting_id',
    lastEditedAt: 'last_edited_at',
    createdAt: 'created_at',
  };
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(i) as Array<keyof RopreItem>) {
    if (partial && i[key] === undefined) continue;
    row[map[key]] = i[key];
  }
  return row;
}

function rowToContent(row: Record<string, unknown>): ContentPiece {
  const r = row as any;
  return {
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    platform: r.platform,
    format: r.format,
    ctaType: r.cta_type ?? undefined,
    script: r.script ?? undefined,
    caption: r.caption ?? undefined,
    roleSlug: r.role_slug ?? undefined,
    assignedTo: r.assigned_to ?? undefined,
    copyText: r.copy_text ?? '',
    mediaUrl: r.media_url ?? undefined,
    productionNotes: r.production_notes ?? undefined,
    approvalNotes: r.approval_notes ?? undefined,
    status: r.status,
    approval: r.approval,
    recordingDate: r.recording_date ?? undefined,
    editingDate: r.editing_date ?? undefined,
    approvalDate: r.approval_date ?? undefined,
    publishDate: r.publish_date ?? undefined,
    hasLeadMagnet: !!r.has_lead_magnet,
    leadMagnetDescription: r.lead_magnet_description ?? undefined,
    createdBy: r.created_by ?? undefined,
    approvedBy: r.approved_by ?? undefined,
    createdAt: r.created_at,
  };
}

function contentToRow(c: Partial<ContentPiece>, partial = false): Record<string, unknown> {
  const map: Record<keyof ContentPiece, string> = {
    id: 'id',
    clientId: 'client_id',
    title: 'title',
    platform: 'platform',
    format: 'format',
    ctaType: 'cta_type',
    script: 'script',
    caption: 'caption',
    roleSlug: 'role_slug',
    assignedTo: 'assigned_to',
    copyText: 'copy_text',
    mediaUrl: 'media_url',
    productionNotes: 'production_notes',
    approvalNotes: 'approval_notes',
    status: 'status',
    approval: 'approval',
    recordingDate: 'recording_date',
    editingDate: 'editing_date',
    approvalDate: 'approval_date',
    publishDate: 'publish_date',
    hasLeadMagnet: 'has_lead_magnet',
    leadMagnetDescription: 'lead_magnet_description',
    createdBy: 'created_by',
    approvedBy: 'approved_by',
    createdAt: 'created_at',
  };
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(c) as Array<keyof ContentPiece>) {
    if (partial && c[key] === undefined) continue;
    row[map[key]] = c[key];
  }
  return row;
}

function rowToProjection(row: Record<string, unknown>): ProjectionState {
  const r = row as any;
  return {
    clientId: r.client_id,
    funnel: r.funnel_inputs ?? {},
    activeScenario: r.active_scenario ?? 'realistic',
    phases: r.phases ?? [],
    okrs: r.okrs ?? [],
    successIndicators: r.success_indicators ?? [],
    benchmarksOverride: r.benchmarks_override ?? {},
    market: r.market_sizing ?? { tam: 0, sam: 0, somPercent: 0 },
    investment: r.investment_lines ?? [],
    durationMonths: r.duration_months ?? 12,
    debriefing: r.debriefing ?? {},
  };
}

function projectionToRow(s: ProjectionState): Record<string, unknown> {
  return {
    client_id: s.clientId,
    funnel_inputs: s.funnel,
    active_scenario: s.activeScenario,
    phases: s.phases,
    okrs: s.okrs,
    success_indicators: s.successIndicators,
    benchmarks_override: s.benchmarksOverride,
    market_sizing: s.market,
    investment_lines: s.investment,
    duration_months: s.durationMonths,
    debriefing: s.debriefing,
    updated_at: new Date().toISOString(),
  };
}

function rowToTeam(row: Record<string, unknown>): TeamAssignmentRow {
  const r = row as any;
  return {
    clientId: r.client_id,
    roleSlug: r.role_slug,
    memberName: r.member_name,
    bottleneck: r.bottleneck ?? '',
    weeklyAchievements: r.weekly_achievements ?? '',
    kpiValues: r.kpi_values ?? {},
  };
}
