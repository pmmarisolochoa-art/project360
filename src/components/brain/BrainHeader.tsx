import { ArrowLeft, Calendar, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Client, ClientStatus } from '@/types/client';
import { Badge } from '@/components/ui/Badge';
import { withAlpha } from '@/utils/colorGenerator';
import { formatRelative } from '@/utils/dateHelpers';

const statusTone: Record<ClientStatus, 'success' | 'warning' | 'info' | 'neutral' | 'danger' | 'accent'> = {
  active: 'success',
  planning: 'info',
  onboarding: 'accent',
  paused: 'warning',
  completed: 'neutral',
};

const statusText: Record<ClientStatus, string> = {
  active: 'Activo',
  planning: 'Planificación',
  onboarding: 'Onboarding',
  paused: 'Pausa',
  completed: 'Completado',
};

export function BrainHeader({ client }: { client: Client }) {
  const accent = client.primaryColor;
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden border-b border-border-subtle bg-bg-base"
      style={{
        background: `linear-gradient(135deg, ${withAlpha(accent, 0.10)} 0%, transparent 60%), #0A0A0F`,
      }}
    >
      <div
        className="absolute -top-32 -right-32 h-72 w-72 rounded-full blur-3xl opacity-25"
        style={{ background: accent }}
      />
      <div className="relative max-w-[1600px] mx-auto px-6 lg:px-8 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al Command Center
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
              />
              <Badge tone={statusTone[client.status]}>{statusText[client.status]}</Badge>
              <Badge tone="neutral">{client.businessType}</Badge>
              <Badge tone="info">{client.industry}</Badge>
            </div>
            <h1 className="heading text-3xl lg:text-4xl font-bold leading-tight" style={{ color: accent }}>
              {client.name}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {client.onboardingData.identity?.founderName} · {client.onboardingData.identity?.city},{' '}
              {client.onboardingData.identity?.country}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Kpi
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="ROAS"
              value={client.metrics.roas !== null ? `${client.metrics.roas.toFixed(1)}x` : '—'}
              accent={accent}
            />
            <Kpi
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Avance"
              value={`${client.metrics.progressPercent}%`}
              accent={accent}
            />
            <Kpi
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Próx. reunión"
              value={
                client.metrics.nextMeetingAt ? formatRelative(client.metrics.nextMeetingAt) : '—'
              }
              accent={accent}
            />
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function Kpi({
  icon, label, value, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-[10px] border px-3 py-2 min-w-[110px]"
      style={{ borderColor: withAlpha(accent, 0.25), background: withAlpha(accent, 0.06) }}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="text-sm font-semibold text-text-primary mt-1">{value}</div>
    </div>
  );
}
