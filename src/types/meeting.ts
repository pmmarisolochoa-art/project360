export type MeetingType =
  | 'kickoff'
  | 'weekly_metrics'
  | 'content_strategy'
  | 'ads_review'
  | 'monthly_closing'
  | 'crisis';

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
}
