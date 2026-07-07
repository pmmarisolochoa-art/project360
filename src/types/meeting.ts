export type MeetingType =
  | 'kickoff'
  | 'weekly_metrics'
  | 'content_strategy'
  | 'ads_review'
  | 'monthly_closing'
  | 'crisis'
  | 'weekly_planning'
  | 'ropre_strategy'
  // Reuniones internas del equipo (no de un cliente):
  | 'daily'
  | 'sprint_cierre';

/** Tipos de reunión INTERNA del equipo (agencyId en vez de clientId). */
export const TEAM_MEETING_TYPES: MeetingType[] = ['daily', 'weekly_planning', 'sprint_cierre'];

export interface Meeting {
  id: string;
  /** Cliente dueño de la reunión. null = reunión interna del equipo (usa agencyId). */
  clientId: string | null;
  /** Agencia dueña de la reunión, para reuniones internas del equipo. */
  agencyId?: string | null;
  title: string;
  type: MeetingType;
  scheduledAt: string;
  durationMin: number;
  participants: Array<{ userId: string; name: string }>;
  agenda?: string;
  recordingUrl?: string;
  transcription?: string;
  summary?: string;
  extractedTasks?: Array<{ title: string; responsibleRole: string; dueInDays: number }>;
  // Extensiones para Feature 6B (MeetingDrawer)
  videoCallLink?: string;
  notes?: string;
  notesUpdatedAt?: string;
  completed?: boolean;
}
