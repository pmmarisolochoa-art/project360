import { onWriteError } from './onWriteError';
import { create } from 'zustand';
import type { TeamMember } from '@/types/teamMember';
import { TeamMembersRepo } from '@/services/repositories';

/**
 * Mete a la persona en la lista: la reemplaza si ya está, la añade si no.
 *
 * Antes se añadía a ciegas, y desde que invitar ACTUALIZA la ficha existente en
 * vez de crear otra, el endpoint devuelve el id que ya estaba — así que un
 * `push` dejaba a la misma persona dos veces en pantalla. Duplicado solo en el
 * navegador, que desaparecía al recargar: peor todavía, porque parece que la
 * base se rompió cuando no le pasa nada.
 *
 * Es la tercera vez esta semana que un "añadir sin mirar si ya está" muerde:
 * la ficha al invitar, el login al crear la cuenta, y ahora la lista en
 * memoria. Si una operación se puede repetir, tiene que ser idempotente en
 * TODAS sus capas — no basta con arreglarla en la base.
 */
function upsert(lista: TeamMember[], nuevo: TeamMember): TeamMember[] {
  return lista.some((m) => m.id === nuevo.id)
    ? lista.map((m) => (m.id === nuevo.id ? { ...m, ...nuevo } : m))
    : [...lista, nuevo];
}

interface TeamMembersState {
  members: TeamMember[];
  /** Reemplaza todo el set (usado en bootstrap). */
  hydrate: (members: TeamMember[]) => void;
  add: (member: TeamMember) => void;
  /** Agrega solo al estado local (la fila ya la creó el backend — no re-inserta). */
  addLocal: (member: TeamMember) => void;
  update: (id: string, patch: Partial<TeamMember>) => void;
  remove: (id: string) => void;
}

export const useTeamMembersStore = create<TeamMembersState>((set) => ({
  members: [],

  hydrate: (members) => set({ members }),

  add: (member) => {
    set((s) => ({ members: upsert(s.members, member) }));
    void TeamMembersRepo.create(member).catch(onWriteError('teamMembers.create', 'No se pudo guardar a esa persona en el equipo. Recarga e inténtalo de nuevo.'));
  },

  addLocal: (member) => set((s) => ({ members: upsert(s.members, member) })),

  update: (id, patch) => {
    set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    void TeamMembersRepo.update(id, patch).catch(onWriteError('teamMembers.update', 'No se pudieron guardar los cambios de esa persona.'));
  },

  remove: (id) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    void TeamMembersRepo.remove(id).catch(onWriteError('teamMembers.remove', 'No se pudo eliminar a esa persona. Recarga: puede seguir ahí.'));
  },
}));

/** Selector helper para usar fuera de componentes. */
export const teamMembersForClient = (clientId: string): TeamMember[] =>
  useTeamMembersStore.getState().members.filter((m) => m.clientId === clientId);
