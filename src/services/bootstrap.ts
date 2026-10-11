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
import { useLeadsStore } from '@/store/useLeadsStore';
import { rowToClient, rowToTask, rowToMeeting, ContentRepo, ProjectionsRepo, RopreRepo, TeamRepo, TeamMembersRepo, ProgramsRepo, FunnelLaunchRepo, LeadsRepo, LeadEventsRepo } from './repositories';
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
let sessionVersion = 0;

/** No conservar datos de otra sesión ni datos demo en modo remoto. */
function clearRemoteData(): void {
  useClientStore.setState({ clients: [], tasks: [], meetings: [], hydrated: false });
  useContentStore.setState({ pieces: [] });
  useProjectionStore.setState({ states: {} });
  useRopreStore.setState({ items: [] });
  useTeamStore.setState({ assignments: [] });
  useTeamMembersStore.getState().hydrate([]);
  useProgramsStore.getState().hydrate([]);
  useFunnelLaunchStore.setState({ funnels: [], phases: [] });
  useLinksStore.getState().hydrate([]);
  useLeadsStore.getState().hydrate([], []);
}

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

  if (usingRemote) clearRemoteData();
  const version = ++sessionVersion;
  const promise = runBootstrap(version).catch((e) => {
    // Un fallo no debe quedar cacheado: la próxima llamada reintenta.
    if (lastRun?.key === key) lastRun = null;
    throw e;
  });
  lastRun = { key, promise };
  return promise;
}

/** Limpia la memoria de hidratación (usar al cerrar sesión). */
export function resetBootstrapCache(): void {
  sessionVersion++;
  lastRun = null;
  if (usingRemote) clearRemoteData();
}

async function runBootstrap(version: number): Promise<BootstrapResult> {
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
    // Se imprime como TEXTO, no como array: la consola pliega los arrays y hay
    // que desplegarlos a mano, lo que convertía "léeme esta línea" en otra
    // vuelta de instrucciones.
    console.info(
      '[bootstrap] is_agency crudo del servidor → ' +
        (clientsRaw ?? [])
          .map((c) => {
            const r = c as Record<string, unknown>;
            return `${r.name}=${'is_agency' in r ? String(r.is_agency) : 'COLUMNA AUSENTE'}`;
          })
          .join(' | '),
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
    if (version !== sessionVersion) return { source: 'remote' };
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

    useClientStore.setState({ clients, tasks, meetings });
    if (clients.length > 0) {

      // Hidratar content_pieces y projections en paralelo
      const [contentPieces, projections, ropre, teamAssignments, teamMembers, programs, funnelData, links, leads, leadEvents] = await Promise.all([
        ContentRepo.listByClientIds(clientIds),
        ProjectionsRepo.listByClientIds(clientIds),
        RopreRepo.listByClientIds(clientIds),
        TeamRepo.listByClientIds(clientIds),
        TeamMembersRepo.listByClientIds(clientIds),
        ProgramsRepo.listByClientIds(clientIds),
        FunnelLaunchRepo.listByClientIds(clientIds),
        TaskLinksRepo.listByClientIds(clientIds),
        LeadsRepo.listByClientIds(clientIds),
        LeadEventsRepo.listByClientIds(clientIds),
      ]);
      if (version !== sessionVersion) return { source: 'remote' };
      useContentStore.setState({ pieces: contentPieces });
      useProjectionStore.setState({ states: projections });
      useRopreStore.setState({ items: ropre });
      useTeamStore.setState({ assignments: teamAssignments as never });
      useTeamMembersStore.getState().hydrate(teamMembers);
      useProgramsStore.getState().hydrate(programs);
      useFunnelLaunchStore.setState({ funnels: funnelData.funnels, phases: funnelData.phases });
      useLinksStore.getState().hydrate(links);
      useLeadsStore.getState().hydrate(leads, leadEvents);
      // Se detalla cuántos son Espacio de Agencia: sin ese dato, un problema
      // de "no aparece la opción Personal" obliga a adivinar si el cliente no
      // llegó o si llegó sin su marca. Con esto se distingue de un vistazo.
      const espacios = clients.filter((c) => c.isAgency);
      console.info(
        `[bootstrap] Espacios de agencia: ${espacios.length} → ` +
          (espacios.map((c) => c.name).join(', ') || 'ninguno'),
      );
      console.info(`[bootstrap] Hidratado: ${clients.length} clientes, ${tasks.length} tareas, ${meetings.length} reuniones, ${contentPieces.length} content, ${Object.keys(projections).length} projections, ${ropre.length} ropre, ${teamAssignments.length} team, ${funnelData.funnels.length} funnels, ${links.length} entregables.${agencyId ? ` (agency=${agencyId.slice(0, 8)}…)` : ''}`);
    } else {
      console.info('[bootstrap] Sin clientes accesibles — listas vacías.');
    }
    useClientStore.getState().setHydrated(true);
    return { source: 'remote' };
  } catch (e) {
    if (version === sessionVersion) {
      clearRemoteData();
      useClientStore.getState().setHydrated(true);
    }
    console.warn('[bootstrap] No se pudo cargar Supabase.', e);
    throw e;
  }
}



