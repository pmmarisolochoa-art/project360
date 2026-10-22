import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutGrid, CalendarDays, Plus, X, Sparkles, Trash2, Save,
  ChevronLeft, ChevronRight, Magnet, Upload, ArrowRight, ChevronDown, Check,
} from 'lucide-react';
import { ImportarContenidoCSVModal } from './ImportarContenidoCSVModal';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, differenceInDays,
  format, parseISO, isSameMonth, isToday, addMonths, subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type {
  ContentPiece, ContentStatus, ContentPlatform, ContentFormat,
} from '@/types/content';
import { CONTENT_STATUS_META, PLATFORM_META, FORMAT_LABEL, CTA_TYPE_LABEL, type CtaType } from '@/types/content';
import { ROLE_DEFS, type TeamRoleSlug } from '@/types/team';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useContentStore, DATE_FIELD_LABEL, STATUS_FLOW, type DateField } from '@/store/useContentStore';
import { toast } from '@/store/useToastStore';
import { generateContentCopy } from '@/services/claudeApi';
import { withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';
import { genId } from '@/utils/id';

/** Piezas "vivas" — todavía no llegaron a su destino final del pipeline. */
const ESTADOS_ABIERTOS: ContentStatus[] = ['not_started', 'recording', 'editing', 'review', 'sent_to_client', 'rejected', 'approved'];
const DIAS_ATASCADA = 7;

function diasEnPipeline(piece: ContentPiece): number {
  return differenceInDays(new Date(), parseISO(piece.createdAt));
}

function estaAtascada(piece: ContentPiece): boolean {
  return ESTADOS_ABIERTOS.includes(piece.status) && diasEnPipeline(piece) >= DIAS_ATASCADA;
}

export function ContentModule({ client, readOnly = false }: { client: Client; readOnly?: boolean }) {
  const allPieces = useContentStore((s) => s.pieces);
  const pieces = useMemo(
    () => allPieces.filter((p) => p.clientId === client.id),
    [allPieces, client.id],
  );
  const [tab, setTab] = useState<'pipeline' | 'kpis'>('pipeline');
  const [view, setView] = useState<'kanban' | 'calendar'>('calendar');
  const [editing, setEditing] = useState<ContentPiece | null>(null);
  const [creating, setCreating] = useState<{ date: Date } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const update = useContentStore((s) => s.update);
  const remove = useContentStore((s) => s.remove);

  // Selección múltiple — mismo patrón que TasksModule: checkbox por tarjeta,
  // barra flotante con "Mover a" / "Eliminar". Vive en el padre para que la
  // selección sobreviva al cambio entre Kanban y Calendario.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectedCount = selectedIds.size;
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const bulkMove = (status: ContentStatus) => {
    for (const id of selectedIds) update(id, { status });
    toast.success(`${selectedCount} pieza${selectedCount === 1 ? '' : 's'} movida${selectedCount === 1 ? '' : 's'}`);
    clearSelection();
  };
  const bulkDelete = () => {
    if (!confirm(`¿Eliminar ${selectedCount} pieza${selectedCount === 1 ? '' : 's'}? Esta acción no se puede deshacer.`)) return;
    for (const id of selectedIds) remove(id);
    toast.success(`${selectedCount} pieza${selectedCount === 1 ? '' : 's'} eliminada${selectedCount === 1 ? '' : 's'}`);
    clearSelection();
  };

  // Filtros del Pipeline — acotan Kanban y Calendario a la vez; a diferencia
  // de Ventas, Contenido no tiene fechas de cierre vs. creación que justifiquen
  // separar esto del universo de las KPIs, así que es un solo set de filtros.
  const [filtroPlataforma, setFiltroPlataforma] = useState<ContentPlatform | ''>('');
  const [filtroResponsable, setFiltroResponsable] = useState('');
  const responsables = useMemo(
    () => Array.from(new Set(pieces.map((p) => p.assignedTo).filter((v): v is string => !!v?.trim()))).sort(),
    [pieces],
  );
  const hayFiltros = !!(filtroPlataforma || filtroResponsable);
  const piecesFiltradas = useMemo(() => {
    let out = pieces;
    if (filtroPlataforma) out = out.filter((p) => p.platform === filtroPlataforma);
    if (filtroResponsable) out = out.filter((p) => p.assignedTo === filtroResponsable);
    return out;
  }, [pieces, filtroPlataforma, filtroResponsable]);

  // Atajo desde AlertsPanel "Resolver →" sobre content_pending_approval:
  // si la URL trae ?filter=in_review, cambiamos a kanban (donde la columna
  // "Revisión" hace de filtro visual) y avisamos al usuario.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('filter') === 'in_review') {
      setTab('pipeline');
      setView('kanban');
      toast.info('Contenidos en revisión visibles en la columna "Revisión"');
      const next = new URLSearchParams(searchParams);
      next.delete('filter');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const accent = client.primaryColor;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-[10px] border border-border-default bg-bg-surface p-1">
          {(['pipeline', 'kpis'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-[12px] font-semibold rounded-[7px] px-3.5 py-1.5 transition-colors"
              style={tab === t ? { background: withAlpha(accent, 0.16), color: accent } : { color: 'var(--text-secondary)' }}
            >
              {t === 'pipeline' ? 'Pipeline' : 'KPIs'}
            </button>
          ))}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" leftIcon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
              Importar CSV
            </Button>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating({ date: new Date() })}>
              Nueva pieza
            </Button>
          </div>
        )}
      </div>

      {tab === 'pipeline' ? (
        <>
          <div className="surface p-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-[10px] border border-border-subtle bg-bg-base/40 p-0.5">
              <ToggleButton active={view === 'kanban'} onClick={() => setView('kanban')} icon={<LayoutGrid className="h-3.5 w-3.5" />}>
                Kanban Pipeline
              </ToggleButton>
              <ToggleButton active={view === 'calendar'} onClick={() => setView('calendar')} icon={<CalendarDays className="h-3.5 w-3.5" />}>
                Calendario de Contenidos
              </ToggleButton>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <select
                value={filtroPlataforma}
                onChange={(e) => setFiltroPlataforma(e.target.value as ContentPlatform | '')}
                className="rounded-[8px] border border-border-default bg-bg-base px-2 py-1.5 focus-ring"
              >
                <option value="">Todas las plataformas</option>
                {Object.entries(PLATFORM_META).map(([v, m]) => (
                  <option key={v} value={v}>{m.emoji} {m.label}</option>
                ))}
              </select>
              <select
                value={filtroResponsable}
                onChange={(e) => setFiltroResponsable(e.target.value)}
                className="rounded-[8px] border border-border-default bg-bg-base px-2 py-1.5 focus-ring"
              >
                <option value="">Todos los responsables</option>
                {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {hayFiltros && (
                <button
                  onClick={() => { setFiltroPlataforma(''); setFiltroResponsable(''); }}
                  className="text-text-secondary hover:text-text-primary underline"
                >
                  Quitar filtros
                </button>
              )}
              {hayFiltros && (
                <span className="text-text-muted">{piecesFiltradas.length} de {pieces.length} piezas</span>
              )}
            </div>
          </div>

          {view === 'kanban' ? (
            <ContentKanban
              pieces={piecesFiltradas}
              accent={accent}
              onOpen={setEditing}
              readOnly={readOnly}
              selectedIds={selectedIds}
              onToggleSelected={readOnly ? undefined : toggleSelected}
            />
          ) : (
            <ContentCalendar
              pieces={piecesFiltradas}
              accent={accent}
              onOpen={setEditing}
              onCreateAt={(date) => setCreating({ date })}
              readOnly={readOnly}
              selectedIds={selectedIds}
              onToggleSelected={readOnly ? undefined : toggleSelected}
            />
          )}
        </>
      ) : (
        <ContentKpisTab pieces={pieces} accent={accent} />
      )}

      <AnimatePresence>
        {(editing || creating) && (
          <ContentDrawer
            key={editing?.id ?? 'create'}
            client={client}
            piece={editing}
            createAt={creating?.date}
            onClose={() => { setEditing(null); setCreating(null); }}
            readOnly={readOnly}
          />
        )}
      </AnimatePresence>

      <ImportarContenidoCSVModal open={importOpen} clientId={client.id} onClose={() => setImportOpen(false)} />

      <AnimatePresence>
        {selectedCount > 0 && (
          <BulkActionsBar count={selectedCount} accent={accent} onMove={bulkMove} onDelete={bulkDelete} onCancel={clearSelection} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── KPIs ───────────────────────── */

function ContentKpisTab({ pieces, accent }: { pieces: ContentPiece[]; accent: string }) {
  const now = new Date();
  const publicadasEsteMes = pieces.filter((p) => {
    if (p.status !== 'published' || !p.publishDate) return false;
    const d = parseISO(p.publishDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const conLeadMagnet = pieces.filter((p) => p.hasLeadMagnet).length;
  const atascadas = pieces.filter(estaAtascada).length;

  const porEstado = STATUS_FLOW.map((status) => ({ status, n: pieces.filter((p) => p.status === status).length }));
  const maxEstado = Math.max(1, ...porEstado.map((p) => p.n));

  const porPlataforma = (Object.keys(PLATFORM_META) as ContentPlatform[])
    .map((platform) => ({ platform, n: pieces.filter((p) => p.platform === platform).length }))
    .filter((p) => p.n > 0);
  const maxPlataforma = Math.max(1, ...porPlataforma.map((p) => p.n));

  const porResponsable = useMemo(() => {
    const map = new Map<string, ContentPiece[]>();
    for (const p of pieces) {
      if (!p.assignedTo?.trim()) continue;
      const arr = map.get(p.assignedTo) ?? [];
      arr.push(p);
      map.set(p.assignedTo, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pieces]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Total piezas" value={String(pieces.length)} />
        <KpiTile label="Publicadas este mes" value={String(publicadasEsteMes)} tone="good" />
        <KpiTile label="Con Lead Magnet" value={String(conLeadMagnet)} />
        <KpiTile label={`Atascadas (${DIAS_ATASCADA}+ días)`} value={String(atascadas)} tone={atascadas > 0 ? 'warn' : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[12px] border border-border-default bg-bg-surface p-4">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Piezas por estado</h4>
          <div className="space-y-1.5">
            {porEstado.map(({ status, n }) => (
              <div key={status} className="grid grid-cols-[110px_1fr_28px] gap-2 items-center text-[11px]">
                <span className="text-text-secondary truncate">{CONTENT_STATUS_META[status].label}</span>
                <div className="h-3.5 rounded bg-bg-elevated overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(n / maxEstado) * 100}%`, background: accent }} />
                </div>
                <span className="text-right font-mono text-text-primary">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[12px] border border-border-default bg-bg-surface p-4">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Piezas por plataforma</h4>
          {porPlataforma.length === 0 ? (
            <p className="text-[11px] text-text-muted">Sin piezas todavía.</p>
          ) : (
            <div className="space-y-1.5">
              {porPlataforma.map(({ platform, n }) => (
                <div key={platform} className="grid grid-cols-[100px_1fr_28px] gap-2 items-center text-[11px]">
                  <span className="text-text-secondary">{PLATFORM_META[platform].emoji} {PLATFORM_META[platform].label}</span>
                  <div className="h-3.5 rounded bg-bg-elevated overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(n / maxPlataforma) * 100}%`, background: accent }} />
                  </div>
                  <span className="text-right font-mono text-text-primary">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2.5">Por responsable</h4>
        {porResponsable.length === 0 ? (
          <p className="text-[11px] text-text-muted">Ninguna pieza tiene responsable asignado todavía.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {porResponsable.map(([nombre, piezas]) => (
              <PersonContentCard key={nombre} nombre={nombre} pieces={piezas} accent={accent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PersonContentCard({ nombre, pieces, accent }: { nombre: string; pieces: ContentPiece[]; accent: string }) {
  const publicadas = pieces.filter((p) => p.status === 'published').length;
  const atascadas = pieces.filter(estaAtascada).length;
  return (
    <div className="rounded-[12px] border border-border-default bg-bg-surface p-3.5">
      <div className="text-[12.5px] font-semibold text-text-primary truncate mb-2.5">{nombre}</div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-text-muted text-[9.5px] uppercase tracking-wide">Piezas</div>
          <div className="font-mono font-semibold text-text-primary">{pieces.length}</div>
        </div>
        <div>
          <div className="text-text-muted text-[9.5px] uppercase tracking-wide">Publicadas</div>
          <div className="font-mono font-semibold" style={{ color: accent }}>{publicadas}</div>
        </div>
        <div>
          <div className="text-text-muted text-[9.5px] uppercase tracking-wide">Atascadas</div>
          <div className="font-mono font-semibold" style={{ color: atascadas > 0 ? '#D08A00' : 'var(--text-primary)' }}>{atascadas}</div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-[10px] border border-border-default bg-bg-surface p-3">
      <div className="text-[9.5px] uppercase tracking-wide text-text-muted font-semibold">{label}</div>
      <div className={cn('text-lg font-bold mt-1 font-mono', tone === 'good' && 'text-green-500', tone === 'warn' && 'text-amber-500')}>
        {value}
      </div>
    </div>
  );
}

function ToggleButton({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs inline-flex items-center gap-1.5 transition',
        active ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ───────────────────────── KANBAN ───────────────────────── */

const KANBAN_COLS: Array<{ status: ContentStatus; label: string }> = [
  { status: 'not_started',    label: 'Sin empezar' },
  { status: 'recording',      label: 'Grabación' },
  { status: 'editing',        label: 'Edición' },
  { status: 'review',         label: 'Revisión' },
  { status: 'sent_to_client', label: 'Cliente' },
  { status: 'rejected',       label: 'Rechazado' },
  { status: 'approved',       label: 'Aprobado' },
  { status: 'scheduled',      label: 'Programado' },
  { status: 'published',      label: 'Publicado' },
];

function ContentKanban({
  pieces, accent, onOpen, readOnly = false, selectedIds, onToggleSelected,
}: {
  pieces: ContentPiece[];
  accent: string;
  onOpen: (p: ContentPiece) => void;
  readOnly?: boolean;
  selectedIds: Set<string>;
  onToggleSelected?: (id: string) => void;
}) {
  const update = useContentStore((s) => s.update);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ContentStatus | null>(null);

  function handleDrop(status: ContentStatus) {
    if (readOnly || !draggedId) return;
    const id = draggedId;
    setDraggedId(null);
    setDragOverStatus(null);
    const piece = pieces.find((p) => p.id === id);
    if (!piece || piece.status === status) return;
    update(id, { status });
    toast.success(`Movida a ${CONTENT_STATUS_META[status].label}`);
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-2">
      {KANBAN_COLS.map((col) => {
        const colItems = pieces.filter((p) => p.status === col.status);
        const meta = CONTENT_STATUS_META[col.status];
        const isDropTarget = dragOverStatus === col.status;
        return (
          <div
            key={col.status}
            className="surface p-2.5 min-h-[300px] flex flex-col transition-colors"
            style={isDropTarget ? { boxShadow: `inset 0 0 0 1px ${accent}` } : undefined}
            onDragOver={(e) => {
              if (readOnly || !draggedId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverStatus !== col.status) setDragOverStatus(col.status);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              if (dragOverStatus === col.status) setDragOverStatus(null);
            }}
            onDrop={(e) => { e.preventDefault(); handleDrop(col.status); }}
          >
            <header className="flex items-center justify-between mb-2">
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: meta.bg, color: meta.text, borderColor: meta.ring }}
              >
                {col.label}
              </span>
              <span className="text-[10px] text-text-muted font-mono">{colItems.length}</span>
            </header>
            <div className="space-y-1.5 flex-1">
              {colItems.map((p, i) => (
                <KanbanCard
                  key={p.id}
                  piece={p}
                  accent={accent}
                  index={i}
                  readOnly={readOnly}
                  dragging={draggedId === p.id}
                  isSelected={selectedIds.has(p.id)}
                  anySelected={selectedIds.size > 0}
                  onToggleSelected={onToggleSelected ? () => onToggleSelected(p.id) : undefined}
                  onClick={() => {
                    if (onToggleSelected && selectedIds.size > 0) { onToggleSelected(p.id); return; }
                    onOpen(p);
                  }}
                  onDragStart={() => setDraggedId(p.id)}
                  onDragEnd={() => { setDraggedId(null); setDragOverStatus(null); }}
                />
              ))}
              {colItems.length === 0 && (
                <div className="text-[10px] text-text-muted text-center py-4 italic">
                  {isDropTarget ? 'Soltar aquí' : 'Vacío'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  piece, accent, index, readOnly, dragging, isSelected, anySelected, onToggleSelected, onClick, onDragStart, onDragEnd,
}: {
  piece: ContentPiece;
  accent: string;
  index: number;
  readOnly: boolean;
  dragging: boolean;
  isSelected: boolean;
  anySelected: boolean;
  onToggleSelected?: () => void;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const platform = PLATFORM_META[piece.platform];
  const mostrarDias = ESTADOS_ABIERTOS.includes(piece.status);
  const dias = mostrarDias ? diasEnPipeline(piece) : 0;
  const colorDias = dias >= DIAS_ATASCADA ? '#D03B3B' : dias >= 3 ? '#D08A00' : 'var(--text-muted)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative group"
    >
      {onToggleSelected && <SelectCheckbox isSelected={isSelected} anySelected={anySelected} onToggle={onToggleSelected} />}
      <button
        onClick={onClick}
        draggable={!readOnly}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', piece.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
        onDragEnd={onDragEnd}
        className={cn(
          'w-full text-left rounded-md border p-2 transition focus-ring',
          isSelected ? 'border-transparent' : 'border-border-subtle bg-bg-base/40',
          dragging ? 'opacity-50' : !isSelected && 'hover:bg-bg-elevated',
          !readOnly && 'cursor-grab active:cursor-grabbing',
        )}
        style={isSelected ? { boxShadow: `0 0 0 2px ${accent}`, background: withAlpha(accent, 0.1) } : undefined}
      >
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-text-muted">{platform.emoji} {FORMAT_LABEL[piece.format]}</span>
          <div className="flex items-center gap-1">
            {piece.hasLeadMagnet && (
              <Magnet className="h-3 w-3" style={{ color: accent }} aria-label="Lleva lead magnet" />
            )}
            {mostrarDias && dias >= 3 && (
              <span className="font-mono" style={{ color: colorDias }} title={`${dias} días sin publicar/programar`}>
                {dias}d
              </span>
            )}
          </div>
        </div>
        <div className="text-[12px] text-text-primary leading-snug line-clamp-2">{piece.title}</div>
        {piece.publishDate && (
          <div className="text-[10px] text-text-muted mt-1.5">
            📅 {format(parseISO(piece.publishDate), 'd MMM', { locale: es })}
          </div>
        )}
      </button>
    </motion.div>
  );
}

/* ───────────────────────── CALENDARIO ───────────────────────── */

function ContentCalendar({
  pieces, accent, onOpen, onCreateAt, readOnly = false, selectedIds, onToggleSelected,
}: {
  pieces: ContentPiece[];
  accent: string;
  onOpen: (p: ContentPiece) => void;
  onCreateAt: (date: Date) => void;
  readOnly?: boolean;
  selectedIds: Set<string>;
  onToggleSelected?: (id: string) => void;
}) {
  const [cursor, setCursor] = useState<Date>(new Date());
  const [dateField, setDateField] = useState<DateField>('publishDate');
  const update = useContentStore((s) => s.update);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Arrastrar una pieza a otro día mueve la fecha que se está viendo ahora
  // (el selector "Ver por") — arrastrar en la vista de Publicación mueve
  // publishDate, en la de Grabación mueve recordingDate, etc.
  function handleDropOnDay(dayKey: string) {
    if (readOnly || !draggedId) return;
    const id = draggedId;
    setDraggedId(null);
    setDragOverDay(null);
    const piece = pieces.find((p) => p.id === id);
    if (!piece) return;
    const currentKey = piece[dateField] ? format(parseISO(piece[dateField]!), 'yyyy-MM-dd') : null;
    if (currentKey === dayKey) return;
    update(id, { [dateField]: new Date(`${dayKey}T12:00:00`).toISOString() });
    toast.success(`${DATE_FIELD_LABEL[dateField].label} movida al ${format(parseISO(dayKey), 'd MMM', { locale: es })}`);
  }

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const piecesByDay = useMemo(() => {
    const map = new Map<string, ContentPiece[]>();
    for (const p of pieces) {
      const iso = p[dateField];
      if (!iso) continue;
      const key = format(parseISO(iso), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [pieces, dateField]);

  // Identificar semanas con poco contenido (< 2 piezas en la semana visible del mes)
  const weeksWithLowCount = useMemo(() => {
    const set = new Set<number>();
    for (let w = 0; w < days.length / 7; w++) {
      const weekDays = days.slice(w * 7, w * 7 + 7).filter((d) => isSameMonth(d, cursor));
      let count = 0;
      for (const d of weekDays) {
        count += piecesByDay.get(format(d, 'yyyy-MM-dd'))?.length ?? 0;
      }
      if (weekDays.length > 0 && count < 2) set.add(w);
    }
    return set;
  }, [days, cursor, piecesByDay]);

  return (
    <div className="surface p-4">
      <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="h-8 w-8 rounded-md border border-border-subtle bg-bg-base/40 hover:bg-bg-elevated text-text-secondary">
            <ChevronLeft className="h-4 w-4 mx-auto" />
          </button>
          <button onClick={() => setCursor(new Date())} className="text-xs text-text-muted hover:text-text-primary px-2">
            Hoy
          </button>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="h-8 w-8 rounded-md border border-border-subtle bg-bg-base/40 hover:bg-bg-elevated text-text-secondary">
            <ChevronRight className="h-4 w-4 mx-auto" />
          </button>
          <h3 className="heading text-lg font-bold ml-2 capitalize">
            {format(cursor, 'MMMM yyyy', { locale: es })}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Ver por:</span>
          <select
            value={dateField}
            onChange={(e) => setDateField(e.target.value as DateField)}
            className="rounded-md border border-border-subtle bg-bg-base/40 px-2 py-1 text-xs text-text-primary outline-none"
          >
            {(Object.keys(DATE_FIELD_LABEL) as DateField[]).map((f) => (
              <option key={f} value={f}>
                {DATE_FIELD_LABEL[f].icon} {DATE_FIELD_LABEL[f].label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="px-1.5 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, idx) => {
          const inMonth = isSameMonth(d, cursor);
          const today = isToday(d);
          const dayKey = format(d, 'yyyy-MM-dd');
          const dayPieces = piecesByDay.get(dayKey) ?? [];
          const weekIdx = Math.floor(idx / 7);
          const lowWeek = weeksWithLowCount.has(weekIdx);
          const visiblePieces = dayPieces.slice(0, 3);
          const overflow = dayPieces.length - visiblePieces.length;

          const isDropTarget = dragOverDay === dayKey;

          return (
            <div
              key={dayKey}
              className={cn(
                'group relative rounded-md border p-1.5 min-h-[110px] transition-colors',
                inMonth ? 'bg-bg-base/30' : 'bg-bg-base/10 opacity-50',
                lowWeek && inMonth && !today ? 'bg-status-warning/[0.08]' : '',
              )}
              style={
                isDropTarget
                  ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` }
                  : today
                    ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.35)}` }
                    : { borderColor: 'rgba(255,255,255,0.06)' }
              }
              onDragOver={(e) => {
                if (readOnly || !draggedId || !inMonth) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverDay !== dayKey) setDragOverDay(dayKey);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverDay === dayKey) setDragOverDay(null);
              }}
              onDrop={(e) => { e.preventDefault(); handleDropOnDay(dayKey); }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-[11px] font-mono',
                    today ? 'font-bold' : inMonth ? 'text-text-secondary' : 'text-text-muted',
                  )}
                  style={today ? { color: accent } : undefined}
                >
                  {format(d, 'd')}
                </span>
                {inMonth && !readOnly && (
                  <button
                    onClick={() => onCreateAt(d)}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition"
                    aria-label="Crear pieza"
                  >
                    <Plus className="h-3 w-3 mx-auto" />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {visiblePieces.map((p) => (
                  <CalendarPieceCard
                    key={p.id}
                    piece={p}
                    accent={accent}
                    readOnly={readOnly}
                    dragging={draggedId === p.id}
                    isSelected={selectedIds.has(p.id)}
                    anySelected={selectedIds.size > 0}
                    onToggleSelected={onToggleSelected ? () => onToggleSelected(p.id) : undefined}
                    onClick={() => {
                      if (onToggleSelected && selectedIds.size > 0) { onToggleSelected(p.id); return; }
                      onOpen(p);
                    }}
                    onDragStart={() => setDraggedId(p.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverDay(null); }}
                  />
                ))}
                {overflow > 0 && (
                  <button
                    onClick={() => onOpen(dayPieces[3])}
                    className="w-full text-[10px] text-text-muted hover:text-text-primary py-0.5"
                  >
                    +{overflow} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {weeksWithLowCount.size > 0 && (
        <p className="text-[10.5px] text-text-muted mt-2">
          🟡 Semanas con menos de 2 piezas programadas — revisa el calendario completo.
        </p>
      )}
    </div>
  );
}

function CalendarPieceCard({
  piece, accent, readOnly, dragging, isSelected, anySelected, onToggleSelected, onClick, onDragStart, onDragEnd,
}: {
  piece: ContentPiece;
  accent: string;
  readOnly: boolean;
  dragging: boolean;
  isSelected: boolean;
  anySelected: boolean;
  onToggleSelected?: () => void;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const meta = CONTENT_STATUS_META[piece.status];
  const platform = PLATFORM_META[piece.platform];
  return (
    <div className="relative group">
      {onToggleSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelected(); }}
          aria-label={isSelected ? 'Deseleccionar pieza' : 'Seleccionar pieza'}
          title={isSelected ? 'Deseleccionar' : 'Seleccionar para acción masiva'}
          className={cn(
            'absolute top-0.5 right-0.5 h-3 w-3 rounded-sm border flex items-center justify-center transition z-10',
            (isSelected || anySelected) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            isSelected ? 'border-transparent text-white' : 'border-border-default bg-bg-base/90 text-transparent hover:border-accent-violet',
          )}
          style={isSelected ? { background: 'var(--accent)' } : undefined}
        >
          <Check className="h-2 w-2" strokeWidth={3.5} />
        </button>
      )}
      <button
        onClick={onClick}
        draggable={!readOnly}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', piece.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
        onDragEnd={onDragEnd}
        className={cn(
          'w-full text-left rounded-[6px] border bg-bg-surface px-1.5 py-1 transition focus-ring',
          dragging ? 'opacity-50' : !isSelected && 'hover:brightness-125',
          !readOnly && 'cursor-grab active:cursor-grabbing',
        )}
        style={isSelected ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` } : { borderColor: meta.ring }}
        title={piece.title}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9px]" style={{ color: meta.text }}>● {platform.emoji}</span>
          {piece.hasLeadMagnet && <Magnet className="h-2.5 w-2.5 shrink-0" style={{ color: accent }} />}
        </div>
        <div className="text-[10px] text-text-primary leading-tight truncate mt-0.5">{piece.title}</div>
        <div className="text-[9px] mt-0.5 truncate" style={{ color: meta.text }}>{meta.label}</div>
      </button>
    </div>
  );
}

/* ───────────────────────── DRAWER (detalle/edición/creación) ───────────────────────── */

function ContentDrawer({
  client, piece, createAt, onClose, readOnly = false,
}: {
  client: Client;
  piece: ContentPiece | null;
  createAt?: Date;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const add = useContentStore((s) => s.add);
  const update = useContentStore((s) => s.update);
  const remove = useContentStore((s) => s.remove);
  const accent = client.primaryColor;
  const isNew = !piece;

  const [draft, setDraft] = useState<ContentPiece>(() =>
    piece ?? buildEmpty(client.id, createAt ?? new Date()),
  );
  const [loading, setLoading] = useState(false);

  const save = () => {
    if (!draft.title.trim()) {
      toast.error('El título es requerido.');
      return;
    }
    if (isNew) {
      add(draft);
      toast.success('Pieza creada');
    } else {
      update(draft.id, draft);
      toast.success('Pieza actualizada');
    }
    onClose();
  };

  const del = () => {
    if (!piece) return;
    remove(piece.id);
    toast.success('Pieza eliminada');
    onClose();
  };

  const generateCopy = async () => {
    if (!draft.title?.trim()) {
      toast.error('Pon un título o idea antes de generar el copy');
      return;
    }
    setLoading(true);
    try {
      const brain = client.aiBrainData ?? {};
      const arch = brain.brandArchitecture;
      const result = await generateContentCopy({
        clientName: client.name,
        industry: client.industry,
        platform: draft.platform,
        format: draft.format,
        title: draft.title,
        hasLeadMagnet: draft.hasLeadMagnet,
        ctaType: draft.ctaType,
        irresistibleOffer: brain.irresistibleOffer,
        brandMission: arch?.mission,
        brandVoiceTone: arch?.voiceTone,
        brandDos: arch?.dos,
        brandDonts: arch?.donts,
        brandValues: arch?.values,
        brandPillars: arch?.pillars,
        personas: brain.buyerPersonas,
      });
      setDraft({
        ...draft,
        script: result.script,
        caption: result.caption,
        // Mantenemos copyText sincronizado por compatibilidad con código que
        // todavía lo lea (no rompe piezas viejas).
        copyText: result.caption || draft.copyText,
      });
      toast.success('Script + Caption generados con IA');
    } finally {
      setLoading(false);
    }
  };

  // Equipo: para Responsable, sugerimos personas asignadas al rol seleccionado
  // (filtradas por cliente). Si no hay asignaciones, el campo queda libre.
  const teamMembers = useTeamMembersStore((s) => s.members);
  const assigneesForRole = useMemo(() => {
    if (!draft.roleSlug) return [] as string[];
    return Array.from(new Set(
      teamMembers
        .filter((m) => m.clientId === client.id && m.rol === draft.roleSlug && m.nombre.trim())
        .map((m) => m.nombre.trim()),
    ));
  }, [teamMembers, draft.roleSlug, client.id]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-bg-base/70 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.25 }}
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xl bg-bg-surface border-l border-border-default flex flex-col"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted">
              {isNew ? 'Nueva pieza' : 'Editar pieza'}
            </div>
            <h2 className="heading text-lg font-bold">
              {isNew ? 'Crear contenido' : draft.title || 'Sin título'}
            </h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated" aria-label="Cerrar">
            <X className="h-4 w-4 mx-auto" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <SectionLabel first>Qué es</SectionLabel>
          <Input
            label="Título"
            required
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            disabled={readOnly}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Plataforma"
              required
              value={draft.platform}
              onChange={(e) => setDraft({ ...draft, platform: e.target.value as ContentPlatform })}
              options={Object.entries(PLATFORM_META).map(([v, m]) => ({ value: v, label: `${m.emoji} ${m.label}` }))}
              disabled={readOnly}
            />
            <Select
              label="Formato"
              required
              value={draft.format}
              onChange={(e) => setDraft({ ...draft, format: e.target.value as ContentFormat })}
              options={Object.entries(FORMAT_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              disabled={readOnly}
            />
          </div>

          {/* Tipo de Call to Action */}
          <Select
            label="Tipo de Call to Action"
            value={draft.ctaType ?? ''}
            onChange={(e) => setDraft({ ...draft, ctaType: (e.target.value || undefined) as CtaType | undefined })}
            options={[
              { value: '', label: '— Elegir CTA —' },
              ...Object.entries(CTA_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })),
            ]}
            disabled={readOnly}
          />

          <SectionLabel>Contenido</SectionLabel>
          {/* Botón generar IA — produce script + caption en una sola llamada */}
          {!readOnly && (
            <div className="rounded-[10px] border border-dashed border-border-default bg-bg-base/30 p-3 flex items-center justify-between gap-3">
              <div className="text-[11px] text-text-secondary leading-relaxed">
                La IA usa el título, plataforma, formato, CTA, arquitectura de marca y avatar
                del cliente para generar <strong>script</strong> + <strong>caption</strong>.
              </div>
              <button
                onClick={generateCopy}
                disabled={loading}
                className="shrink-0 text-xs inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:brightness-125 disabled:opacity-50 font-medium"
                style={{ color: accent, borderColor: withAlpha(accent, 0.4), background: withAlpha(accent, 0.10) }}
              >
                <Sparkles className="h-3.5 w-3.5" /> {loading ? 'Generando…' : 'Generar con IA'}
              </button>
            </div>
          )}

          {/* Guion / Script — para el equipo, no se publica */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              🎬 Guion / Script
              <span className="text-text-muted font-normal ml-1">(qué decir o grabar — para el equipo)</span>
            </label>
            <Textarea
              rows={5}
              value={draft.script ?? ''}
              onChange={(e) => setDraft({ ...draft, script: e.target.value })}
              placeholder="Beats del video, ángulo, transiciones, líneas clave…"
              disabled={readOnly}
            />
          </div>

          {/* Caption listo para publicar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-text-secondary">
                📋 Caption
                <span className="text-text-muted font-normal ml-1">(listo para copiar y pegar)</span>
              </label>
              {(draft.caption ?? '').trim().length > 0 && (
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText((draft.caption ?? '').trim());
                    toast.success('Caption copiado al portapapeles');
                  }}
                  className="text-[11px] inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 hover:bg-bg-elevated text-text-secondary"
                >
                  Copiar
                </button>
              )}
            </div>
            <Textarea
              rows={7}
              value={draft.caption ?? ''}
              onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              placeholder="Hook + cuerpo + CTA + hashtags…"
              disabled={readOnly}
            />
          </div>

          <SectionLabel>Responsable y fechas</SectionLabel>
          {/* Rol + Responsable */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Rol"
              value={draft.roleSlug ?? ''}
              onChange={(e) => {
                const next = (e.target.value || undefined) as TeamRoleSlug | undefined;
                setDraft({
                  ...draft,
                  roleSlug: next,
                  assignedTo: next === draft.roleSlug ? draft.assignedTo : undefined,
                });
              }}
              options={[
                { value: '', label: '— Elegir rol —' },
                ...ROLE_DEFS.map((r) => ({ value: r.slug, label: r.title })),
              ]}
              disabled={readOnly}
            />
            {assigneesForRole.length > 0 ? (
              <Select
                label="Responsable"
                value={draft.assignedTo ?? ''}
                onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value || undefined })}
                options={[
                  { value: '', label: '— Sin asignar —' },
                  ...assigneesForRole.map((name) => ({ value: name, label: name })),
                ]}
                disabled={readOnly}
              />
            ) : (
              <Input
                label="Responsable"
                value={draft.assignedTo ?? ''}
                onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value || undefined })}
                placeholder={draft.roleSlug ? 'Nombre de la persona' : 'Elige un rol primero'}
                disabled={readOnly || !draft.roleSlug}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateInput
              label="📹 Grabación"
              value={draft.recordingDate}
              onChange={(v) => setDraft({ ...draft, recordingDate: v })}
              disabled={readOnly}
            />
            <DateInput
              label="✂️ Edición"
              value={draft.editingDate}
              onChange={(v) => setDraft({ ...draft, editingDate: v })}
              disabled={readOnly}
            />
            <DateInput
              label="✅ Aprobación"
              value={draft.approvalDate}
              onChange={(v) => setDraft({ ...draft, approvalDate: v })}
              disabled={readOnly}
            />
            <DateInput
              label="📅 Publicación"
              value={draft.publishDate}
              onChange={(v) => setDraft({ ...draft, publishDate: v })}
              disabled={readOnly}
            />
          </div>

          <Select
            label="Estado"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as ContentStatus })}
            options={STATUS_FLOW.map((s) => ({ value: s, label: CONTENT_STATUS_META[s].label }))}
            disabled={readOnly}
          />

          <SectionLabel>Extras</SectionLabel>
          <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.hasLeadMagnet}
                onChange={(e) => setDraft({ ...draft, hasLeadMagnet: e.target.checked })}
                className="h-4 w-4 accent-accent-violet"
                disabled={readOnly}
              />
              <Magnet className="h-4 w-4" style={{ color: accent }} />
              <span className="text-sm text-text-primary">Lleva Lead Magnet</span>
            </label>
            {draft.hasLeadMagnet && (
              <Input
                className="mt-3"
                placeholder="Descripción del lead magnet (PDF, audio, mini-curso…)"
                value={draft.leadMagnetDescription ?? ''}
                onChange={(e) => setDraft({ ...draft, leadMagnetDescription: e.target.value })}
                disabled={readOnly}
              />
            )}
          </div>

          <Textarea
            label="Notas de producción"
            rows={3}
            value={draft.productionNotes ?? ''}
            onChange={(e) => setDraft({ ...draft, productionNotes: e.target.value })}
            disabled={readOnly}
          />

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              Archivo (imagen / video)
            </label>
            <Input
              placeholder="Pega el link de Drive del archivo"
              value={draft.mediaUrl ?? ''}
              onChange={(e) => setDraft({ ...draft, mediaUrl: e.target.value })}
              disabled={readOnly}
            />
          </div>

          {draft.status === 'rejected' && (
            <Textarea
              label="Notas de rechazo (visibles al equipo)"
              rows={3}
              value={draft.approvalNotes ?? ''}
              onChange={(e) => setDraft({ ...draft, approvalNotes: e.target.value })}
              className="border-status-danger/40"
              disabled={readOnly}
            />
          )}
        </div>

        <footer className="border-t border-border-subtle px-5 py-3 flex items-center justify-between gap-2">
          <div>
            {!readOnly && !isNew && (
              <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={del}>
                Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>{readOnly ? 'Cerrar' : 'Cancelar'}</Button>
            {!readOnly && (
              <Button size="sm" leftIcon={<Save className="h-3.5 w-3.5" />} onClick={save}>
                {isNew ? 'Crear pieza' : 'Guardar'}
              </Button>
            )}
          </div>
        </footer>
      </motion.aside>
    </>
  );
}

function SectionLabel({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <h4 className={cn(
      'text-xs font-semibold text-text-secondary uppercase tracking-wide',
      first ? '' : 'pt-2 border-t border-border-subtle',
    )}>
      {children}
    </h4>
  );
}

function DateInput({
  label, value, onChange, disabled,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  disabled?: boolean;
}) {
  const dateValue = value ? value.slice(0, 10) : '';
  return (
    <Input
      label={label}
      type="date"
      value={dateValue}
      onChange={(e) =>
        onChange(e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined)
      }
      disabled={disabled}
    />
  );
}

function buildEmpty(clientId: string, when: Date): ContentPiece {
  const iso = when.toISOString();
  return {
    id: genId(),
    clientId,
    title: '',
    platform: 'instagram',
    format: 'reel',
    copyText: '',
    status: 'not_started',
    approval: 'pending',
    publishDate: iso,
    hasLeadMagnet: false,
    createdAt: new Date().toISOString(),
  };
}

/* ───────────────────────── Selección múltiple ───────────────────────── */

/** Checkbox de selección — mismo patrón visual que TasksModule. */
function SelectCheckbox({ isSelected, anySelected, onToggle }: { isSelected: boolean; anySelected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={isSelected ? 'Deseleccionar pieza' : 'Seleccionar pieza'}
      title={isSelected ? 'Deseleccionar' : 'Seleccionar para acción masiva'}
      className={cn(
        'absolute top-1.5 left-1.5 h-4 w-4 rounded border flex items-center justify-center transition z-10',
        (isSelected || anySelected) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        isSelected ? 'border-transparent text-white' : 'border-border-default bg-bg-base/80 text-transparent hover:border-accent-violet',
      )}
      style={isSelected ? { background: 'var(--accent)' } : undefined}
    >
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </button>
  );
}

function BulkActionsBar({
  count, accent, onMove, onDelete, onCancel,
}: {
  count: number;
  accent: string;
  onMove: (status: ContentStatus) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 surface shadow-2xl border border-border-default rounded-[14px] px-3 py-2 flex items-center gap-2"
      style={{ boxShadow: `0 24px 60px -20px ${withAlpha(accent, 0.55)}` }}
    >
      <div className="flex items-center gap-2 pr-2 border-r border-border-subtle">
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: withAlpha(accent, 0.18), color: accent }}>
          {count} seleccionada{count === 1 ? '' : 's'}
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setMoveOpen((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-md hover:bg-bg-elevated transition inline-flex items-center gap-1.5 text-text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" /> Mover a
          <ChevronDown className="h-3 w-3" />
        </button>
        {moveOpen && (
          <div className="absolute bottom-full mb-2 left-0 surface rounded-[10px] border border-border-default shadow-xl py-1 min-w-[180px]">
            {KANBAN_COLS.map((c) => (
              <button
                key={c.status}
                onClick={() => { onMove(c.status); setMoveOpen(false); }}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-bg-elevated transition"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        className="text-xs px-3 py-1.5 rounded-md hover:bg-status-danger/10 text-status-danger transition inline-flex items-center gap-1.5"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar
      </button>

      <button onClick={onCancel} className="text-xs px-2.5 py-1.5 rounded-md hover:bg-bg-elevated text-text-muted transition">
        Cancelar
      </button>
    </motion.div>
  );
}
