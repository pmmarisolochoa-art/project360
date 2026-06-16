import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Funnel, FunnelPhase, FunnelTemplate, FunnelStatus } from '@/types/funnel';
import type { Task } from '@/types/task';
import { getTemplate } from '@/data/funnelTemplates';
import { useClientStore } from '@/store/useClientStore';
import { FunnelLaunchRepo, TasksRepo } from '@/services/repositories';
import { genId } from '@/utils/id';
import { resolveAssignee } from '@/utils/roleResolver';

/**
 * Store del sistema de Embudos de Lanzamiento (Funnel + Phases).
 *
 * Distinto del useFunnelStore existente, que maneja diagramas de funnel
 * (nodos + edges). Este maneja embudos de lanzamiento con fases y tareas.
 */

interface FunnelLaunchState {
  funnels: Funnel[];
  phases: FunnelPhase[];

  byClient: (clientId: string) => Funnel[];
  phasesByFunnel: (funnelId: string) => FunnelPhase[];

  activateFromTemplate: (clientId: string, templateKey: string, startDate: Date, customName?: string) => Funnel | null;
  // Versión para plantillas armadas a mano por el PM (o importadas).
  activateFromCustom: (clientId: string, template: FunnelTemplate, startDate: Date, customName?: string) => Funnel | null;
  update: (id: string, patch: Partial<Funnel>) => void;
  remove: (id: string) => void;
  setStatus: (id: string, status: FunnelStatus) => void;
}

export const useFunnelLaunchStore = create<FunnelLaunchState>()(
  persist(
    (set, get) => ({
      funnels: [],
      phases: [],

      byClient: (clientId) => get().funnels.filter((f) => f.clientId === clientId),
      phasesByFunnel: (funnelId) => get().phases.filter((p) => p.funnelId === funnelId).sort((a, b) => a.order - b.order),

      activateFromTemplate: (clientId, templateKey, startDate, customName) => {
        const template = getTemplate(templateKey);
        if (!template) {
          console.warn('[funnel.activate] template no existe', templateKey);
          return null;
        }
        return materializeFromTemplate(set, clientId, template, startDate, customName);
      },

      activateFromCustom: (clientId, template, startDate, customName) => {
        return materializeFromTemplate(set, clientId, template, startDate, customName);
      },

      update: (id, patch) => {
        set((s) => ({ funnels: s.funnels.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
        void FunnelLaunchRepo.update(id, patch).catch((e) => console.warn('[funnel.update]', e));
      },

      setStatus: (id, status) => {
        set((s) => ({ funnels: s.funnels.map((f) => (f.id === id ? { ...f, status } : f)) }));
        void FunnelLaunchRepo.update(id, { status }).catch((e) => console.warn('[funnel.setStatus]', e));
      },

      remove: (id) => {
        set((s) => ({
          funnels: s.funnels.filter((f) => f.id !== id),
          phases: s.phases.filter((p) => p.funnelId !== id),
        }));
        void FunnelLaunchRepo.remove(id).catch((e) => console.warn('[funnel.remove]', e));
      },
    }),
    {
      name: 'p360.funnels',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Solo persistimos los datos, no las funciones
      partialize: (state) => ({ funnels: state.funnels, phases: state.phases }),
      // Si la rehidratación falla (datos corruptos), no crashea — empieza vacío.
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('[funnels.persist] rehidratación falló, reset', error);
          try { localStorage.removeItem('p360.funnels'); } catch { /* noop */ }
        }
      },
    },
  ),
);

/**
 * Materializa una plantilla: crea el funnel, las fases y las tareas
 * en useClientStore (fire-and-forget a Supabase). Devuelve el funnel creado.
 */
function materializeFromTemplate(
  set: (fn: (s: FunnelLaunchState) => Partial<FunnelLaunchState>) => void,
  clientId: string,
  template: FunnelTemplate,
  startDate: Date,
  customName?: string,
): Funnel {
  const funnelId = genId();
  const now = new Date().toISOString();
  const startISO = startDate.toISOString();
  const endDate = new Date(startDate.getTime() + template.estimatedDays.max * 86400000);

  const funnel: Funnel = {
    id: funnelId,
    clientId,
    templateKey: template.key,
    name: customName ?? template.name,
    status: 'planning',
    startDate: startISO,
    endDate: endDate.toISOString(),
    shareToken: genId(),
    createdAt: now,
  };

  const phases: FunnelPhase[] = template.phases.map((p, i) => ({
    id: genId(),
    funnelId,
    order: i + 1,
    name: p.name,
    color: p.color,
    dayStart: p.dayStart,
    dayEnd: p.dayEnd,
  }));

  // CRÍTICO: agregar funnel + phases AL ESTADO ANTES de las tareas.
  // Si las tareas entran al estado primero, referencias funnelId/phaseId
  // que no existen → cualquier componente que dereferencia el funnel/fase
  // explota → pantalla en blanco.
  set((s) => ({
    funnels: [funnel, ...s.funnels],
    phases: [...s.phases, ...phases],
  }));

  // Pre-construir TODAS las tareas en memoria (no agregarlas todavía).
  const allTasks: Task[] = [];
  for (let pIdx = 0; pIdx < template.phases.length; pIdx++) {
    const tplPhase = template.phases[pIdx];
    const phase = phases[pIdx];
    for (const tplTask of tplPhase.tasks) {
      const dueDate = new Date(startDate.getTime() + tplTask.dayEnd * 86400000);
      dueDate.setHours(10, 0, 0, 0);
      allTasks.push({
        id: genId(),
        clientId,
        title: tplTask.title,
        description: tplTask.input || tplTask.output
          ? [tplTask.input ? `Input: ${tplTask.input}` : null, tplTask.output ? `Output: ${tplTask.output}` : null].filter(Boolean).join('\n')
          : undefined,
        status: 'pending',
        priority: tplTask.priority ?? 'P2',
        assignedTo: resolveAssignee(tplTask.responsibleRole, clientId),
        dueDate: dueDate.toISOString(),
        startDate: new Date(startDate.getTime() + tplTask.dayStart * 86400000).toISOString(),
        isDelayed: false,
        delayDays: 0,
        moduleTag: 'funnel',
        // Marca como 'deliverable' si la plantilla lo flagueó; si no, hereda
        // 'strategy' como categoría neutra (filtrable en el board).
        tag: tplTask.isDeliverable ? 'deliverable' : 'strategy',
        input: tplTask.input,
        output: tplTask.output,
        funnelId,
        phaseId: phase.id,
        createdAt: now,
      });
    }
  }

  // Persistencia en Supabase con orden correcto: funnel + phases PRIMERO
  // (await), después tareas en paralelo. Sin esto, las tareas tiran 409 FK.
  void (async () => {
    try {
      await FunnelLaunchRepo.create(funnel, phases);
    } catch (e) {
      console.warn('[funnel.create]', e);
      // Funnel falló: agregamos tareas SOLO al estado local para que la UI
      // funcione, sin intentar Supabase (FK violation garantizada).
      useClientStore.setState((s) => ({ tasks: [...allTasks, ...s.tasks] }));
      return;
    }
    // Funnel OK en Supabase. Una sola actualización de estado (no 32) +
    // fire-and-forget para cada tarea en paralelo.
    useClientStore.setState((s) => ({ tasks: [...allTasks, ...s.tasks] }));
    for (const t of allTasks) {
      void TasksRepo.create(t).catch((e) => console.warn('[tasks.create]', e));
    }
  })();

  return funnel;
}
