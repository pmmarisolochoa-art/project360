import { useClientStore } from '@/store/useClientStore';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function Stat({ label, value, subLabel, dim }: { label: string; value: string; subLabel?: string; dim?: boolean }) {
  return (
    <div className="rounded-[14px] border border-border-default p-5" style={{ background: 'var(--bg-surface)' }}>
      <div className="text-xs uppercase tracking-wider text-text-muted mb-1.5">{label}</div>
      <div className="text-3xl font-semibold" style={{ opacity: dim ? 0.5 : 1 }}>{value}</div>
      {subLabel && <div className="text-xs text-text-muted mt-1">{subLabel}</div>}
    </div>
  );
}

/**
 * Estado actual del cliente, jalado en vivo de `client.metrics` — el mismo
 * dato que pinta la tarjeta del cliente en el Dashboard. No se inventa nada:
 * si una métrica no está fresca, lo dice en vez de aparentar que sí.
 */
export function ContextSlide({ clientId }: { clientId: string; accent: string }) {
  const client = useClientStore((s) => s.clients.find((c) => c.id === clientId));

  if (!client) {
    return (
      <div className="rounded-[14px] border border-border-default border-dashed p-8 text-center text-text-muted">
        Sin datos de cliente disponibles.
      </div>
    );
  }

  const m = client.metrics;
  const proxima = m.nextMeetingAt ? format(parseISO(m.nextMeetingAt), "d 'de' MMM · HH:mm", { locale: es }) : '—';

  return (
    <div className="grid grid-cols-2 gap-4">
      <Stat label="Avance" value={`${Math.round(m.progressPercent)}%`} />
      <Stat label="ROAS" value={m.roas != null ? `${m.roas.toFixed(1)}x` : '—'} dim={m.roas == null} />
      <Stat
        label="Invertido este mes"
        value={m.invertedThisMonth != null ? `$${m.invertedThisMonth.toLocaleString('es')}` : '—'}
        subLabel={m.invertedThisMonth != null ? (m.invertedThisMonthFresh ? 'actualizado' : '⚠ puede no estar al día') : undefined}
        dim={m.invertedThisMonth == null}
      />
      <Stat label="Próxima reunión" value={proxima} />
      {m.bottleneck && (
        <div className="col-span-2 rounded-[14px] border border-status-warning/30 bg-status-warning/10 p-5">
          <div className="text-xs uppercase tracking-wider text-status-warning mb-1">Cuello de botella</div>
          <div className="text-base text-text-primary">{m.bottleneck.role} — {m.bottleneck.reason}</div>
        </div>
      )}
    </div>
  );
}
