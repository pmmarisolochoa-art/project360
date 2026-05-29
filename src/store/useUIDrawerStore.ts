import { create } from 'zustand';

/**
 * Estado global para el MeetingDrawer.
 * Lo abren tanto WeeklyCalendar como el panel "Reuniones esta semana"
 * de GlobalStats. Compartirlo evita prop-drilling.
 */
interface UIDrawerState {
  meetingId: string | null;
  openMeeting: (id: string) => void;
  closeMeeting: () => void;
}

export const useUIDrawerStore = create<UIDrawerState>((set) => ({
  meetingId: null,
  openMeeting: (id) => set({ meetingId: id }),
  closeMeeting: () => set({ meetingId: null }),
}));
