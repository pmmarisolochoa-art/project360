export type ClientStatus =
  | 'onboarding'
  | 'planning'
  | 'active'
  | 'paused'
  | 'completed';

/** Estados en los que un cliente se considera vivo (consume horas y presupuesto). */
export const ACTIVE_CLIENT_STATUSES: ClientStatus[] = ['onboarding', 'planning', 'active'];

/** Fuente única de verdad para "¿este cliente cuenta como activo?". */
export function isActiveClient(c: { isAgency?: boolean; status: ClientStatus }): boolean {
  return !c.isAgency && ACTIVE_CLIENT_STATUSES.includes(c.status);
}

export type ProjectType =
  | 'ecommerce'
  | 'launch'
  | 'evergreen'
  | 'personal_brand'
  | 'other';

export type SystemHealth = 'green' | 'yellow' | 'red';

export interface ClientMetricsSnapshot {
  roas: number | null;
  pendingTasksToday: number;
  nextMeetingAt: string | null;
  progressPercent: number;
  bottleneck?: { role: string; reason: string } | null;
  // Métricas de negocio editables (extiende para Feature 5)
  invertedThisMonth?: number;       // USD invertidos en ADS del mes corriente
  invertedThisMonthFresh?: boolean; // true si se refrescó con fetch real
  salesCount?: number;              // ventas registradas mes
  revenueAccumulated?: number;      // USD facturados mes
  monthlyRevenueTarget?: number | null; // meta del mes para color condicional
}

export interface OnboardingData {
  identity: {
    businessName: string;
    founderName: string;
    email: string;
    whatsapp: string;
    industry: string;
    yearsInMarket: number;
    country: string;
    city: string;
    website?: string;
    socials: Partial<Record<'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'facebook' | 'x', string>>;
    logoUrl?: string;
  };
  business: Record<string, unknown>;
  current: Record<string, unknown>;
  audience: Record<string, unknown>;
  goals: Record<string, unknown>;
  competition: Record<string, unknown>;
  content: Record<string, unknown>;
  team: Record<string, unknown>;
}

export interface BrandArchitecture {
  mission: string;       // 1 oración — para qué existe la marca
  vision: string;        // 1 oración — hacia dónde va
  values: string[];      // 3-5 valores clave
  pillars: Array<{ name: string; description: string }>; // 3-5 pilares de comunicación
  voiceTone: string;     // 2-3 oraciones describiendo tono de voz
  dos: string[];         // 3-5 cosas a hacer
  donts: string[];       // 3-5 cosas a evitar
}

export interface AIBrainData {
  executiveSummary?: string;
  buyerPersonas?: Array<{ name: string; description: string; pains: string[]; desires: string[] }>;
  irresistibleOffer?: string;
  gapAnalysis?: string;
  recommendedSystem?: ProjectType;
  initialDeliverables?: Array<{ title: string; dueInDays: number; responsibleRole: string }>;
  brandArchitecture?: BrandArchitecture;
  generatedAt?: string;
}

export interface Client {
  id: string;
  agencyId: string;
  name: string;
  /** Sigla corta del cliente (ej. DG, AT). Editable; si falta, se deriva del nombre. */
  sigla?: string;
  /** Espacio de Agencia: si true, no es un cliente real (aloja reuniones compartidas). */
  isAgency?: boolean;
  industry: string;
  businessType: string;
  primaryColor: string;
  status: ClientStatus;
  projectType: ProjectType;
  onboardingData: Partial<OnboardingData>;
  aiBrainData: AIBrainData;
  metrics: ClientMetricsSnapshot;
  adsConnected: { meta: boolean; google: boolean; tiktok: boolean; ga4: boolean };
  monthlyAdsBudget: number;
  // Embudo activo por defecto cuando el cliente entra al cerebro.
  // Si tiene varios, este es el que abre primero el sub-tab "Embudos".
  activeFunnelId?: string;
  createdAt: string;
  updatedAt: string;
}
