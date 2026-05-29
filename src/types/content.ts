export type ContentPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'facebook';
export type ContentFormat = 'reel' | 'post' | 'story' | 'video' | 'carousel' | 'short';

/**
 * Estados ampliados del pipeline de producción de contenido.
 * Mantienen compatibilidad con el Kanban anterior y agregan los nuevos
 * estados visibles en el calendario.
 */
export type ContentStatus =
  | 'not_started'
  | 'recording'
  | 'editing'
  | 'review'
  | 'sent_to_client'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'published';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ContentPiece {
  id: string;
  clientId: string;
  title: string;
  platform: ContentPlatform;
  format: ContentFormat;
  copyText: string;
  mediaUrl?: string;
  productionNotes?: string;
  approvalNotes?: string;
  status: ContentStatus;
  approval: ApprovalStatus;
  // 4 fechas diferenciadas del ciclo de vida de una pieza:
  recordingDate?: string;
  editingDate?: string;
  approvalDate?: string;
  publishDate?: string;
  hasLeadMagnet: boolean;
  leadMagnetDescription?: string;
  createdBy?: string;
  approvedBy?: string;
  createdAt: string;
}

export const CONTENT_STATUS_META: Record<
  ContentStatus,
  { label: string; bg: string; text: string; ring: string }
> = {
  not_started:    { label: 'Sin empezar',       bg: 'rgba(160,160,180,0.15)', text: '#A0A0B4', ring: 'rgba(160,160,180,0.35)' },
  recording:      { label: 'En grabación',      bg: 'rgba(99,102,241,0.18)',  text: '#818CF8', ring: 'rgba(99,102,241,0.40)' },
  editing:        { label: 'En edición',        bg: 'rgba(139,92,246,0.18)',  text: '#A78BFA', ring: 'rgba(139,92,246,0.40)' },
  review:         { label: 'En revisión',       bg: 'rgba(249,115,22,0.18)',  text: '#FB923C', ring: 'rgba(249,115,22,0.40)' },
  sent_to_client: { label: 'Enviado al cliente',bg: 'rgba(6,182,212,0.18)',   text: '#22D3EE', ring: 'rgba(6,182,212,0.40)' },
  approved:       { label: 'Aprobado',          bg: 'rgba(16,185,129,0.18)',  text: '#34D399', ring: 'rgba(16,185,129,0.40)' },
  rejected:       { label: 'Rechazado',         bg: 'rgba(239,68,68,0.18)',   text: '#F87171', ring: 'rgba(239,68,68,0.40)' },
  scheduled:      { label: 'Programado',        bg: 'rgba(6,182,212,0.12)',   text: '#67E8F9', ring: 'rgba(6,182,212,0.30)' },
  published:      { label: 'Publicado',         bg: 'rgba(5,150,105,0.20)',   text: '#10B981', ring: 'rgba(5,150,105,0.45)' },
};

export const PLATFORM_META: Record<ContentPlatform, { label: string; emoji: string }> = {
  instagram: { label: 'Instagram', emoji: '📷' },
  tiktok:    { label: 'TikTok',    emoji: '🎵' },
  youtube:   { label: 'YouTube',   emoji: '▶️' },
  linkedin:  { label: 'LinkedIn',  emoji: '💼' },
  facebook:  { label: 'Facebook',  emoji: '👥' },
};

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  reel: 'Reel',
  post: 'Post',
  story: 'Story',
  video: 'Video',
  carousel: 'Carrusel',
  short: 'Short',
};
