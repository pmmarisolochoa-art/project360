import { create } from 'zustand';
import type { AuthUser } from '@/services/auth';

interface AuthState {
  user: AuthUser | null;
  agencyId: string | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
  setAgencyId: (id: string | null) => void;
  setLoading: (v: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  agencyId: null,
  loading: true,
  setUser: (u) => set({ user: u }),
  setAgencyId: (id) => set({ agencyId: id }),
  setLoading: (v) => set({ loading: v }),
  reset: () => set({ user: null, agencyId: null, loading: false }),
}));
