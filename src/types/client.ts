export type ClientStatus =
  | 'onboarding'
  | 'planning'
  | 'active'
  | 'paused'
  | 'completed';

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

export interface AIBrainData {
  executiveSummary?: string;
  buyerPersonas?: Array<{ name: string; description: string; pains: string[]; desires: string[] }>;
  irresistibleOffer?: string;
  gapAnalysis?: string;
  recommendedSystem?: ProjectType;
  initialDeliverables?: Array<{ title: string; dueInDays: number; responsibleRole: string }>;
  generatedAt?: string;
}

export interface Client {
  id: string;
  agencyId: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
}
