import { onWriteError } from './onWriteError';
import { altaOptimista, cambioOptimista, bajaOptimista } from './escrituraOptimista';
import { create } from 'zustand';
import type { Program } from '@/types/program';
import { ProgramsRepo } from '@/services/repositories';

interface ProgramsState {
  programs: Program[];
  hydrate: (programs: Program[]) => void;
  add: (program: Program) => void;
  update: (id: string, patch: Partial<Program>) => void;
  remove: (id: string) => void;
  byClient: (clientId: string) => Program[];
}

export const useProgramsStore = create<ProgramsState>((set, get) => ({
  programs: [],

  hydrate: (programs) => set({ programs }),

  add: (program) => {
    const revertir = altaOptimista(() => get().programs, (programs) => set({ programs }), program);
    void ProgramsRepo.create(program).catch(onWriteError('programs.create', 'No se pudo guardar el programa. Se quitó de la lista: vuelve a intentarlo.', revertir));
  },

  update: (id, patch) => {
    const revertir = cambioOptimista(() => get().programs, (programs) => set({ programs }), id, patch);
    void ProgramsRepo.update(id, patch).catch(onWriteError('programs.update', 'No se pudieron guardar los cambios del programa. Se deshicieron en pantalla.', revertir));
  },

  remove: (id) => {
    const revertir = bajaOptimista(() => get().programs, (programs) => set({ programs }), id);
    void ProgramsRepo.remove(id).catch(onWriteError('programs.remove', 'No se pudo eliminar el programa. Vuelve a aparecer porque sigue ahí.', revertir));
  },

  byClient: (clientId) => get().programs.filter((p) => p.clientId === clientId),
}));
