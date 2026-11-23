import { useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Target } from 'lucide-react';
import type { Client } from '@/types/client';
import type { FinanzasMensual } from '@/types/finanzas';
import { useLeadsStore } from '@/store/useLeadsStore';
import { useFinanzasStore } from '@/store/useFinanzasStore';
import { periodoActual, periodoLabel, ultimosPeriodos, ingresosDelMes, ventasCerradasDelMes } from '@/utils/finanzas';
import { Textarea } from '@/components/ui/Textarea';
import { withAlpha } from '@/utils/colorGenerator';

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Input de dinero con puntos de miles mientras se escribe — mismo patrón que `MoneyInput` de VentasModule.tsx. */
function MoneyInput({
  value, onChangeRaw, onBlur, disabled,
}: { value: string; onChangeRaw: (raw: string) => void; onBlur: () => void; disabled?: boolean }) {
  const formateado = value ? Number(value.replace(/\D/g, '')).toLocaleString('es-CO') : '';
  return (
    <input
      type="text" inputMode="numeric" disabled={disabled} value={formateado}
      onChange={(e) => onChangeRaw(e.target.value.replace(/\D/g, ''))}
      onBlur={onBlur}
      className="w-full mt-1 rounded-[10px] border border-border-default bg-bg-base px-3 py-2 text-sm font-mono disabled:opacity-60"
    />
  );
}

