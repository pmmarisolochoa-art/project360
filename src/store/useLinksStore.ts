import { create } from 'zustand';
import type { TaskLink, TaskLinkEstado } from '@/services/taskLinks';

interface LinksState {
  links: TaskLink[];
  hydrate: (links: TaskLink[]) => void;
  /** Agrega un link recién creado para que aparezca sin recargar. */
  add: (link: TaskLink) => void;
  /** Refleja el cambio de estado de la revisión del PM. */
  setEstado: (id: string, estado: TaskLinkEstado) => void;
  remove: (id: string) => void;
}

/**
 * Entregables/links subidos a tareas (tabla `task_links`).
 *
 * Es la ÚNICA fuente de verdad de los entregables: la tarea los origina y las
 * tres vistas (detalle de la tarea, espacio del miembro y /links-entregables)
 * leen de aquí. No se copian filas entre tablas — copiarlas es justamente lo
 * que desincronizaría las vistas.
 */
export const useLinksStore = create<LinksState>((set) => ({
  links: [],
  hydrate: (links) => set({ links }),
  add: (link) => set((s) => ({ links: [link, ...s.links] })),
  setEstado: (id, estado) =>
    set((s) => ({ links: s.links.map((l) => (l.id === id ? { ...l, estado } : l)) })),
  remove: (id) => set((s) => ({ links: s.links.filter((l) => l.id !== id) })),
}));
