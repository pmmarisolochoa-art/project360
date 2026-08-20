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

  /* ── Reporte guardado (migración 042) ──────────────────────────────────── */
  /** El reporte ya generado. Se genera una vez y se reusa. */
  reporte?: ReporteReunion;
  /** Cuándo se generó. */
  reporteGeneradoEn?: string;
}

/**
 * Reporte guardado de la reunión.
 *
 * `plantilla` dice con cuál de las 5 se generó, para poder pintarlo bien al
 * releerlo — y para poder migrar los viejos si alguna plantilla cambia.
 */
export interface ReporteReunion {
  plantilla: 'daily';
  datos: unknown;
}

/** De dónde vino una reunión. Debe coincidir con el CHECK de `meetings.origen`. */
export type MeetingOrigen = 'manual' | 'api' | 'paralelo';
