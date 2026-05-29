import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Zap,
  DollarSign,
  ShoppingBag,
  RefreshCw,
} from 'lucide-react';
import type { Client, ClientStatus, ProjectType, ClientMetricsSnapshot } from '@/types/client';
import type { AdPlatform } from '@/types/metrics';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { withAlpha } from '@/utils/colorGenerator';
import { formatRelative } from '@/utils/dateHelpers';
import { useClientStore } from '@/store/useClientStore';
import { fetchPlatformDailyMetrics } from '@/services/adsIntegrations';
import { toast } from '@/store/useToastStore';
import { ClientTasksHoverPanel } from './ClientTasksHoverPanel';
import { cn } from '@/utils/cn';

const statusLabel: Record<ClientStatus, { text: string; tone: 'success' | 'warning' | 'info' | 'neutral' | 'danger' }> = {
  active: { text: 'Activo', tone: 'success' },
  planning: { text: 'Planificación', tone: 'info' },
  onboarding: { text: 'Onboarding', tone: 'accent' as 'info' },
  paused: { text: 'Pausa', tone: 'warning' },
  completed: { text: 'Completado', tone: 'neutral' },
};

const projectTypeLabel: Record<ProjectType, string> = {
  ecommerce: 'Ecommerce',
  launch: 'Lanzamiento',
  evergreen: 'Evergreen',
  personal_brand: 'Marca Personal',
  other: 'Otro',
};

