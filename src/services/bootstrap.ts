import { supabase, usingRemote } from './supabase';
import { useClientStore } from '@/store/useClientStore';
import { useContentStore } from '@/store/useContentStore';
import { useProjectionStore } from '@/store/useProjectionStore';
import { useRopreStore } from '@/store/useRopreStore';
import { useTeamStore } from '@/store/useTeamStore';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { useProgramsStore } from '@/store/useProgramsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { useLinksStore } from '@/store/useLinksStore';
import { ContentRepo, ProjectionsRepo, RopreRepo, TeamRepo, TeamMembersRepo, ProgramsRepo, FunnelLaunchRepo } from './repositories';
import { TaskLinksRepo } from './taskLinks';
import type { Client } from '@/types/client';
import type { Task } from '@/types/task';
import type { Meeting } from '@/types/meeting';

type BootstrapResult = { source: 'remote' | 'local' };

/**
 * Última hidratación por contexto de sesión. El efecto que llama a
 * `bootstrapFromRemote` se dispara varias veces mientras el contexto de auth se
 * resuelve (y dos veces más por StrictMode en dev), lo que provocaba 4 rondas
 * completas de queries a Supabase por carga de página. Guardamos la promesa por
 * contexto para que las llamadas repetidas reusen la misma.
 */
let lastRun: { key: string; promise: Promise<BootstrapResult> } | null = null;

/**
 * Llamado al iniciar la app y al cambiar de sesión.
 * Si hay Supabase + agencia del usuario, hidrata clientes/tareas/reuniones
 * filtrados por agency_id. Si no, deja el seed in-memory.
 *
 * Idempotente por contexto de sesión: llamarlo N veces con el mismo
 * usuario+agencia hace UNA sola ronda de queries. Al cambiar de sesión la clave
 * cambia y vuelve a hidratar.
 */
export function bootstrapFromRemote(): Promise<BootstrapResult> {
  const { user, agencyId } = useAuthStore.getState();
  const key = `${user?.id ?? 'anon'}:${agencyId ?? 'none'}`;

  if (lastRun?.key === key) return lastRun.promise;

  const promise = runBootstrap().catch((e) => {
    // Un fallo no debe quedar cacheado: la próxima llamada reintenta.
    if (lastRun?.key === key) lastRun = null;
    throw e;
  });
  lastRun = { key, promise };
  return promise;
}

/** Limpia la memoria de hidratación (usar al cerrar sesión). */
export function resetBootstrapCache(): void {
  lastRun = null;
}

