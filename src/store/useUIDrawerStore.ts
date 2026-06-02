import { create } from 'zustand';

/**
 * Estado global para el MeetingDrawer.
 * Lo abren tanto WeeklyCalendar como el panel "Reuniones esta semana"
 * de GlobalStats. Compartirlo evita prop-drilling.
 */
interface UIDrawerState {
  meetingId: string | null;
  // Si true, MeetingDrawer auto-genera la agenda al montar (una sola vez).
  // Lo usan los flujos de "crear reunión" para llegar con todo preparado.
  autoGenAgenda: boolean;
  openMeeting: (id: string, opts?: { autoGenAgenda?: boolean }) => void;
  closeMeeting: () => void;
  consumeAutoGen: () => void;
}

export const useUIDrawerStore = create<UIDrawerState>((set) => ({
  meetingId: null,
  autoGenAgenda: false,
  openMeeting: (id, opts) => set({ meetingId: id, autoGenAgenda: !!opts?.autoGenAgenda }),
  closeMeeting: () => set({ meetingId: null, autoGenAgenda: false }),
  consumeAutoGen: () => set({ autoGenAgenda: false }),
}));
