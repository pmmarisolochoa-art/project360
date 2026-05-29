import { create } from 'zustand';
import type { User } from '@/types/user';
import { seedUser } from '@/data/seed';

interface AppState {
  currentUser: User | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  signIn: (user: User) => void;
  signOut: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: seedUser, // bootstrap: sesión simulada en Capa 0
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  signIn: (user) => set({ currentUser: user }),
  signOut: () => set({ currentUser: null }),
}));
