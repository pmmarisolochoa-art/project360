export type FunnelKind = 'capture' | 'warmup' | 'launch_event' | 'evergreen' | 'ecommerce' | 'personal_brand';

export type FunnelNodeType = 'source' | 'page' | 'lead' | 'email' | 'split' | 'cta' | 'sale';

export interface FunnelNode {
  id: string;
  type: FunnelNodeType;
  label: string;
  description?: string;
  expectedConvRate?: number; // 0..1
  tool?: string;
  responsible?: string;
  linkedTaskId?: string;
}

export interface FunnelEdge {
  from: string;
  to: string;
  label?: string;
}

export interface FunnelDoc {
  id: string;
  clientId: string;
  kind: FunnelKind;
  name: string;
  nodes: FunnelNode[];
  edges: FunnelEdge[];
  createdAt: string;
}

/**
 * Meta de cada tipo de nodo del diagrama — emoji + lenguaje plano para que
 * el cliente entienda el embudo sin jerga de marketing.
 */
export const FUNNEL_NODE_TYPE_META: Record<FunnelNodeType, { emoji: string; label: string; color: string }> = {
  source: { emoji: '📲', label: 'Fuente de tráfico',      color: '#6366F1' },
  page:   { emoji: '📄', label: 'Página',                  color: '#8B5CF6' },
  lead:   { emoji: '🧲', label: 'Lead capturado',          color: '#06B6D4' },
  email:  { emoji: '📧', label: 'Email',                   color: '#F59E0B' },
  split:  { emoji: '🔀', label: 'División A/B',            color: '#F97316' },
  cta:    { emoji: '👆', label: 'Llamado a la acción',     color: '#EC4899' },
  sale:   { emoji: '💰', label: 'Venta',                   color: '#10B981' },
};

export const FUNNEL_KIND_META: Record<FunnelKind, { label: string; description: string }> = {
  capture:       { label: 'Captación / Lead Generation', description: 'Capturar leads desde frío hacia base.' },
  warmup:        { label: 'Calentamiento de audiencia',  description: 'Nutrir audiencia ya conocida.' },
  launch_event:  { label: 'Lanzamiento con Evento',      description: 'Pre-lanzamiento → CPL → Carrito.' },
  evergreen:     { label: 'Evergreen / Siempre activo',  description: 'Sistema 24/7 con ROAS estable.' },
  ecommerce:     { label: 'Ecommerce directo',           description: 'Catálogo → carrito → checkout.' },
  personal_brand:{ label: 'Marca personal / Posicionamiento', description: 'Audiencia orgánica → autoridad → monetización.' },
};

/* ════════════════════════════════════════════════════════════════════════════
 * SISTEMA DE EMBUDOS DE LANZAMIENTO CON ROADMAP
 * Nuevo sistema (no rompe el anterior). Un cliente tiene 0+ Funnels.
 * Cada Funnel se basa en un FunnelTemplate, tiene FunnelPhases, y sus tareas
 * viven en la tabla normal de tasks vinculadas por funnelId + phaseId.
 * ════════════════════════════════════════════════════════════════════════════ */

export type FunnelTemplateKey =
  | 'seed_leadmagnet'      // Lanzamiento Semilla + Lead Magnet (28-45d)
  | 'paid_workshop'        // Lanzamiento Pago Workshop (30-60d)
  | 'internal_launch'      // Lanzamiento Interno orgánico (30-45d)
  | 'evergreen_social';    // Evergreen / Social Funnel (operación mensual)

export type FunnelStatus = 'planning' | 'active' | 'completed' | 'paused' | 'cancelled';

export interface Funnel {
  id: string;
  clientId: string;
  templateKey: FunnelTemplateKey;
  name: string;                  // ej "Lanzamiento Semilla Q3"
  status: FunnelStatus;
  startDate: string;             // ISO — día 1 del embudo
  eventDate?: string;            // fecha del evento principal (webinar/apertura carrito)
  endDate?: string;              // fecha de cierre
  shareToken: string;            // token unguessable para portal cliente público
  createdAt: string;
}

export interface FunnelPhase {
  id: string;
  funnelId: string;
  order: number;
  name: string;
  color: string;
  dayStart: number;              // offset en días desde startDate del funnel
  dayEnd: number;
}

export interface TemplateTask {
  title: string;
  responsibleRole: string;       // slug de team role
  dayStart: number;
  dayEnd: number;
  input?: string;
  output?: string;
  priority?: 'P1' | 'P2' | 'P3';
  recurring?: boolean;
}

export interface TemplatePhase {
  name: string;
  color: string;
  dayStart: number;
  dayEnd: number;
  tasks: TemplateTask[];
}

export interface FunnelTemplate {
  key: FunnelTemplateKey;
  emoji: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  estimatedDays: { min: number; max: number };
  phases: TemplatePhase[];
}
