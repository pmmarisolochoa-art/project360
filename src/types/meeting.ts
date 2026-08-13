export type MeetingType =
  | 'kickoff'
  | 'weekly_metrics'
  | 'content_strategy'
  | 'ads_review'
  | 'monthly_closing'
  | 'crisis'
  | 'weekly_planning'
  | 'ropre_strategy'
  | 'weekly_closing'
  | 'general'
  | 'management';

export interface Meeting {
  id: string;
  clientId: string;
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

  /* ── Espacio privado (migración 030) ───────────────────────────────────── */
  /** true = solo la ve su propietario. No sale en la agenda del equipo. */
  esPrivada?: boolean;
  /** auth.users.id del dueño de la reunión privada. */
  propietarioId?: string;

  /* ── Trazabilidad de origen (migración 039) ────────────────────────────── */
  /** De dónde vino la reunión. Default 'manual'. */
  origen?: MeetingOrigen;
  /** ID de esta reunión en la plataforma externa. Evita reimportar duplicados.
   *  Vacío = creada dentro de Project360. */
  externalId?: string;
}

/** De dónde vino una reunión. Debe coincidir con el CHECK de `meetings.origen`. */
export type MeetingOrigen = 'manual' | 'api' | 'paralelo';
