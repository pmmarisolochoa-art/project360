import { create } from 'zustand';
import type { Notification, NotificationUrgency } from '@/types/notification';

interface NotificationState {
  notifications: Notification[];
  push: (n: Omit<Notification, 'id' | 'createdAt' | 'sentAt' | 'isRead'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadByUrgency: () => Record<NotificationUrgency, number>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    {
      id: 'n_1',
      userId: 'u_owner',
      clientId: 'c_kuroko',
      entityId: 't_2', // Tarea seedeada en seed.ts
      type: 'task_overdue',
      message: 'Tarea "Solicitar acceso a Business Manager" vencida hace 1 día',
      urgency: 'high',
      isRead: false,
      channel: 'in_app',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'n_2',
      userId: 'u_owner',
      clientId: 'c_fitmind',
      entityId: 'm_1', // Meeting seedeada en seed.ts
      type: 'meeting_soon',
      message: 'Revisión semanal con FitMind en 5 horas',
      urgency: 'normal',
      isRead: false,
      channel: 'in_app',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ],
  push: (n) =>
    set((s) => ({
      notifications: [
        {
          ...n,
          id: `n_${Math.random().toString(36).slice(2, 9)}`,
          isRead: false,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        ...s.notifications,
      ],
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    })),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, isRead: true })) })),
  unreadByUrgency: () => {
    const counts: Record<NotificationUrgency, number> = { low: 0, normal: 0, high: 0, critical: 0 };
    for (const n of get().notifications) if (!n.isRead) counts[n.urgency]++;
    return counts;
  },
}));