async function runBootstrap(): Promise<BootstrapResult> {
  if (!usingRemote || !supabase) {
    useClientStore.getState().setHydrated(true); // modo local: el seed ES la data
    return { source: 'local' };
  }
  const agencyId = useAuthStore.getState().agencyId;

  try {
    const clientsQuery = supabase.from('clients').select('*');
    const { data: clientsRaw, error: clientsErr } = agencyId
      ? await clientsQuery.eq('agency_id', agencyId)
      : await clientsQuery;
    if (clientsErr) throw clientsErr;

    const clientIds = (clientsRaw ?? []).map((c) => c.id);

    // Diagnóstico: qué manda el SERVIDOR para `is_agency`, antes de traducir la
    // fila. Distingue tres casos que desde fuera se ven idénticos —el servidor
    // manda false, no manda la columna, o la manda bien y la app la pierde al
    // traducir— y que costaron media tarde de idas y vueltas por el navegador.
    console.info(
      '[bootstrap] is_agency crudo del servidor:',
      (clientsRaw ?? []).map((c) => {
        const r = c as Record<string, unknown>;
        return `${r.name}: ${'is_agency' in r ? String(r.is_agency) : 'LA COLUMNA NO VIENE'}`;
      }),
    );

    const tasksQuery = supabase.from('tasks').select('*');
    const meetingsQuery = supabase.from('meetings').select('*');

    /**
     * Tercera consulta: MIS filas privadas, cuelguen de donde cuelguen.
     *
     * Las dos de arriba piden "lo de mis clientes". Una tarea PERSONAL se
     * guarda en el Espacio de Agencia, y un miembro del equipo no es miembro de
     * ese espacio — así que su propia tarea personal no entraba por ningún
     * lado: se guardaba bien y al recargar no volvía nunca. Parecía que se
     * perdía.
     *
     * Se pide por `propietario_id`, no por cliente. Las policies ya garantizan
     * que solo puede devolver filas de quien pregunta (`tasks_propias_privadas`,
     * migración 036), así que esta consulta no puede traer nada ajeno.
     */
    const userId = useAuthStore.getState().user?.id;
    const misPrivadasQuery = userId
      ? supabase.from('tasks').select('*').eq('propietario_id', userId).eq('es_privada', true)
      : null;

    const [tasksRes, meetingsRes, privadasRes] = await Promise.all([
      clientIds.length > 0 ? tasksQuery.in('client_id', clientIds) : tasksQuery,
      clientIds.length > 0 ? meetingsQuery.in('client_id', clientIds) : meetingsQuery,
      misPrivadasQuery,
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (meetingsRes.error) throw meetingsRes.error;
    // Las privadas son un extra: si esta consulta falla, la app sigue
    // funcionando con todo lo demás en vez de quedarse en blanco.
    if (privadasRes?.error) console.warn('[bootstrap] no se pudieron cargar las tareas privadas', privadasRes.error);

    const clients: Client[] = (clientsRaw ?? []).map(rowToClient);

    // Se unen las dos fuentes sin duplicar: una tarea privada de un cliente al
    // que SÍ pertenece viene por los dos caminos.
    const filasTareas = [...(tasksRes.data ?? []), ...(privadasRes?.data ?? [])];
    const vistas = new Set<string>();
    const tasks: Task[] = filasTareas
      .filter((r) => {
        const id = (r as { id: string }).id;
        if (vistas.has(id)) return false;
        vistas.add(id);
        return true;
      })
      .map(rowToTask);
    const meetings: Meeting[] = (meetingsRes.data ?? []).map(rowToMeeting);

    if (clients.length > 0) {
      useClientStore.setState({ clients, tasks, meetings });

      // Hidratar content_pieces y projections en paralelo
      try {
        const [contentPieces, projections, ropre, teamAssignments, teamMembers, programs, funnelData, links] = await Promise.all([
          ContentRepo.listByClientIds(clientIds),
          ProjectionsRepo.listByClientIds(clientIds),
          RopreRepo.listByClientIds(clientIds),
          TeamRepo.listByClientIds(clientIds),
          TeamMembersRepo.listByClientIds(clientIds),
          ProgramsRepo.listByClientIds(clientIds),
          FunnelLaunchRepo.listByClientIds(clientIds),
          TaskLinksRepo.listByClientIds(clientIds),
        ]);
        if (contentPieces.length > 0) useContentStore.setState({ pieces: contentPieces });
        if (Object.keys(projections).length > 0) useProjectionStore.setState({ states: projections });
        if (ropre.length > 0) useRopreStore.setState({ items: ropre });
        if (teamAssignments.length > 0) useTeamStore.setState({ assignments: teamAssignments as never });
        if (teamMembers.length > 0) useTeamMembersStore.getState().hydrate(teamMembers);
        if (programs.length > 0) useProgramsStore.getState().hydrate(programs);
        if (funnelData.funnels.length > 0) useFunnelLaunchStore.setState({ funnels: funnelData.funnels, phases: funnelData.phases });
        if (links.length > 0) useLinksStore.getState().hydrate(links);
        // Se detalla cuántos son Espacio de Agencia: sin ese dato, un problema
        // de "no aparece la opción Personal" obliga a adivinar si el cliente no
        // llegó o si llegó sin su marca. Con esto se distingue de un vistazo.
        const espacios = clients.filter((c) => c.isAgency);
        console.info(
          `[bootstrap] Espacios de agencia: ${espacios.length}`,
          espacios.map((c) => `${c.name} (isAgency=${c.isAgency})`),
        );
        console.info(`[bootstrap] Hidratado: ${clients.length} clientes, ${tasks.length} tareas, ${meetings.length} reuniones, ${contentPieces.length} content, ${Object.keys(projections).length} projections, ${ropre.length} ropre, ${teamAssignments.length} team, ${funnelData.funnels.length} funnels.${agencyId ? ` (agency=${agencyId.slice(0, 8)}…)` : ''}`);
      } catch (e) {
        console.warn('[bootstrap] Falló hidratación parcial — UI usa estado local.', e);
      }
    } else {
      console.info('[bootstrap] Sin clientes en esta agencia — usando seed in-memory.');
    }
    useClientStore.getState().setHydrated(true);
    return { source: 'remote' };
  } catch (e) {
    console.warn('[bootstrap] Supabase fetch falló — usando seed local.', e);
    useClientStore.getState().setHydrated(true);
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
    input: x.input ?? undefined,
    output: x.output ?? undefined,
    driveLink: x.drive_link ?? undefined,
    dependsOn: x.depends_on ?? undefined,
    startDate: x.start_date ?? undefined,
    origin: x.origin ?? undefined,
    subtasks: x.subtasks ?? [],
    comments: x.comments ?? [],
    tag: x.tag ?? undefined,
    funnelId: x.funnel_id ?? undefined,
    phaseId: x.phase_id ?? undefined,
    kpiNombre: x.kpi_nombre ?? undefined,
    kpiMeta: x.kpi_meta ?? undefined,
    kpiResultado: x.kpi_resultado ?? undefined,
    kpiTipo: x.kpi_tipo ?? undefined,
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
