import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, DollarSign, Users, Eye, MessageCircle, TrendingUp } from 'lucide-react';
import { addMonths, subMonths, format, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ContentPiece } from '@/types/content';
import { mesDe } from '@/utils/periodos';
import { useContentMetricsStore } from '@/store/useContentMetricsStore';
import { useLeadsStore } from '@/store/useLeadsStore';
import { totalCobradoLead } from '@/utils/ventas';
import { diasEnPipeline, estaAtascada } from '@/utils/contentPipeline';
import { withAlpha } from '@/utils/colorGenerator';

/**
 * "Mis resultados" — lo que importa para escalar NO es cuánto se publica,
 * es qué resultado trae lo publicado (founder, 24-nov-2026). Agrega por mes
 * publicado: alcance, comentarios, DMs/leads/ventas/facturado del orgánico,
 * comparado contra el mes anterior, más la salud del pipeline previo a
 * publicar (lo que todavía no es resultado, pero alimenta el mes que viene).
 */
export function ContentResultsTab({
  pieces, accent, onOpen,
}: {
  pieces: ContentPiece[];
  accent: string;
  onOpen: (piece: ContentPiece) => void;
}) {
  const [ref, setRef] = useState(new Date());
  const periodoActual = mesDe(ref);
  const periodoAnterior = mesDe(subMonths(ref, 1));

  const allSnapshots = useContentMetricsStore((s) => s.snapshots);
  const allLeads = useLeadsStore((s) => s.leads);

  const resumenDe = (periodo: { desde: Date; hasta: Date }) => {
    const piezasPeriodo = pieces.filter(
      (p) => p.status === 'published' && p.publishDate &&
        isWithinInterval(parseISO(p.publishDate), { start: periodo.desde, end: periodo.hasta }),
    );
    const idsPeriodo = new Set(piezasPeriodo.map((p) => p.id));

    // Última lectura por (pieza, frame) — sumada entre frames y piezas del
    // periodo. Las lecturas pueden capturarse cualquier día; se atribuyen al
    // mes en que la pieza SE PUBLICÓ, no a cuándo se tomó la lectura.
    const ultimaPorFrame = new Map<string, typeof allSnapshots[number]>();
    for (const s of allSnapshots) {
      if (!idsPeriodo.has(s.contentPieceId)) continue;
      const clave = `${s.contentPieceId}:${s.frameIndex}`;
      const previa = ultimaPorFrame.get(clave);
      if (!previa || s.capturedAt > previa.capturedAt) ultimaPorFrame.set(clave, s);
    }
    let alcance = 0, impresiones = 0, comentarios = 0, guardados = 0;
    for (const s of ultimaPorFrame.values()) {
      alcance += s.reach ?? 0;
      impresiones += s.impressions ?? 0;
      comentarios += s.comments ?? 0;
      guardados += s.saves ?? 0;
    }

    const leadsPeriodo = allLeads.filter((l) => l.originContentPieceId && idsPeriodo.has(l.originContentPieceId));
    const ventasPeriodo = leadsPeriodo.filter((l) => l.etapa === 'ganado');
    const facturado = ventasPeriodo.reduce((sum, l) => sum + totalCobradoLead(l), 0);

    return {
      publicadas: piezasPeriodo.length,
      alcance, impresiones, comentarios, guardados,
      dms: leadsPeriodo.length,
      leadsCalificados: leadsPeriodo.filter((l) => l.etapa !== 'nuevo' && l.etapa !== 'no_calificado').length,
      ventas: ventasPeriodo.length,
      facturado,
    };
  };

  // Sin useMemo a propósito: el volumen de piezas de un cliente es chico y
  // envolverlo complica las dependencias (resumenDe cambia en cada render)
  // sin ganancia real de rendimiento.
  const actual = resumenDe(periodoActual);
  const anterior = resumenDe(periodoAnterior);

  // Salud del pipeline previo a publicar — no es resultado todavía, pero es
  // lo que alimenta el resultado del mes que viene.
  const sinEmpezar = pieces.filter((p) => p.status === 'not_started' && !p.script?.trim() && !p.caption?.trim()).length;
  const conGuion = pieces.filter((p) => p.status !== 'published' && (p.script?.trim() || p.caption?.trim())).length;
  const enProceso = pieces.filter((p) => p.status !== 'published' && p.status !== 'not_started').length;

  const masQuietas = useMemo(
    () => pieces.filter(estaAtascada).sort((a, b) => diasEnPipeline(b) - diasEnPipeline(a)).slice(0, 8),
    [pieces],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setRef((d) => subMonths(d, 1))} className="h-7 w-7 rounded-md border border-border-default hover:bg-bg-elevated flex items-center justify-center">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-semibold capitalize w-36 text-center">{format(ref, 'MMMM yyyy', { locale: es })}</span>
          <button onClick={() => setRef((d) => addMonths(d, 1))} className="h-7 w-7 rounded-md border border-border-default hover:bg-bg-elevated flex items-center justify-center">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="text-[11px] text-text-muted">Los resultados se atribuyen al mes en que cada pieza se publicó</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultCard icon={<TrendingUp className="h-4 w-4" />} label="Publicadas" value={String(actual.publicadas)} delta={actual.publicadas - anterior.publicadas} accent={accent} invertido />
        <ResultCard icon={<Eye className="h-4 w-4" />} label="Alcance" value={actual.alcance.toLocaleString('es-CO')} delta={actual.alcance - anterior.alcance} accent={accent} />
        <ResultCard icon={<MessageCircle className="h-4 w-4" />} label="Comentarios" value={String(actual.comentarios)} delta={actual.comentarios - anterior.comentarios} accent={accent} />
        <ResultCard icon={<Users className="h-4 w-4" />} label="DM (ManyChat)" value={String(actual.dms)} delta={actual.dms - anterior.dms} accent={accent} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultCard label="Leads calificados" value={String(actual.leadsCalificados)} delta={actual.leadsCalificados - anterior.leadsCalificados} accent={accent} />
        <ResultCard label="Ventas" value={String(actual.ventas)} delta={actual.ventas - anterior.ventas} accent={accent} destacado />
        <ResultCard icon={<DollarSign className="h-4 w-4" />} label="Facturado" value={`$${actual.facturado.toLocaleString('es-CO')}`} delta={actual.facturado - anterior.facturado} accent={accent} destacado />
        <ResultCard label="Guardados" value={String(actual.guardados)} delta={actual.guardados - anterior.guardados} accent={accent} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 px-3 py-2.5 text-center">
          <div className="text-xl font-bold">{sinEmpezar}</div>
          <div className="text-[10px] text-text-muted">Ideas sin guion</div>
        </div>
        <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 px-3 py-2.5 text-center">
          <div className="text-xl font-bold">{conGuion}</div>
          <div className="text-[10px] text-text-muted">Con guion, sin publicar</div>
        </div>
        <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 px-3 py-2.5 text-center">
          <div className="text-xl font-bold">{enProceso}</div>
          <div className="text-[10px] text-text-muted">En proceso</div>
        </div>
      </div>

      {masQuietas.length > 0 && (
        <div className="rounded-[12px] border border-border-default bg-bg-surface p-4">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Lo que lleva más días quieto
          </h4>
          <div className="space-y-1.5">
            {masQuietas.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p)}
                className="w-full flex items-center justify-between text-[12px] text-left rounded-md px-2 py-1.5 hover:bg-bg-elevated"
              >
                <span className="truncate flex-1">{p.title || 'Sin título'}</span>
                <span className="text-text-muted ml-2 shrink-0">{diasEnPipeline(p)} días</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  icon, label, value, delta, accent, destacado, invertido,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  delta: number;
  accent: string;
  /** El número "bueno" es más grande (ventas, facturado). */
  destacado?: boolean;
  /** Para piezas publicadas: subir no es necesariamente mejor (es cantidad, no resultado). */
  invertido?: boolean;
}) {
  const subio = delta > 0;
  const tonoDelta = delta === 0 ? 'text-text-muted' : invertido ? 'text-text-muted' : subio ? 'text-status-success' : 'text-status-danger';
  return (
    <div
      className="rounded-[10px] border p-3"
      style={destacado ? { borderColor: withAlpha(accent, 0.4), background: withAlpha(accent, 0.08) } : { borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wide mb-1">
        {icon}{label}
      </div>
      <div className="text-lg font-bold text-text-primary">{value}</div>
      {delta !== 0 && !invertido && (
        <div className={`text-[11px] ${tonoDelta}`}>{subio ? '+' : ''}{delta.toLocaleString('es-CO')} vs mes anterior</div>
      )}
    </div>
  );
}
