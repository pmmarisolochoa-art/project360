import { create } from 'zustand';
import type { AuthUser } from '@/services/auth';

/** Rol del usuario logueado dentro de la app. */
export type UserRole = 'owner' | 'member';

/** Acceso de un miembro a un cliente concreto (Capa 3 — migración 018). */
export interface ClientAccess {
  clientId: string;
  accessLevel: 'viewer' | 'editor';
}

interface AuthState {
  user: AuthUser | null;
  agencyId: string | null;
  /** 'owner' = dueño de agencia (ve todo lo suyo). 'member' = equipo/cliente (ve 1 cliente). */
  role: UserRole | null;
  /** Solo para role === 'member': el cliente y nivel de acceso. */
  clientAccess: ClientAccess | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
  setAgencyId: (id: string | null) => void;
  setRole: (r: UserRole | null) => void;
  setClientAccess: (c: ClientAccess | null) => void;
  setLoading: (v: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  agencyId: null,
  role: null,
  clientAccess: null,
  loading: true,
  setUser: (u) => set({ user: u }),
  setAgencyId: (id) => set({ agencyId: id }),
  setRole: (r) => set({ role: r }),
  setClientAccess: (c) => set({ clientAccess: c }),
  setLoading: (v) => set({ loading: v }),
  reset: () => set({ user: null, agencyId: null, role: null, clientAccess: null, loading: false }),
}));
