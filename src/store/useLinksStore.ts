import { create } from 'zustand';
import type { TaskLink } from '@/services/taskLinks';

interface LinksState {
  links: TaskLink[];
  hydrate: (links: TaskLink[]) => void;
}

/** Entregables/links subidos a tareas (tabla task_links). Cargados en bootstrap
 *  para poder buscarlos globalmente. */
export const useLinksStore = create<LinksState>((set) => ({
  links: [],
  hydrate: (links) => set({ links }),
}));
