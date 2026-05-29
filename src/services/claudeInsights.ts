import type { Campaign, DailyMetric } from './adsIntegrations';
import type { Client } from '@/types/client';

/**
 * Stub de "Insights con IA" para Métricas.
 * Cuando se enchufe la Anthropic SDK, esta función debe enviar a Claude:
 *  - El contexto del cliente (industria, ticket, ROAS objetivo)
 *  - Las métricas de las plataformas conectadas
 *  - Benchmarks del sector (DB curada)
 * y devolver un análisis estructurado con recomendaciones específicas.
 */
export async function generateMetricsInsights(input: {
  client: Client;
  campaigns: Campaign[];
  trend: DailyMetric[];
}): Promise<{ summary: string; recommendations: string[]; alerts: string[] }> {
  await new Promise((r) => setTimeout(r, 1600));

  const { client, campaigns, trend } = input;
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const avgRoas = campaigns.length ? campaigns.reduce((s, c) => s + c.roas, 0) / campaigns.length : 0;
  const trendRoas = trend.length ? trend[trend.length - 1].metrics.roas : 0;
  const worstCampaign = [...campaigns].sort((a, b) => a.roas - b.roas)[0];
  const bestCampaign = [...campaigns].sort((a, b) => b.roas - a.roas)[0];

  const summary = `${client.name} acumuló $${totalSpend.toFixed(0)} de inversión en el período analizado con un ROAS promedio de ${avgRoas.toFixed(2)}x (${trendRoas >= avgRoas ? 'mejorando' : 'desacelerando'} hoy). La mejor campaña es "${bestCampaign?.name}" con ${bestCampaign?.roas.toFixed(2)}x; la más débil es "${worstCampaign?.name}" con ${worstCampaign?.roas.toFixed(2)}x.`;

  const recommendations = [
    `Escalar presupuesto +20% en "${bestCampaign?.name}" — está superando el ROAS promedio en ${(((bestCampaign?.roas ?? 0) - avgRoas) * 100 / avgRoas).toFixed(0)}%.`,
    worstCampaign && worstCampaign.roas < 1.8
      ? `Pausar o renovar creativos de "${worstCampaign.name}" — ROAS por debajo del umbral de rentabilidad.`
      : `Probar nuevas audiencias en "${worstCampaign?.name}" para empujar su performance.`,
    `Diversificar tests A/B de hooks en formato Reel — frecuencia óptima cada 7-10 días para evitar fatiga creativa.`,
  ].filter(Boolean) as string[];

  const alerts: string[] = [];
  if (avgRoas < 2) alerts.push(`ROAS promedio (${avgRoas.toFixed(2)}x) está por debajo del objetivo de rentabilidad de 2.5x.`);
  if (trendRoas < avgRoas * 0.85) alerts.push(`Tendencia de ROAS de los últimos días en descenso — revisar fatiga creativa.`);
  if (worstCampaign && worstCampaign.cpc > 2) alerts.push(`CPC de "${worstCampaign.name}" muy alto (${worstCampaign.cpc.toFixed(2)}). Revisar segmentación.`);

  return { summary, recommendations, alerts };
}
