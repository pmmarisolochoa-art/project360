import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type IntegrationKey = 'googleCalendar' | 'calendly' | 'zoom' | 'googleMeet' | 'teams';

interface IntegrationsState {
  googleCalendar: { connected: boolean };
  calendly: { connected: boolean; url: string };
  zoom: { connected: boolean };
  googleMeet: { connected: boolean };
  teams: { connected: boolean };
  toggle: (key: IntegrationKey) => void;
  setCalendlyUrl: (url: string) => void;
}

/**
 * Estado de las 5 integraciones de agenda. Persistido en localStorage
 * para que la conexión sobreviva al refresh. Las conexiones reales
 * requieren las API keys en .env (Google Calendar OAuth, Zoom token, etc.).
 */
export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set) => ({
      googleCalendar: { connected: false },
      calendly: { connected: false, url: '' },
      zoom: { connected: false },
      googleMeet: { connected: false },
      teams: { connected: false },
      toggle: (key) =>
        set((s) => ({ [key]: { ...s[key], connected: !s[key].connected } } as Partial<IntegrationsState>)),
      setCalendlyUrl: (url) => set((s) => ({ calendly: { ...s.calendly, url } })),
    }),
    { name: 'p360-integrations' },
  ),
);
