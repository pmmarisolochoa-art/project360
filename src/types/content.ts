export type ContentPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'facebook';
export type ContentFormat = 'reel' | 'post' | 'story' | 'video' | 'carousel' | 'short';

export type CtaType =
  | 'lead_magnet'      // descargar gratis / link en bio
  | 'buy_now'          // comprar ya / catálogo
  | 'comment_info'     // comenta INFO y te paso detalles
  | 'dm_keyword'       // mándame una palabra al DM
  | 'subscribe'        // suscríbete / sigue
  | 'save'             // guarda este post
  | 'tag_friend'       // etiqueta a un amigo
  | 'share'            // comparte en tu story
  | 'click_link'       // click al link / swipe up
  | 'webinar'          // inscríbete al webinar
  | 'book_call'        // agenda una llamada / consultoría
  | 'no_cta';          // sin CTA explícito (contenido de valor puro)

export const CTA_TYPE_LABEL: Record<CtaType, string> = {
  lead_magnet:  '🎁 Lead Magnet (link en bio)',
  buy_now:      '🛒 Comprar ahora',
  comment_info: '💬 Comenta INFO',
  dm_keyword:   '✉️ Mándame palabra al DM',
  subscribe:    '🔔 Suscríbete / Sigue',
  save:         '🔖 Guarda este post',
  tag_friend:   '👥 Etiqueta a un amigo',
  share:        '🔁 Comparte',
  click_link:   '🔗 Click al link',
  webinar:      '🎓 Inscríbete al webinar',
  book_call:    '📞 Agenda una llamada',
  no_cta:       '— Sin CTA (valor puro)',
};

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
  // Tipo de CTA — guía a la IA y al copywriter sobre el cierre del contenido.
  ctaType?: CtaType;
  // Guion / script del contenido — qué decir/grabar (para el equipo, no se publica).
  script?: string;
  // Caption listo para publicar directo en la plataforma.
  caption?: string;
  // Rol responsable + persona específica (independientes — el rol puede estar
  // asignado a varias personas en useTeamStore).
  roleSlug?: string;
  assignedTo?: string;
  // LEGACY: campo único previo donde vivían script + caption juntos.
  // Lo dejamos por compatibilidad con piezas viejas. Lectura preferente:
  // script/caption nuevos; si están vacíos, se usa copyText.
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

/**
 * Una lectura en el tiempo de las métricas orgánicas de una pieza publicada
 * (migración 066, 24-nov-2026). Serie de tiempo a propósito, no un solo
 * valor: necesario para Historias (expiran en 24h) y para comparar piezas
 * en el mismo punto de su vida, no en momentos distintos.
 *
 * `frameIndex` distingue cada frame de una secuencia de Historia (0 para
 * post/reel/carrusel/video normal; 1,2,3… por cada historia de la secuencia).
 *
 * Límites reales de la API de Meta que este modelo respeta a propósito:
 * - No hay retención por segmento (hook/cuerpo/CTA) — se aproxima con
 *   avgWatchTimeSeconds / videoDurationSeconds (% agregado, no por tramo).
 * - No hay swipe-through por slide de carrusel — solo el agregado.
 * - `follows` SÍ es atribuible por pieza (Meta expone `profile_activity`
 *   con breakdown FOLLOWS en Insights nativo) — no es una estimación.
 */
export interface ContentMetricSnapshot {
  id: string;
  contentPieceId: string;
  frameIndex: number;
  capturedAt: string;
  source: 'manual' | 'meta_api';
  // comunes a cualquier formato
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  profileVisits?: number;
  bioLinkClicks?: number;
  follows?: number;
  // solo video/reel
  videoDurationSeconds?: number;
  avgWatchTimeSeconds?: number;
  // solo historia (por frame)
  exits?: number;
  replies?: number;
  tapsForward?: number;
  tapsBack?: number;
  createdBy?: string;
  createdAt: string;
}

/** Formatos donde aplica el proxy de retención (avg watch time / duración). */
export const RETENTION_FORMATS: ContentFormat[] = ['reel', 'video', 'short'];