function StatCard({
  icon, label, value, accent, sub,
}: { icon: React.ReactNode; label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="rounded-[12px] border border-border-subtle p-4" style={{ background: withAlpha(accent, 0.06) }}>
      <div className="flex items-center gap-2 text-[11px] text-text-muted uppercase tracking-wide mb-2">
        {icon} {label}
      </div>
      <div className="font-mono font-bold text-xl" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[11px] text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

/**
 * Montado con `key={periodo}` por el padre — así el estado local de los
 * inputs arranca de cero (o del registro guardado) al cambiar de mes, sin
 * necesitar un efecto que empuje `setState` tras el render.
 */
function MesEditor({
  client, periodo, registroMes, ingresos, ventasCerradas, readOnly, guardarMes,
}: {
  client: Client;
  periodo: string;
  registroMes: FinanzasMensual | undefined;
  ingresos: number;
  ventasCerradas: number;
  readOnly: boolean;
  guardarMes: (clientId: string, periodo: string, patch: Partial<FinanzasMensual>) => void;
}) {
  const accent = client.primaryColor;
  const [gastosAds, setGastosAds] = useState(registroMes?.gastosAds ? String(Math.round(registroMes.gastosAds)) : '');
  const [gastosOtros, setGastosOtros] = useState(registroMes?.gastosOtros ? String(Math.round(registroMes.gastosOtros)) : '');
  const [metaIngresos, setMetaIngresos] = useState(registroMes?.metaIngresos ? String(Math.round(registroMes.metaIngresos)) : '');
  const [notas, setNotas] = useState(registroMes?.notas ?? '');

  const gastos = (Number(gastosAds) || 0) + (Number(gastosOtros) || 0);
  const margen = ingresos - gastos;
  const meta = Number(metaIngresos) || 0;
  const cumplimiento = meta > 0 ? ingresos / meta : null;
  const colorCumplimiento = cumplimiento == null ? accent
    : cumplimiento >= 1 ? '#0CA30C' : cumplimiento >= 0.7 ? '#E0A800' : '#D03B3B';

  const guardarCampo = (patch: Partial<FinanzasMensual>) => {
    if (readOnly) return;
    guardarMes(client.id, periodo, patch);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Ingresos del mes" value={fmt(ingresos)} accent="#0CA30C"
          sub={`Cerrado en el mes: ${fmt(ventasCerradas)}`} />
        <StatCard icon={<TrendingDown className="h-3.5 w-3.5" />} label="Gastos del mes" value={fmt(gastos)} accent="#D03B3B" />
        <StatCard icon={<Wallet className="h-3.5 w-3.5" />} label="Margen" value={fmt(margen)} accent={margen >= 0 ? '#0CA30C' : '#D03B3B'} />
        <StatCard icon={<Target className="h-3.5 w-3.5" />} label="Cumplimiento de meta"
          value={cumplimiento == null ? '—' : `${Math.round(cumplimiento * 100)}%`} accent={colorCumplimiento} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <label className="block">
          <span className="text-xs font-medium text-text-secondary">Inversión en ads</span>
          <MoneyInput value={gastosAds} disabled={readOnly} onChangeRaw={setGastosAds}
            onBlur={() => guardarCampo({ gastosAds: Number(gastosAds) || 0 })} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-text-secondary">Otros gastos</span>
          <MoneyInput value={gastosOtros} disabled={readOnly} onChangeRaw={setGastosOtros}
            onBlur={() => guardarCampo({ gastosOtros: Number(gastosOtros) || 0 })} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-text-secondary">Meta de ingresos del mes</span>
          <MoneyInput value={metaIngresos} disabled={readOnly} onChangeRaw={setMetaIngresos}
            onBlur={() => guardarCampo({ metaIngresos: Number(metaIngresos) || null })} />
        </label>
      </div>

      <Textarea
        label="Notas del mes" disabled={readOnly} value={notas}
        onChange={(e) => setNotas(e.target.value)}
        onBlur={() => guardarCampo({ notas })}
        placeholder="Contexto que explique el número — campaña puntual, mes bajo de temporada, etc."
        rows={2}
      />
    </>
  );
}

export function FinanzasModule({ client, readOnly = false }: { client: Client; readOnly?: boolean }) {
  const allLeads = useLeadsStore((s) => s.leads);
  // Seleccionar el array crudo y filtrar aquí (no llamar `byClient()` como
  // selector): ese método crea un array nuevo en cada invocación y Zustand
  // entra en loop infinito de renders al no poder cachear el snapshot
  // (visto en vivo, 13-nov-2026).
  const allRegistros = useFinanzasStore((s) => s.registros);
  const registros = useMemo(() => allRegistros.filter((r) => r.clientId === client.id), [allRegistros, client.id]);
  const guardarMes = useFinanzasStore((s) => s.guardarMes);

  const [periodo, setPeriodo] = useState(periodoActual());
  const periodos = useMemo(() => ultimosPeriodos(12), []);
  const registroMes = registros.find((r) => r.periodo === periodo);

  const ingresos = useMemo(() => ingresosDelMes(allLeads, client.id, periodo), [allLeads, client.id, periodo]);
  const ventasCerradas = useMemo(() => ventasCerradasDelMes(allLeads, client.id, periodo), [allLeads, client.id, periodo]);

  return (
    <div className="space-y-4">
      <section className="surface p-5">
        <header className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="heading text-base font-bold flex items-center gap-1.5">
              <Wallet className="h-4 w-4" /> Finanzas de {client.name}
            </h3>
            <p className="text-[11px] text-text-muted">
              Ingresos = ventas ganadas y cobradas en Ventas; gastos se registran aquí mes a mes.
            </p>
          </div>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-[10px] border border-border-default bg-bg-base px-3 py-2 text-sm capitalize"
          >
            {periodos.map((p) => (
              <option key={p} value={p} className="capitalize">{periodoLabel(p)}</option>
            ))}
          </select>
        </header>

        <MesEditor
          key={periodo}
          client={client}
          periodo={periodo}
          registroMes={registroMes}
          ingresos={ingresos}
          ventasCerradas={ventasCerradas}
          readOnly={readOnly}
          guardarMes={guardarMes}
        />
      </section>

      <section className="surface p-5">
        <h3 className="heading text-sm font-bold mb-3">Historial</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide border-b border-border-subtle">
                <th className="py-2 pr-4">Mes</th>
                <th className="py-2 pr-4">Ingresos</th>
                <th className="py-2 pr-4">Gastos</th>
                <th className="py-2 pr-4">Margen</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map((p) => {
                const r = registros.find((x) => x.periodo === p);
                const ing = ingresosDelMes(allLeads, client.id, p);
                const gas = (r?.gastosAds ?? 0) + (r?.gastosOtros ?? 0);
                if (ing === 0 && gas === 0 && p !== periodo) return null;
                return (
                  <tr key={p} className={`border-b border-border-subtle/50 ${p === periodo ? 'bg-bg-base/40' : ''}`}>
                    <td className="py-2 pr-4 capitalize">{periodoLabel(p)}</td>
                    <td className="py-2 pr-4 font-mono">{fmt(ing)}</td>
                    <td className="py-2 pr-4 font-mono">{fmt(gas)}</td>
                    <td className="py-2 pr-4 font-mono" style={{ color: ing - gas >= 0 ? '#0CA30C' : '#D03B3B' }}>
                      {fmt(ing - gas)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
