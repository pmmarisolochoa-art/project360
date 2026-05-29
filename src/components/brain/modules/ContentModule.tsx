import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutGrid, CalendarDays, Plus, X, Sparkles, Trash2, Save,
  ChevronLeft, ChevronRight, Magnet, Upload,
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  format, parseISO, isSameDay, isSameMonth, isToday, addMonths, subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type {
  ContentPiece, ContentStatus, ContentPlatform, ContentFormat,
} from '@/types/content';
import { CONTENT_STATUS_META, PLATFORM_META, FORMAT_LABEL } from '@/types/content';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useContentStore, DATE_FIELD_LABEL, STATUS_FLOW, type DateField } from '@/store/useContentStore';
import { toast } from '@/store/useToastStore';
import { withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';

export function ContentModule({ client }: { client: Client }) {
  const allPieces = useContentStore((s) => s.pieces);
  const pieces = useMemo(
    () => allPieces.filter((p) => p.clientId === client.id),
    [allPieces, client.id],
  );
  const [view, setView] = useState<'kanban' | 'calendar'>('calendar');
  const [editing, setEditing] = useState<ContentPiece | null>(null);
  const [creating, setCreating] = useState<{ date: Date } | null>(null);

  return (
    <div className="space-y-4">
      <div className="surface p-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-[10px] border border-border-subtle bg-bg-base/40 p-0.5">
          <ToggleButton active={view === 'kanban'} onClick={() => setView('kanban')} icon={<LayoutGrid className="h-3.5 w-3.5" />}>
            Kanban Pipeline
          </ToggleButton>
          <ToggleButton active={view === 'calendar'} onClick={() => setView('calendar')} icon={<CalendarDays className="h-3.5 w-3.5" />}>
            Calendario de Contenidos
          </ToggleButton>
        </div>

        <Button
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setCreating({ date: new Date() })}
        >
          Nueva pieza
        </Button>
      </div>

      {view === 'kanban' ? (
        <ContentKanban pieces={pieces} accent={client.primaryColor} onOpen={setEditing} />
      ) : (
        <ContentCalendar
          pieces={pieces}
          accent={client.primaryColor}
          onOpen={setEditing}
          onCreateAt={(date) => setCreating({ date })}
        />
      )}

      <AnimatePresence>
        {(editing || creating) && (
          <ContentDrawer
            key={editing?.id ?? 'create'}
            client={client}
            piece={editing}
            createAt={creating?.date}
            onClose={() => { setEditing(null); setCreating(null); }}
          />
        )}
      </AnimatePresence>
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
  { status: 'approved',       label: 'Aprobado' },
  { status: 'scheduled',      label: 'Programado' },
  { status: 'published',      label: 'Publicado' },
];

function ContentKanban({
  pieces, accent, onOpen,
}: {
  pieces: ContentPiece[];
  accent: string;
  onOpen: (p: ContentPiece) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
      {KANBAN_COLS.map((col) => {
        const colItems = pieces.filter((p) => p.status === col.status);
        const meta = CONTENT_STATUS_META[col.status];
        return (
          <div key={col.status} className="surface p-2.5 min-h-[300px] flex flex-col">
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
                <KanbanCard key={p.id} piece={p} accent={accent} index={i} onClick={() => onOpen(p)} />
              ))}
              {colItems.length === 0 && (
                <div className="text-[10px] text-text-muted text-center py-4 italic">Vacío</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  piece, accent, index, onClick,
}: {
  piece: ContentPiece;
  accent: string;
  index: number;
  onClick: () => void;
}) {
  const platform = PLATFORM_META[piece.platform];
  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="w-full text-left rounded-md border border-border-subtle bg-bg-base/40 p-2 hover:bg-bg-elevated transition focus-ring"
    >
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-text-muted">{platform.emoji} {FORMAT_LABEL[piece.format]}</span>
        {piece.hasLeadMagnet && (
          <Magnet className="h-3 w-3" style={{ color: accent }} aria-label="Lleva lead magnet" />
        )}
      </div>
      <div className="text-[12px] text-text-primary leading-snug line-clamp-2">{piece.title}</div>
      {piece.publishDate && (
        <div className="text-[10px] text-text-muted mt-1.5">
          📅 {format(parseISO(piece.publishDate), 'd MMM', { locale: es })}
        </div>
      )}
    </motion.button>
  );
}

/* ───────────────────────── CALENDARIO ───────────────────────── */

function ContentCalendar({
  pieces, accent, onOpen, onCreateAt,
}: {
  pieces: ContentPiece[];
  accent: string;
  onOpen: (p: ContentPiece) => void;
  onCreateAt: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState<Date>(new Date());
  const [dateField, setDateField] = useState<DateField>('publishDate');

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

          return (
            <div
              key={dayKey}
              className={cn(
                'group relative rounded-md border p-1.5 min-h-[110px] transition-colors',
                inMonth ? 'bg-bg-base/30' : 'bg-bg-base/10 opacity-50',
                lowWeek && inMonth && !today ? 'bg-status-warning/[0.03]' : '',
              )}
              style={today ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.35)}` } : { borderColor: 'rgba(255,255,255,0.06)' }}
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
                {inMonth && (
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
                  <CalendarPieceCard key={p.id} piece={p} accent={accent} onClick={() => onOpen(p)} />
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
    </div>
  );
}

function CalendarPieceCard({
  piece, accent, onClick,
}: {
  piece: ContentPiece;
  accent: string;
  onClick: () => void;
}) {
  const meta = CONTENT_STATUS_META[piece.status];
  const platform = PLATFORM_META[piece.platform];
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-[6px] border bg-bg-surface px-1.5 py-1 hover:brightness-125 transition focus-ring"
      style={{ borderColor: meta.ring }}
      title={piece.title}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px]" style={{ color: meta.text }}>● {platform.emoji}</span>
        {piece.hasLeadMagnet && <Magnet className="h-2.5 w-2.5 shrink-0" style={{ color: accent }} />}
      </div>
      <div className="text-[10px] text-text-primary leading-tight truncate mt-0.5">{piece.title}</div>
      <div className="text-[9px] mt-0.5 truncate" style={{ color: meta.text }}>{meta.label}</div>
    </button>
  );
}

/* ───────────────────────── DRAWER (detalle/edición/creación) ───────────────────────── */

function ContentDrawer({
  client, piece, createAt, onClose,
}: {
  client: Client;
  piece: ContentPiece | null;
  createAt?: Date;
  onClose: () => void;
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
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      setDraft({
        ...draft,
        copyText: `[Generado] Hook: "${draft.title}" — abrir con dolor del avatar, validar empatía, presentar el cambio, cerrar con CTA al ${draft.hasLeadMagnet ? 'lead magnet en bio' : 'producto principal'}.`,
      });
      toast.success('Copy generado con IA');
    } finally {
      setLoading(false);
    }
  };

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
          <Input
            label="Título"
            required
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Plataforma"
              required
              value={draft.platform}
              onChange={(e) => setDraft({ ...draft, platform: e.target.value as ContentPlatform })}
              options={Object.entries(PLATFORM_META).map(([v, m]) => ({ value: v, label: `${m.emoji} ${m.label}` }))}
            />
            <Select
              label="Formato"
              required
              value={draft.format}
              onChange={(e) => setDraft({ ...draft, format: e.target.value as ContentFormat })}
              options={Object.entries(FORMAT_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-text-secondary">Copy</label>
              <button
                onClick={generateCopy}
                disabled={loading}
                className="text-[11px] inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 hover:bg-bg-elevated disabled:opacity-50"
                style={{ color: accent }}
              >
                <Sparkles className="h-3 w-3" /> {loading ? 'Generando…' : 'Generar con IA'}
              </button>
            </div>
            <Textarea
              rows={4}
              value={draft.copyText}
              onChange={(e) => setDraft({ ...draft, copyText: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateInput
              label="📹 Grabación"
              value={draft.recordingDate}
              onChange={(v) => setDraft({ ...draft, recordingDate: v })}
            />
            <DateInput
              label="✂️ Edición"
              value={draft.editingDate}
              onChange={(v) => setDraft({ ...draft, editingDate: v })}
            />
            <DateInput
              label="✅ Aprobación"
              value={draft.approvalDate}
              onChange={(v) => setDraft({ ...draft, approvalDate: v })}
            />
            <DateInput
              label="📅 Publicación"
              value={draft.publishDate}
              onChange={(v) => setDraft({ ...draft, publishDate: v })}
            />
          </div>

          <Select
            label="Estado"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as ContentStatus })}
            options={STATUS_FLOW.map((s) => ({ value: s, label: CONTENT_STATUS_META[s].label }))}
          />

          <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.hasLeadMagnet}
                onChange={(e) => setDraft({ ...draft, hasLeadMagnet: e.target.checked })}
                className="h-4 w-4 accent-accent-violet"
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
              />
            )}
          </div>

          <Textarea
            label="Notas de producción"
            rows={3}
            value={draft.productionNotes ?? ''}
            onChange={(e) => setDraft({ ...draft, productionNotes: e.target.value })}
          />

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              Archivo (imagen / video)
            </label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="URL del archivo o súbelo a Drive"
                value={draft.mediaUrl ?? ''}
                onChange={(e) => setDraft({ ...draft, mediaUrl: e.target.value })}
              />
              <Button size="sm" variant="secondary" leftIcon={<Upload className="h-3.5 w-3.5" />}>
                Subir
              </Button>
            </div>
          </div>

          {draft.status === 'rejected' && (
            <Textarea
              label="Notas de rechazo (visibles al equipo)"
              rows={3}
              value={draft.approvalNotes ?? ''}
              onChange={(e) => setDraft({ ...draft, approvalNotes: e.target.value })}
              className="border-status-danger/40"
            />
          )}
        </div>

        <footer className="border-t border-border-subtle px-5 py-3 flex items-center justify-between gap-2">
          <div>
            {!isNew && (
              <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={del}>
                Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" leftIcon={<Save className="h-3.5 w-3.5" />} onClick={save}>
              {isNew ? 'Crear pieza' : 'Guardar'}
            </Button>
          </div>
        </footer>
      </motion.aside>
    </>
  );
}

function DateInput({
  label, value, onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
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
    />
  );
}

function buildEmpty(clientId: string, when: Date): ContentPiece {
  const iso = when.toISOString();
  return {
    id: `ct_${Math.random().toString(36).slice(2, 8)}`,
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
