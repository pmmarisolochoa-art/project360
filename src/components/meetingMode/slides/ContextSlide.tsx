import { useClientStore } from '@/store/useClientStore';
import { useLeadsStore } from '@/store/useLeadsStore';
import { avanceForClient } from '@/utils/avance';
import { ventasForClient } from '@/utils/ventas';
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
 * Estado actual del cliente, en vivo — avance y ROAS se DERIVAN de tareas y
 * leads reales (mismo cálculo que la tarjeta del Dashboard: `avanceForClient`
 * y `ventasForClient`), no del campo guardado `client.metrics.progressPercent`
 * / `.roas`, que puede quedarse viejo sin que nadie lo note (encontrado
 * probando con datos reales: el Dashboard mostraba 48% / 6.9x para un
 * cliente y esta diapositiva, leyendo el campo guardado, mostraba 0% / "—").
 * Solo lo que de verdad no se recalcula en vivo (inversión del mes, próxima
 * reunión) sigue saliendo de `client.metrics`.
 */
export function ContextSlide({ clientId }: { clientId: string; accent: string }) {
  const client = useClientStore((s) => s.clients.find((c) => c.id === clientId));
  const tasks = useClientStore((s) => s.tasks);
  const leads = useLeadsStore((s) => s.leads);

  if (!client) {
    return (
      <div className="rounded-[14px] border border-border-default border-dashed p-8 text-center text-text-muted">
        Sin datos de cliente disponibles.
      </div>
    );
  }

  const avance = avanceForClient(tasks, clientId);
  const ventas = ventasForClient(leads, clientId);
  const invertido = client.metrics.invertedThisMonth ?? client.monthlyAdsBudget;
  const roas = invertido > 0 && ventas.cashCollected > 0 ? ventas.cashCollected / invertido : null;

  const m = client.metrics;
  const proxima = m.nextMeetingAt ? format(parseISO(m.nextMeetingAt), "d 'de' MMM · HH:mm", { locale: es }) : '—';

  return (
    <div className="grid grid-cols-2 gap-4">
      <Stat label="Avance" value={`${avance}%`} subLabel="tareas completadas" />
      <Stat label="ROAS" value={roas != null ? `${roas.toFixed(1)}x` : '—'} subLabel={roas != null ? 'cash collected ÷ invertido' : 'falta invertido o cobro'} dim={roas == null} />
      <Stat
        label="Invertido este mes"
        value={invertido > 0 ? `$${invertido.toLocaleString('es')}` : '—'}
        subLabel={invertido > 0 ? (m.invertedThisMonthFresh ? 'actualizado' : '⚠ puede no estar al día') : undefined}
        dim={invertido <= 0}
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
