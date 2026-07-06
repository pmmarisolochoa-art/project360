import { create } from 'zustand';
import type { AuthUser } from '@/services/auth';

/** Rol del usuario logueado dentro de la app. */
export type UserRole = 'owner' | 'member';

/** Acceso de un miembro a un cliente concreto (Capa 3 — migración 018). */
export interface ClientAccess {
  clientId: string;
  accessLevel: 'viewer' | 'editor';
  /** Fila de team_members que representa a esta persona en este cliente. */
  teamMemberId: string;
  /** Nombre de la persona en ese cliente (para matchear sus tareas). */
  nombre: string;
  /** Rol de equipo (slug) en ese cliente: copywriter, strategist, etc. */
  rol: string;
  /** Departamentos de esta persona en este cliente (ej. ['pm','content']).
   *  Vacío = ve el set de módulos de miembro por defecto (comportamiento previo). */
  departamentos: string[];
}

interface AuthState {
  user: AuthUser | null;
  agencyId: string | null;
  /** 'owner' = dueño de agencia (ve todo lo suyo). 'member' = equipo/cliente. */
  role: UserRole | null;
  /** Todos los clientes a los que el miembro tiene acceso (multi-cliente). */
  clientAccesses: ClientAccess[];
  /** Atajo al primer acceso — usado por la vista scopeada de 1 cliente. */
  clientAccess: ClientAccess | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
  setAgencyId: (id: string | null) => void;
  setRole: (r: UserRole | null) => void;
  setClientAccesses: (list: ClientAccess[]) => void;
  setLoading: (v: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  agencyId: null,
  role: null,
  clientAccesses: [],
  clientAccess: null,
  loading: true,
  setUser: (u) => set({ user: u }),
  setAgencyId: (id) => set({ agencyId: id }),
  setRole: (r) => set({ role: r }),
  setClientAccesses: (list) => set({ clientAccesses: list, clientAccess: list[0] ?? null }),
  setLoading: (v) => set({ loading: v }),
  reset: () =>
    set({ user: null, agencyId: null, role: null, clientAccesses: [], clientAccess: null, loading: false }),
}));
