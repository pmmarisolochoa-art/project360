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
    void ProgramsRepo.create(program).catch((e) => console.warn('[programs.create]', e));
  },

  update: (id, patch) => {
    set((s) => ({ programs: s.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    void ProgramsRepo.update(id, patch).catch((e) => console.warn('[programs.update]', e));
  },

  remove: (id) => {
    set((s) => ({ programs: s.programs.filter((p) => p.id !== id) }));
    void ProgramsRepo.remove(id).catch((e) => console.warn('[programs.remove]', e));
  },

  byClient: (clientId) => get().programs.filter((p) => p.clientId === clientId),
}));
