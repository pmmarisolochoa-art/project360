export type AdPlatform = 'meta' | 'google' | 'tiktok' | 'ga4';

export interface AdMetrics {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpl: number;
  roas: number;
}

export interface AdSnapshot {
  id: string;
  clientId: string;
  platform: AdPlatform;
  date: string;
  metrics: AdMetrics;
  insightsAi?: string;
}

export interface FunnelProjection {
  reach: number;
  ctr: number;
  leads: number;
  sqls: number;
  sales: number;
  averageTicket: number;
  revenue: number;
}
