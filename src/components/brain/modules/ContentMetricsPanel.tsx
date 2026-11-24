import { useMemo, useState } from 'react';
import { TrendingUp, Plus, Trash2, Users, Gauge, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ContentPiece } from '@/types/content';
import { RETENTION_FORMATS } from '@/types/content';
import { useContentMetricsStore } from '@/store/useContentMetricsStore';
import { useLeadsStore } from '@/store/useLeadsStore';
import { totalCobradoLead } from '@/utils/ventas';
import { withAlpha } from '@/utils/colorGenerator';
import { genId } from '@/utils/id';

/**
 * Panel de métricas orgánicas de una pieza publicada (migración 066).
 *
 * Límites de la API de Meta que este panel respeta a propósito:
 * - Hook/cuerpo/CTA: no hay retención por segmento vía API — se muestra un
 *   % agregado (tiempo promedio visto / duración), nunca por tramo.
 * - Carrusel: set de métricas agregado, sin detalle por slide (la API no lo da).
 * - Historia: una pieza = varios frames, cada uno con sus propias métricas
 *   de navegación — se captura antes de que expire a las 24h.
 *
 * Captura 100% manual por ahora; cuando la app de Meta esté conectada, las
 * mismas columnas (`source: 'meta_api'`) se llenan solas sin cambiar nada aquí.
 */

type FieldKey =
  | 'reach' | 'impressions' | 'likes' | 'comments' | 'shares' | 'saves'
  | 'profileVisits' | 'bioLinkClicks' | 'follows'
  | 'videoDurationSeconds' | 'avgWatchTimeSeconds'
  | 'exits' | 'replies' | 'tapsForward' | 'tapsBack'
  | 'adSpend';

const COMMON_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'reach', label: 'Alcance' },
  { key: 'impressions', label: 'Impresiones' },
  { key: 'likes', label: 'Me gusta' },
  { key: 'comments', label: 'Comentarios' },
  { key: 'shares', label: 'Compartidos' },
  { key: 'saves', label: 'Guardados' },
  { key: 'profileVisits', label: 'Visitas al perfil' },
  { key: 'bioLinkClicks', label: 'Toques al link' },
  { key: 'follows', label: 'Seguidores nuevos' },
  { key: 'adSpend', label: 'Pauta invertida (si se impulsó)' },
];

const VIDEO_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'videoDurationSeconds', label: 'Duración del video (seg)' },
  { key: 'avgWatchTimeSeconds', label: 'Tiempo promedio visto (seg)' },
];

const STORY_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'exits', label: 'Salidas' },
  { key: 'replies', label: 'Respuestas' },
  { key: 'tapsForward', label: 'Avances' },
  { key: 'tapsBack', label: 'Retrocesos' },
];

type Draft = Partial<Record<FieldKey, string>>;

function retentionPct(draft: Draft): number | null {
  const dur = Number(draft.videoDurationSeconds);
  const watch = Number(draft.avgWatchTimeSeconds);
  if (!dur || !watch || dur <= 0) return null;
  return Math.round((watch / dur) * 100);
}

export function ContentMetricsPanel({
  piece, accent, readOnly = false,
}: {
  piece: ContentPiece;
  accent: string;
  readOnly?: boolean;
}) {
  const snapshots = useContentMetricsStore((s) => s.byPiece(piece.id));
  const addSnapshot = useContentMetricsStore((s) => s.add);
  const removeSnapshot = useContentMetricsStore((s) => s.remove);
  const leadsAtribuidos = useLeadsStore((s) => s.leads.filter((l) => l.originContentPieceId === piece.id));

  // Se mide por RESULTADOS, no por volumen (founder, 24-nov-2026):
  // - DM: TODO lo que ManyChat capturó con la palabra clave de esta pieza.
  // - Leads calificados: de esos, los que avanzaron más allá de "nuevo" sin
  //   descartarse — un filtro intencionalmente más estricto que "DM".
  // - Ventas / Facturado: leads en etapa 'ganado' atribuidos a esta pieza.
  const dmCount = leadsAtribuidos.length;
  const leadsCalificados = leadsAtribuidos.filter((l) => l.etapa !== 'nuevo' && l.etapa !== 'no_calificado');
  const ventas = leadsAtribuidos.filter((l) => l.etapa === 'ganado');
  const facturado = ventas.reduce((sum, l) => sum + totalCobradoLead(l), 0);
  const conScore = leadsAtribuidos.filter((l) => typeof l.score === 'number');
  const scorePromedio = conScore.length > 0
    ? Math.round(conScore.reduce((sum, l) => sum + (l.score ?? 0), 0) / conScore.length)
    : null;
  const calidadLabel = scorePromedio === null ? null : scorePromedio >= 70 ? 'Alta' : scorePromedio >= 40 ? 'Media' : 'Baja';

  const adSpend = [...snapshots].reverse().find((s) => s.frameIndex === 0 && s.adSpend)?.adSpend;
  const roas = adSpend && adSpend > 0 ? facturado / adSpend : null;

  const isStory = piece.format === 'story';
  const isVideo = RETENTION_FORMATS.includes(piece.format);

  const frameIndices = useMemo(() => {
    if (!isStory) return [0];
    const fromSnapshots = snapshots.map((s) => s.frameIndex);
    const max = fromSnapshots.length > 0 ? Math.max(...fromSnapshots) : 0;
    const set = new Set<number>([...fromSnapshots]);
    for (let i = 1; i <= max; i++) set.add(i);
    if (set.size === 0) set.add(1);
    return Array.from(set).sort((a, b) => a - b);
  }, [isStory, snapshots]);

  const [extraFrames, setExtraFrames] = useState(0);
  const allFrames = isStory
    ? Array.from(new Set([...frameIndices, ...Array.from({ length: extraFrames }, (_, i) => Math.max(...frameIndices, 0) + i + 1)]))
    : frameIndices;

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2.5">
          <Users className="h-4 w-4" style={{ color: accent }} />
          Resultados (no cantidad)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <ResultTile label="DM (ManyChat)" value={String(dmCount)} />
          <ResultTile label="Leads calificados" value={String(leadsCalificados.length)} />
          <ResultTile label="Ventas" value={String(ventas.length)} tone={ventas.length > 0 ? 'good' : undefined} />
          <ResultTile label="Facturado" value={facturado > 0 ? `$${facturado.toLocaleString('es-CO')}` : '—'} tone={facturado > 0 ? 'good' : undefined} />
        </div>
        {(calidadLabel || roas !== null) && (
          <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-border-subtle text-[11px] text-text-secondary">
            {calidadLabel && <span>Calidad: <strong className="text-text-primary">{calidadLabel} · {scorePromedio}</strong></span>}
            {roas !== null && (
              <span className="inline-flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> ROAS: <strong className="text-text-primary">{roas.toFixed(1)}x</strong>
              </span>
            )}
          </div>
        )}
        {!piece.manychatKeyword && (
          <div className="text-[11px] text-status-warning mt-2.5">
            Sin palabra de ManyChat asignada — el DM/Lead solo se atribuirá si alguien lo marca a mano en Ventas.
          </div>
        )}
      </div>

      {allFrames.map((frameIndex) => (
        <FramePanel
          key={frameIndex}
          piece={piece}
          frameIndex={frameIndex}
          isStory={isStory}
          isVideo={isVideo}
          accent={accent}
          readOnly={readOnly}
          snapshots={snapshots.filter((s) => s.frameIndex === frameIndex)}
          onAdd={addSnapshot}
          onRemove={removeSnapshot}
        />
      ))}

      {isStory && !readOnly && (
        <button
          onClick={() => setExtraFrames((n) => n + 1)}
          className="w-full text-xs inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-default py-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar frame de la historia
        </button>
      )}
    </div>
  );
}

