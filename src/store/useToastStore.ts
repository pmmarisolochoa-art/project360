import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = `t_${Math.random().toString(36).slice(2, 8)}`;
    const t: Toast = { id, duration: 3200, ...toast };
    set((s) => ({ toasts: [...s.toasts, t] }));
    if (t.duration) {
      setTimeout(() => get().dismiss(id), t.duration);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Helper para llamar fuera de componentes.
export const toast = {
  success: (message: string) => useToastStore.getState().show({ tone: 'success', message }),
  error: (message: string) => useToastStore.getState().show({ tone: 'error', message }),
  info: (message: string) => useToastStore.getState().show({ tone: 'info', message }),
  warning: (message: string) => useToastStore.getState().show({ tone: 'warning', message }),
};