export function ClientCard({ client, index = 0 }: { client: Client; index?: number }) {
  const navigate = useNavigate();
  const updateClient = useClientStore((s) => s.updateClient);
  const status = statusLabel[client.status];
  const accent = client.primaryColor;
  const [hover, setHover] = useState(false);
  const [refreshingInverted, setRefreshingInverted] = useState(false);

  const m = client.metrics;
  const invertedValue = m.invertedThisMonth ?? client.monthlyAdsBudget;
  const salesCount = m.salesCount ?? 0;
  const revenue = m.revenueAccumulated ?? 0;
  const target = m.monthlyRevenueTarget;
  const salesColor: 'success' | 'warning' | 'danger' | undefined = (() => {
    if (target == null || target === 0) return undefined;
    const ratio = revenue / target;
    if (ratio >= 1) return 'success';
    if (ratio >= 0.7) return 'warning';
    return 'danger';
  })();

  const refreshInverted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshingInverted) return;
    setRefreshingInverted(true);
    try {
      const now = new Date();
      const daysElapsed = now.getDate(); // del 1 al hoy
      const connectedPlatforms: AdPlatform[] = (Object.entries(client.adsConnected) as Array<[AdPlatform, boolean]>)
        .filter(([p, v]) => v && p !== 'ga4')
        .map(([p]) => p);
      if (connectedPlatforms.length === 0) {
        toast.info(`${client.name} no tiene plataformas de ADS conectadas.`);
        setRefreshingInverted(false);
        return;
      }
      let total = 0;
      for (const platform of connectedPlatforms) {
        const series = fetchPlatformDailyMetrics(client.id, platform, daysElapsed);
        total += series.reduce((s, d) => s + d.metrics.spend, 0);
      }
      const next: Partial<ClientMetricsSnapshot> = {
        ...client.metrics,
        invertedThisMonth: Math.round(total),
        invertedThisMonthFresh: true,
      };
      updateClient(client.id, { metrics: { ...client.metrics, ...next } });
      toast.success(`Inversión actualizada para ${client.name}`);
    } catch {
      toast.error('No pudimos refrescar la inversión.');
    } finally {
      setRefreshingInverted(false);
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 + index * 0.07, ease: [0.21, 0.94, 0.34, 1] }}
        whileHover={{ y: -3 }}
        className="group relative surface p-5 overflow-hidden cursor-pointer focus-ring"
        onClick={() => navigate(`/client/${client.id}`)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') navigate(`/client/${client.id}`);
        }}
        style={{
          boxShadow: `0 0 0 1px ${withAlpha(accent, 0.08)}, 0 12px 32px -16px ${withAlpha(accent, 0.45)}`,
        }}
      >
        {/* Acento superior */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
        {/* Halo de fondo */}
        <div
          className="absolute -top-20 -right-20 h-44 w-44 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"
          style={{ background: accent }}
        />

        <header className="relative flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
              />
              <Badge tone={status.tone}>{status.text}</Badge>
              <Badge tone="neutral">{projectTypeLabel[client.projectType]}</Badge>
            </div>
            <h3 className="heading text-lg font-bold leading-tight truncate">{client.name}</h3>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {client.industry} · {client.businessType}
            </p>
          </div>

          <button
            aria-label="Abrir cerebro"
            className="shrink-0 h-9 w-9 rounded-[10px] border border-border-default bg-bg-elevated flex items-center justify-center text-text-secondary group-hover:text-text-primary transition"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </header>

        {/* Bottleneck */}
        {client.metrics.bottleneck && (
          <div className="mb-3 flex items-start gap-2 rounded-[10px] border border-status-warning/30 bg-status-warning/10 p-2.5 text-[12px] text-status-warning">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="leading-snug">
              <strong className="font-semibold">{client.metrics.bottleneck.role}:</strong>{' '}
              {client.metrics.bottleneck.reason}
            </div>
          </div>
        )}

        {/* Métricas rápidas — 2 cols × 3 filas */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Metric
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="ROAS"
            value={client.metrics.roas !== null ? `${client.metrics.roas.toFixed(1)}x` : '—'}
            accent={accent}
            dim={client.metrics.roas === null}
          />
          <Metric
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Tareas"
            value={String(client.metrics.pendingTasksToday)}
            accent={accent}
          />
          <Metric
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Invertido"
            value={`$${invertedValue.toLocaleString()}`}
            subLabel={m.invertedThisMonthFresh ? 'este mes · actualizado' : 'este mes'}
            accent={accent}
            refresh={{ loading: refreshingInverted, onClick: refreshInverted }}
          />
          <Metric
            icon={<ShoppingBag className="h-3.5 w-3.5" />}
            label="Ventas"
            value={`${salesCount} ventas`}
            subLabel={revenue > 0 ? `$${revenue.toLocaleString()} fact.` : 'sin facturación aún'}
            accent={accent}
            valueColor={salesColor}
            dim={salesCount === 0}
          />
          <Metric
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Próx. reunión"
            value={client.metrics.nextMeetingAt ? formatRelative(client.metrics.nextMeetingAt) : '—'}
            accent={accent}
            small
          />
          <Metric
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Avance"
            value={`${client.metrics.progressPercent}%`}
            accent={accent}
          />
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${client.metrics.progressPercent}%` }}
              transition={{ duration: 0.9, delay: 0.2 + index * 0.07, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0.6)})` }}
            />
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/client/${client.id}`);
          }}
        >
          Abrir Cerebro
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </motion.article>

      {/* Hover popover con tareas (F4) — hermano del article para que el overflow-hidden del card no lo recorte */}
      <ClientTasksHoverPanel clientId={client.id} accent={accent} open={hover} />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  subLabel,
  accent,
  small,
  dim,
  valueColor,
  refresh,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subLabel?: string;
  accent: string;
  small?: boolean;
  dim?: boolean;
  valueColor?: 'success' | 'warning' | 'danger';
  refresh?: { loading: boolean; onClick: (e: React.MouseEvent) => void };
}) {
  const valueColorClass = valueColor === 'success' ? 'text-status-success'
    : valueColor === 'warning' ? 'text-status-warning'
    : valueColor === 'danger' ? 'text-status-danger'
    : dim ? 'text-text-muted'
    : 'text-text-primary';

  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/40 p-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted">
        <span className="flex items-center gap-1.5">
          <span style={{ color: accent }}>{icon}</span>
          {label}
        </span>
        {refresh && (
          <button
            onClick={refresh.onClick}
            disabled={refresh.loading}
            className="text-text-muted hover:text-text-primary transition disabled:opacity-50"
            aria-label="Actualizar"
            title="Actualizar con datos reales de ADS"
          >
            <RefreshCw className={cn('h-2.5 w-2.5', refresh.loading && 'animate-spin')} />
          </button>
        )}
      </div>
      <div className={`mt-1 font-semibold leading-tight ${small ? 'text-xs' : 'text-base'} ${valueColorClass}`}>
        {value}
      </div>
      {subLabel && (
        <div className="text-[9px] text-text-muted leading-tight mt-0.5 truncate">{subLabel}</div>
      )}
    </div>
  );
}
