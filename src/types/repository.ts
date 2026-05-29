export type DeliverableType = 'document' | 'design' | 'video' | 'copy' | 'report' | 'landing' | 'other';
export type DeliverableStatus = 'pending' | 'delivered' | 'approved' | 'rejected';

export interface DeliverableItem {
  id: string;
  clientId: string;
  name: string;
  type: DeliverableType;
  status: DeliverableStatus;
  deliveryDate: string;
  externalUrl?: string;
  attachmentUrl?: string;
  notes?: string;
  createdAt: string;
  // Si vino del módulo ROPRE
  source?: { type: 'ropre'; itemId: string };
}

export type LinkCategory =
  | 'landing' | 'reports' | 'design_folder' | 'strategy_docs' | 'ads_campaigns'
  | 'socials' | 'tools_access' | 'meeting_recordings' | 'other';

export interface LinkItem {
  id: string;
  clientId: string;
  category: LinkCategory;
  name: string;
  url: string;
  notes?: string;
  createdAt: string;
}

export const DELIVERABLE_TYPE_LABEL: Record<DeliverableType, string> = {
  document: 'Documento', design: 'Diseño', video: 'Video',
  copy: 'Copy', report: 'Reporte', landing: 'Landing', other: 'Otro',
};

export const DELIVERABLE_STATUS_TONE: Record<DeliverableStatus, 'neutral' | 'success' | 'info' | 'danger'> = {
  pending: 'neutral', delivered: 'info', approved: 'success', rejected: 'danger',
};

export const LINK_CATEGORY_META: Record<LinkCategory, { label: string; icon: string }> = {
  landing:            { label: 'Landing Pages activas',          icon: '🔗' },
  reports:            { label: 'Reportes y Dashboards',          icon: '📊' },
  design_folder:      { label: 'Carpetas de Diseño',             icon: '🎨' },
  strategy_docs:      { label: 'Documentos de estrategia',       icon: '📝' },
  ads_campaigns:      { label: 'Campañas ADS',                   icon: '🎯' },
  socials:            { label: 'Perfiles de Redes Sociales',     icon: '📱' },
  tools_access:       { label: 'Herramientas y accesos',         icon: '🛠️' },
  meeting_recordings: { label: 'Grabaciones de reuniones',       icon: '📹' },
  other:              { label: 'Otro',                           icon: '🔖' },
};