function ResultTile({ label, value, tone }: { label: string; value: string; tone?: 'good' }) {
  return (
    <div className="rounded-[8px] bg-bg-surface px-2.5 py-2">
      <div className="text-[10px] text-text-muted mb-0.5">{label}</div>
      <div className={tone === 'good' ? 'text-sm font-bold text-status-success' : 'text-sm font-bold text-text-primary'}>
        {value}
      </div>
    </div>
  );
}

function FramePanel({
  piece, frameIndex, isStory, isVideo, accent, readOnly, snapshots, onAdd, onRemove,
}: {
  piece: ContentPiece;
  frameIndex: number;
  isStory: boolean;
  isVideo: boolean;
  accent: string;
  readOnly: boolean;
  snapshots: ReturnType<typeof useContentMetricsStore.getState>['snapshots'];
  onAdd: (s: Parameters<ReturnType<typeof useContentMetricsStore.getState>['add']>[0]) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const fields = [...COMMON_FIELDS, ...(isVideo ? VIDEO_FIELDS : []), ...(isStory ? STORY_FIELDS : [])];
  const pct = isVideo ? retentionPct(draft) : null;

  const save = () => {
    const snapshot = {
      id: genId(),
      contentPieceId: piece.id,
      frameIndex,
      capturedAt: new Date().toISOString(),
      source: 'manual' as const,
      createdAt: new Date().toISOString(),
      ...Object.fromEntries(
        Object.entries(draft)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, Number(v)]),
      ),
    };
    onAdd(snapshot);
    setDraft({});
  };

  return (
    <div className="rounded-[10px] border border-border-subtle p-3 space-y-3">
      {isStory && (
        <div className="text-xs font-semibold text-text-secondary">Frame {frameIndex}</div>
      )}

      {!readOnly && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="block text-[10px] text-text-muted mb-1">{f.label}</span>
                <input
                  type="number"
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  className="w-full h-8 rounded-md border px-2 text-xs"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}
                />
              </label>
            ))}
          </div>
          {isVideo && pct !== null && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <Gauge className="h-3.5 w-3.5" style={{ color: accent }} />
              Retención aproximada: <strong>{pct}%</strong>
              <span className="text-text-muted">(agregada, no por tramo — Meta no expone hook/cuerpo/CTA por API)</span>
            </div>
          )}
          <button
            onClick={save}
            className="text-xs inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 hover:brightness-125 font-medium"
            style={{ color: accent, borderColor: withAlpha(accent, 0.4), background: withAlpha(accent, 0.10) }}
          >
            <TrendingUp className="h-3.5 w-3.5" /> Guardar lectura
          </button>
        </>
      )}

      {snapshots.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border-subtle">
          {[...snapshots].reverse().map((s) => (
            <div key={s.id} className="flex items-center justify-between text-[11px] text-text-secondary">
              <span>
                {format(parseISO(s.capturedAt), "d MMM, HH:mm", { locale: es })}
                {' — '}
                {s.reach ?? 0} alcance · {s.likes ?? 0} likes · {s.comments ?? 0} coment · {s.saves ?? 0} guardados
                {' · '}{s.follows ?? 0} seguidores
                {isVideo && s.videoDurationSeconds && s.avgWatchTimeSeconds
                  ? ` · ${Math.round((s.avgWatchTimeSeconds / s.videoDurationSeconds) * 100)}% retención`
                  : ''}
                {s.source === 'meta_api' ? ' · API' : ''}
              </span>
              {!readOnly && (
                <button onClick={() => onRemove(s.id)} className="text-text-muted hover:text-status-danger">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
