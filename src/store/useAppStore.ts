import { create } from 'zustand';
import type { User } from '@/types/user';
import { seedUser } from '@/data/seed';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'p360-theme';

function readInitialTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark';
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' ? 'light' : 'dark';
}

function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.remove('theme-dark', 'theme-light');
  html.classList.add(`theme-${theme}`);
}

interface AppState {
  currentUser: User | null;
  sidebarCollapsed: boolean;
  theme: Theme;
  setSidebarCollapsed: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  signIn: (user: User) => void;
  signOut: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: seedUser,
  sidebarCollapsed: false,
  theme: readInitialTheme(),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setTheme: (t) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, t);
    applyThemeClass(t);
    set({ theme: t });
  },
  signIn: (user) => set({ currentUser: user }),
  signOut: () => set({ currentUser: null }),
}));

// Aplica el theme al elemento <html> en el primer load (antes del primer render).
applyThemeClass(readInitialTheme());
