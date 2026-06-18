import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Link2, Sparkles, AlertTriangle, RefreshCw, CheckCircle2, XCircle,
  TrendingUp, DollarSign, Eye, MousePointerClick, FlaskConical,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from 'recharts';
import type { Client } from '@/types/client';
import type { AdPlatform } from '@/types/metrics';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  fetchPlatformDailyMetrics, fetchCampaigns, platformLabel,
  type Campaign, type DailyMetric,
} from '@/services/adsIntegrations';
import { generateMetricsInsights } from '@/services/claudeInsights';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/metricsCalculator';
import { withAlpha } from '@/utils/colorGenerator';
import { useClientStore } from '@/store/useClientStore';

const PLATFORMS: AdPlatform[] = ['meta', 'google', 'tiktok', 'ga4'];
const PERIODS = [
  { value: 7, label: '7 días' },
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
];

export function MetricsModule({ client }: { client: Client }) {
  const accent = client.primaryColor;
  const updateClient = useClientStore((s) => s.updateClient);
  const [period, setPeriod] = useState<number>(14);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof generateMetricsInsights>> | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const connectedPlatforms = useMemo(
    () => (Object.entries(client.adsConnected) as Array<[AdPlatform, boolean]>)
      .filter(([p, v]) => v && p !== 'ga4')
      .map(([p]) => p),
    [client.adsConnected],
  );

  const trend: DailyMetric[] = useMemo(() => {
    if (connectedPlatforms.length === 0) return [];
    // Suma de métricas diarias por plataforma conectada.
    const days = period;
    const merged: DailyMetric[] = [];
    const series = connectedPlatforms.map((p) => fetchPlatformDailyMetrics(client.id, p, days));
    for (let i = 0; i < days; i++) {
      const date = series[0][i].date;
      const m = series.reduce(
        (acc, s) => {
          const x = s[i].metrics;
          acc.spend += x.spend;
          acc.reach += x.reach;
          acc.impressions += x.impressions;
          acc.clicks += x.clicks;
          return acc;
        },
        { spend: 0, reach: 0, impressions: 0, clicks: 0 },
      );
      const ctr = m.impressions > 0 ? m.clicks / m.impressions : 0;
      const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
      const cpl = cpc * 4.5;
      const avgRoas = series.reduce((s, srs) => s + srs[i].metrics.roas, 0) / series.length;
      merged.push({
        date,
        metrics: { ...m, ctr, cpc, cpl, roas: avgRoas },
      });
    }
    return merged;
  }, [client.id, connectedPlatforms, period]);

  const campaigns: Campaign[] = useMemo(
    () => fetchCampaigns(client.id, connectedPlatforms),
    [client.id, connectedPlatforms],
  );

  const totals = useMemo(() => {
    return trend.reduce(
      (acc, t) => {
        acc.spend += t.metrics.spend;
        acc.reach += t.metrics.reach;
        acc.impressions += t.metrics.impressions;
        acc.clicks += t.metrics.clicks;
        return acc;
      },
      { spend: 0, reach: 0, impressions: 0, clicks: 0 },
    );
  }, [trend]);

  const overallRoas = trend.length ? trend[trend.length - 1].metrics.roas : 0;
  const overallCtr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const overallCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  // Métricas derivadas de los datos disponibles (0D). Las que el modelo demo
  // no tiene aún (resultados, compras, visitas, video) se muestran como "—".
  const frecuencia = totals.reach > 0 ? totals.impressions / totals.reach : null;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null;

  useEffect(() => {
    setInsights(null);
  }, [period, client.id]);

  const runInsights = async () => {
    setLoadingInsights(true);
    try {
      const r = await generateMetricsInsights({ client, campaigns, trend });
      setInsights(r);
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner: datos de demostración hasta tener OAuth real con Meta/Google/TikTok/GA4 */}
      <div
        className="rounded-[12px] border p-3 flex items-start gap-3"
        style={{
          borderColor: 'rgba(245,158,11,0.3)',
          background: 'rgba(245,158,11,0.08)',
        }}
      >
        <FlaskConical className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#F59E0B' }} />
        <div className="text-[12px] leading-relaxed text-text-secondary">
          <strong className="text-text-primary">Datos de demostración.</strong>{' '}
          Las métricas que ves aquí son simuladas (deterministas por cliente y plataforma).
          Cuando conectes tu cuenta real de Meta Ads, Google Ads, TikTok o GA4 mediante OAuth,
          el módulo cambiará automáticamente a datos reales.
        </div>
      </div>

      {/* Conexiones */}
      <div className="surface p-5">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h3 className="heading text-base font-bold flex items-center gap-1.5">
              <Link2 className="h-4 w-4" /> Conexión de plataformas
            </h3>
            <p className="text-[11px] text-text-muted">Activa el switch para empezar a sincronizar métricas</p>
          </div>
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PLATFORMS.map((p) => {
            const connected = client.adsConnected[p];
            return (
              <button
                key={p}
                onClick={() =>
                  updateClient(client.id, {
                    adsConnected: { ...client.adsConnected, [p]: !connected },
                  })
                }
                className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 text-left hover:bg-bg-elevated transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-text-primary">{platformLabel(p)}</span>
                  {connected ? (
                    <CheckCircle2 className="h-4 w-4 text-status-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-text-muted" />
                  )}
                </div>
                <Badge tone={connected ? 'success' : 'neutral'}>
                  {connected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {connectedPlatforms.length === 0 ? (
        <div className="surface p-10 text-center">
          <div
            className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: withAlpha(accent, 0.15), color: accent }}
          >
            <Link2 className="h-5 w-5" />
          </div>
          <h3 className="heading text-lg mb-1">Sin plataformas conectadas</h3>
          <p className="text-sm text-text-secondary">
            Activa al menos una plataforma de ADS arriba para ver el dashboard de métricas.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Inversión total" value={formatCurrency(totals.spend)} accent={accent} />
            <KpiCard icon={<Eye className="h-4 w-4" />} label="Alcance" value={formatNumber(totals.reach)} accent={accent} />
            <KpiCard icon={<MousePointerClick className="h-4 w-4" />} label="Clics" value={formatNumber(totals.clicks)} accent={accent} />
            <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="CTR" value={formatPercent(overallCtr, 2)} accent={accent} />
            <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="ROAS hoy" value={`${overallRoas.toFixed(2)}x`} accent={accent} highlight />
          </div>

          {/* Métricas conectadas — dos columnas (0D) */}
          <div className="surface p-5">
            <header className="mb-3">
              <h3 className="heading text-base font-bold">Métricas de campaña</h3>
              <p className="text-[11px] text-text-muted">
                Período seleccionado · {connectedPlatforms.map(platformLabel).join(' · ')}.
                Los campos en “—” se llenan al conectar tu cuenta real de Meta Ads.
              </p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              {/* Columna 1 — Rendimiento */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Rendimiento</div>
                <MetricLine label="Presupuesto" value={client.monthlyAdsBudget ? formatCurrency(client.monthlyAdsBudget) : '—'} />
                <MetricLine label="Importe gastado" value={formatCurrency(totals.spend)} />
                <MetricLine label="Resultado" value="—" />
                <MetricLine label="Costo por resultado" value="—" />
                <MetricLine label="Impresiones" value={formatNumber(totals.impressions)} />
                <MetricLine label="Alcance" value={formatNumber(totals.reach)} />
                <MetricLine label="Frecuencia" value={frecuencia != null ? frecuencia.toFixed(2) : '—'} />
                <MetricLine label="CPM" value={cpm != null ? formatCurrency(cpm) : '—'} />
                <MetricLine label="Pagos iniciados" value="—" />
                <MetricLine label="Costo por pago iniciado" value="—" />
                <MetricLine label="Compras" value="—" />
                <MetricLine label="Costo por compra" value="—" />
              </div>
              {/* Columna 2 — Clics */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Clics</div>
                <MetricLine label="Clics en el enlace" value={formatNumber(totals.clicks)} />
                <MetricLine label="CPC" value={formatCurrency(overallCpc)} />
                <MetricLine label="CTR" value={formatPercent(overallCtr, 2)} />
                <MetricLine label="Visitas a la página de destino" value="—" />
                <MetricLine label="Costo por visita a la página de destino" value="—" />
              </div>
            </div>

            {/* Indicadores de rendimiento (calculados) */}
            <div className="mt-5 pt-4 border-t border-border-subtle/40">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Indicadores de rendimiento</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                <IndicatorCard label="Hook Rate" value="—" tip="% de personas que vieron 3+ segundos de tu video (Reproducciones 3s ÷ Alcance)" />
                <IndicatorCard label="Hold Rate" value="—" tip="% de personas que vieron el video completo (Thruplays ÷ Alcance)" />
                <IndicatorCard label="Carga página" value="—" tip="% de clics que llegaron a la página (Visitas ÷ Clics en enlace)" />
                <IndicatorCard label="Conv. a pago iniciado" value="—" tip="% de visitas que iniciaron pago (Pagos iniciados ÷ Visitas)" />
                <IndicatorCard label="Conv. a compras" value="—" tip="% de visitas que completaron la compra (Compras ÷ Visitas)" />
              </div>
            </div>
          </div>

          {/* Tendencia */}
          <div className="surface p-5">
            <header className="flex items-center justify-between mb-4">
              <div>
                <h3 className="heading text-base font-bold">Tendencia de inversión y ROAS</h3>
                <p className="text-[11px] text-text-muted">
                  CPC actual {formatCurrency(overallCpc)} · {connectedPlatforms.map(platformLabel).join(' · ')}
                </p>
              </div>
              <div className="inline-flex rounded-[10px] border border-border-subtle bg-bg-base/40 p-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1.5 rounded-md text-xs transition ${
                      period === p.value
                        ? 'bg-bg-elevated text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </header>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.map((d) => ({ date: d.date.slice(5), spend: d.metrics.spend, roas: d.metrics.roas }))}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="var(--chart-axis)" fontSize={11} />
                  <YAxis yAxisId="left" stroke="var(--chart-axis)" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--chart-axis)" fontSize={11} />
                  <RTooltip
                    contentStyle={{
                      background: 'var(--chart-tooltip-bg)',
                      border: '1px solid var(--chart-tooltip-border)',
                      borderRadius: 10,
                      fontSize: 12,
                      color: 'var(--chart-tooltip-text)',
                    }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="spend" stroke={accent} strokeWidth={2} dot={false} name="Inversión" />
                  <Line yAxisId="right" type="monotone" dataKey="roas" stroke="#06B6D4" strokeWidth={2} dot={false} name="ROAS" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Campañas */}
          <div className="surface p-5">
            <header className="flex items-center justify-between mb-3">
              <h3 className="heading text-base font-bold">Campañas activas</h3>
              <span className="text-[11px] text-text-muted">{campaigns.length} campañas</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
                    <th className="py-2 pr-3">Campaña</th>
                    <th className="py-2 pr-3">Plataforma</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3 text-right">Spend</th>
                    <th className="py-2 pr-3 text-right">CTR</th>
                    <th className="py-2 pr-3 text-right">CPC</th>
                    <th className="py-2 pr-3 text-right">CPL</th>
                    <th className="py-2 pr-3 text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border-subtle/40 hover:bg-bg-elevated/30 transition"
                    >
                      <td className="py-2.5 pr-3 text-text-primary">{c.name}</td>
                      <td className="py-2.5 pr-3 text-text-secondary">{platformLabel(c.platform)}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={c.status === 'active' ? 'success' : c.status === 'paused' ? 'warning' : 'neutral'}>
                          {c.status === 'active' ? 'Activa' : c.status === 'paused' ? 'Pausada' : 'Finalizada'}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-text-primary">{formatCurrency(c.spend)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatPercent(c.ctr, 2)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatCurrency(c.cpc)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatCurrency(c.cpl)}</td>
                      <td
                        className="py-2.5 pr-3 text-right font-semibold"
                        style={{ color: c.roas >= 2.5 ? '#10B981' : c.roas >= 1.5 ? '#F59E0B' : '#EF4444' }}
                      >
                        {c.roas.toFixed(2)}x
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insights con IA */}
          <div className="surface p-5">
            <header className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="heading text-base font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" style={{ color: accent }} /> Insights con IA
                </h3>
                <p className="text-[11px] text-text-muted">
                  Análisis estratégico de Claude con benchmarks del sector
                </p>
              </div>
              <Button
                size="sm"
                leftIcon={loadingInsights ? undefined : <RefreshCw className="h-3.5 w-3.5" />}
                onClick={runInsights}
                loading={loadingInsights}
              >
                {insights ? 'Regenerar' : 'Generar insights'}
              </Button>
            </header>

            {insights ? (
              <div className="space-y-3">
                {insights.alerts.length > 0 && (
                  <div className="rounded-[10px] border border-status-danger/30 bg-status-danger/5 p-3 space-y-1.5">
                    {insights.alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-status-danger">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        {a}
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 text-sm text-text-primary leading-relaxed">
                  {insights.summary}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
                    Recomendaciones
                  </div>
                  <ul className="space-y-2">
                    {insights.recommendations.map((r, i) => (
                      <li
                        key={i}
                        className="rounded-[10px] p-3 text-sm text-text-secondary border"
                        style={{
                          borderColor: withAlpha(accent, 0.25),
                          background: withAlpha(accent, 0.06),
                        }}
                      >
                        <span className="mr-2" style={{ color: accent }}>›</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div
                className="rounded-[10px] border border-dashed p-6 text-center text-sm text-text-muted"
                style={{ borderColor: withAlpha(accent, 0.18) }}
              >
                Genera el análisis para ver resumen, recomendaciones y alertas automáticas.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon, label, value, accent, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="surface p-3"
      style={highlight ? { borderColor: withAlpha(accent, 0.35), boxShadow: `0 0 16px -8px ${accent}` } : undefined}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="kpi-number" style={highlight ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border-subtle/30 last:border-0">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <span className="text-xs font-semibold text-text-primary tabular-nums">{value}</span>
    </div>
  );
}

function IndicatorCard({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3" title={tip}>
      <div className="text-[10px] uppercase tracking-wider text-text-muted leading-tight">{label}</div>
      <div className="text-[18px] font-medium text-text-primary mt-1">{value}</div>
    </div>
  );
}
