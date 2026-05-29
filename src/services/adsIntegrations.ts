import type { AdMetrics, AdPlatform } from '@/types/metrics';

/**
 * Stub de integraciones de ADS.
 * Cuando el backend reciba las credenciales OAuth (Meta Graph API v18+,
 * Google Ads API v15, TikTok Marketing API), reemplazar `fetchPlatformDailyMetrics`
 * por la llamada real. La forma de salida ya es la final.
 */

export interface DailyMetric {
  date: string;
  metrics: AdMetrics;
}

export interface Campaign {
  id: string;
  platform: AdPlatform;
  name: string;
  status: 'active' | 'paused' | 'ended';
  spend: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpl: number;
  roas: number;
}

const PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
  ga4: 'GA4',
};

export function platformLabel(p: AdPlatform): string {
  return PLATFORM_LABELS[p];
}

/**
 * Devuelve métricas diarias mock para los últimos `days` días.
 * Determinístico por clientId+platform → la UI se ve estable entre re-renders.
 */
export function fetchPlatformDailyMetrics(
  clientId: string,
  platform: AdPlatform,
  days: number,
): DailyMetric[] {
  const seed = hashString(`${clientId}:${platform}`);
  const baseSpend = 30 + (seed % 70);
  const baseCtr = 0.012 + ((seed % 18) / 1000); // 1.2%–3.0%
  const baseCpc = 0.45 + ((seed % 80) / 100);
  const baseRoas = 2 + ((seed % 30) / 10);

  const result: DailyMetric[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const noise = (Math.sin(seed + i) + 1) / 2; // 0..1
    const spend = baseSpend * (0.7 + noise * 0.6);
    const ctr = baseCtr * (0.85 + noise * 0.3);
    const cpc = baseCpc * (0.85 + (1 - noise) * 0.3);
    const clicks = Math.round(spend / cpc);
    const impressions = Math.round(clicks / ctr);
    const reach = Math.round(impressions * 0.72);
    const cpl = cpc * 4.5;
    const roas = baseRoas * (0.85 + noise * 0.4);
    result.push({
      date: d.toISOString().slice(0, 10),
      metrics: {
        spend: Math.round(spend * 100) / 100,
        reach,
        impressions,
        clicks,
        ctr: Math.round(ctr * 10000) / 10000,
        cpc: Math.round(cpc * 100) / 100,
        cpl: Math.round(cpl * 100) / 100,
        roas: Math.round(roas * 100) / 100,
      },
    });
  }
  return result;
}

export function fetchCampaigns(clientId: string, platforms: AdPlatform[]): Campaign[] {
  const campaigns: Campaign[] = [];
  for (const platform of platforms) {
    const seed = hashString(`${clientId}:${platform}:campaigns`);
    const count = 2 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const s = hashString(`${clientId}:${platform}:${i}`);
      const spend = 200 + (s % 800);
      const cpc = 0.4 + ((s % 90) / 100);
      const ctr = 0.013 + ((s % 18) / 1000);
      const clicks = Math.round(spend / cpc);
      const cpl = cpc * 4.2;
      const roas = 1.8 + ((s % 28) / 10);
      campaigns.push({
        id: `cmp_${platform}_${i}_${clientId.slice(-4)}`,
        platform,
        name: CAMPAIGN_NAMES[platform][i % CAMPAIGN_NAMES[platform].length],
        status: i === 0 ? 'active' : i === 1 ? 'active' : s % 3 === 0 ? 'paused' : 'active',
        spend: Math.round(spend * 100) / 100,
        reach: Math.round(clicks / ctr * 0.72),
        clicks,
        ctr: Math.round(ctr * 10000) / 10000,
        cpc: Math.round(cpc * 100) / 100,
        cpl: Math.round(cpl * 100) / 100,
        roas: Math.round(roas * 100) / 100,
      });
    }
  }
  return campaigns;
}

const CAMPAIGN_NAMES: Record<AdPlatform, string[]> = {
  meta: ['Awareness LATAM mujeres 28-45', 'Conversión Reels regulación', 'Retargeting visitantes 30d', 'Lookalike top buyers'],
  google: ['Búsqueda branded', 'Búsqueda intent alto', 'Performance Max'],
  tiktok: ['Spark Ads creadora principal', 'Conversión TopView'],
  ga4: [],
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
