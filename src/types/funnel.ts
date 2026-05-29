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

export const FUNNEL_KIND_META: Record<FunnelKind, { label: string; description: string }> = {
  capture:       { label: 'Captación / Lead Generation', description: 'Capturar leads desde frío hacia base.' },
  warmup:        { label: 'Calentamiento de audiencia',  description: 'Nutrir audiencia ya conocida.' },
  launch_event:  { label: 'Lanzamiento con Evento',      description: 'Pre-lanzamiento → CPL → Carrito.' },
  evergreen:     { label: 'Evergreen / Siempre activo',  description: 'Sistema 24/7 con ROAS estable.' },
  ecommerce:     { label: 'Ecommerce directo',           description: 'Catálogo → carrito → checkout.' },
  personal_brand:{ label: 'Marca personal / Posicionamiento', description: 'Audiencia orgánica → autoridad → monetización.' },
};
