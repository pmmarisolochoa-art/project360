import { onWriteError } from './onWriteError';
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
    set((s) => ({ programs: [program, ...s.programs] }));
    void ProgramsRepo.create(program).catch(onWriteError('programs.create', 'No se pudo crear el programa. Recarga e inténtalo de nuevo.'));
  },

  update: (id, patch) => {
    set((s) => ({ programs: s.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    void ProgramsRepo.update(id, patch).catch(onWriteError('programs.update', 'No se pudieron guardar los cambios del programa.'));
  },

  remove: (id) => {
    set((s) => ({ programs: s.programs.filter((p) => p.id !== id) }));
    void ProgramsRepo.remove(id).catch(onWriteError('programs.remove', 'No se pudo eliminar el programa. Recarga: puede seguir ahí.'));
  },

  byClient: (clientId) => get().programs.filter((p) => p.clientId === clientId),
}));
