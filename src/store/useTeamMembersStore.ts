import { create } from 'zustand';
import type { TeamMember } from '@/types/teamMember';
import { TeamMembersRepo } from '@/services/repositories';

interface TeamMembersState {
  members: TeamMember[];
  /** Reemplaza todo el set (usado en bootstrap). */
  hydrate: (members: TeamMember[]) => void;
  add: (member: TeamMember) => void;
  update: (id: string, patch: Partial<TeamMember>) => void;
  remove: (id: string) => void;
}

export const useTeamMembersStore = create<TeamMembersState>((set) => ({
  members: [],

  hydrate: (members) => set({ members }),

  add: (member) => {
    set((s) => ({ members: [...s.members, member] }));
    void TeamMembersRepo.create(member).catch((e) => console.warn('[teamMembers.create]', e));
  },

  update: (id, patch) => {
    set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    void TeamMembersRepo.update(id, patch).catch((e) => console.warn('[teamMembers.update]', e));
  },

  remove: (id) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    void TeamMembersRepo.remove(id).catch((e) => console.warn('[teamMembers.remove]', e));
  },
}));

/** Selector helper para usar fuera de componentes. */
export const teamMembersForClient = (clientId: string): TeamMember[] =>
  useTeamMembersStore.getState().members.filter((m) => m.clientId === clientId);
