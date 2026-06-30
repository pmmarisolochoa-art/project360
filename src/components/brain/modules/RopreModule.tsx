import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Target, ListChecks, Lightbulb, AlertOctagon, Package,
  LayoutGrid, GanttChartSquare, Plus, Link2, CheckCircle2, Zap,
} from 'lucide-react';
import type { Client } from '@/types/client';
import type { DeliverableStatus, RiskLevel, RopreItem } from '@/types/ropre';
import type { Task, TaskPriority } from '@/types/task';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useRopreStore } from '@/store/useRopreStore';
import { useClientStore } from '@/store/useClientStore';
import { toast } from '@/store/useToastStore';
import { withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';
import { differenceInDays, format, parseISO, max as dateMax, min as dateMin } from 'date-fns';
import { genId } from '@/utils/id';

const DELIV_COLS: Array<{ status: DeliverableStatus; label: string; tone: 'neutral' | 'info' | 'warning' | 'success' }> = [
  { status: 'todo', label: 'Por hacer', tone: 'neutral' },
  { status: 'in_progress', label: 'En progreso', tone: 'info' },
  { status: 'review', label: 'Revisión', tone: 'warning' },
  { status: 'done', label: 'Completado', tone: 'success' },
];

const RISK_TONE: Record<RiskLevel, 'danger' | 'warning' | 'neutral'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const RISK_LABEL: Record<RiskLevel, string> = {
  high: 'Riesgo alto',
  medium: 'Riesgo medio',
  low: 'Riesgo bajo',
};

export function RopreModule({ client, readOnly = false }: { client: Client; readOnly?: boolean }) {
  const navigate = useNavigate();
  // Igual que TasksModule: filtrar en el selector causa loop infinito.
  const allItems = useRopreStore((s) => s.items);
  const items = useMemo(
    () => allItems.filter((i) => i.clientId === client.id),
    [allItems, client.id],
  );
  const accent = client.primaryColor;

  // Última edición desde una reunión ROPRE — para el badge del header.
  const lastEdit = useMemo(() => {
    const stamps = items
      .map((i) => i.lastEditedAt)
      .filter((s): s is string => !!s)
      .sort()
      .reverse();
    return stamps[0];
  }, [items]);

  const grouped = useMemo(
    () => ({
      result: items.filter((i) => i.type === 'result'),
      objective: items.filter((i) => i.type === 'objective'),
      premise: items.filter((i) => i.type === 'premise'),
      risk: items.filter((i) => i.type === 'risk'),
      deliverable: items.filter((i) => i.type === 'deliverable'),
    }),
    [items],
  );

  // Empty state — guía al PM hacia una reunión ROPRE para empezar.
  if (items.length === 0) {
    return (
      <div className="surface p-10 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center" style={{ background: withAlpha(accent, 0.15) }}>
          <Target className="h-5 w-5" style={{ color: accent }} />
        </div>
        <div>
          <h3 className="heading text-lg font-bold mb-1">Sin ROPRE definido</h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Crea una <strong>Reunión de Estrategia ROPRE & Entregables</strong> para definir Resultado, Objetivos, Premisas, Riesgos y Entregables del cliente.
            Los cambios se guardan automáticamente acá.
          </p>
        </div>
        {!readOnly && (
          <Button onClick={() => navigate(`/client/${client.id}/agenda?create=ropre`)}>
            Crear reunión de Estrategia ROPRE
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {lastEdit && (
        <div className="text-[11px] text-text-muted">
          Última actualización: {format(parseISO(lastEdit), "d MMM yyyy 'a las' HH:mm")}
        </div>
      )}
      {/* R — Resultado */}
      <SectionBlock
        icon={<Target className="h-4 w-4" />}
        letter="R"
        title="Resultado esperado"
        subtitle="OKR principal del proyecto"
        accent={accent}
      >
        {grouped.result.length === 0 ? (
          <EmptyMini accent={accent} message="Aún no se ha definido el resultado principal." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {grouped.result.map((r) => (
              <OkrCard key={r.id} item={r} accent={accent} />
            ))}
          </div>
        )}
      </SectionBlock>

      {/* O — Objetivos */}
      <SectionBlock
        icon={<ListChecks className="h-4 w-4" />}
        letter="O"
        title="Objetivos secundarios"
        subtitle="Métricas medibles que soportan el resultado"
        accent={accent}
      >
        {grouped.objective.length === 0 ? (
          <EmptyMini accent={accent} message="Sin objetivos secundarios todavía." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {grouped.objective.map((o) => (
              <OkrCard key={o.id} item={o} accent={accent} compact />
            ))}
          </div>
        )}
      </SectionBlock>

      {/* P — Premisas */}
      <SectionBlock
        icon={<Lightbulb className="h-4 w-4" />}
        letter="P"
        title="Premisas estratégicas"
        subtitle="Supuestos del mercado que sostienen el plan"
        accent={accent}
      >
        {grouped.premise.length === 0 ? (
          <EmptyMini accent={accent} message="Sin premisas registradas." />
        ) : (
          <ul className="space-y-2">
            {grouped.premise.map((p) => (
              <li key={p.id} className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-4">
                <div className="text-sm text-text-primary font-medium">{p.title}</div>
                {p.description && (
                  <div className="text-xs text-text-secondary mt-1.5 leading-relaxed">{p.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>

      {/* R — Riesgos */}
      <SectionBlock
        icon={<AlertOctagon className="h-4 w-4" />}
        letter="R"
        title="Riesgos identificados"
        subtitle="Con nivel y plan de mitigación"
        accent={accent}
      >
        {grouped.risk.length === 0 ? (
          <EmptyMini accent={accent} message="Sin riesgos registrados." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {grouped.risk.map((r) => (
              <div
                key={r.id}
                className="rounded-[10px] border p-4"
                style={{
                  borderColor:
                    r.riskLevel === 'high'
                      ? 'rgba(239,68,68,0.35)'
                      : r.riskLevel === 'medium'
                      ? 'rgba(245,158,11,0.30)'
                      : 'rgba(255,255,255,0.08)',
                  background:
                    r.riskLevel === 'high'
                      ? 'rgba(239,68,68,0.05)'
                      : r.riskLevel === 'medium'
                      ? 'rgba(245,158,11,0.04)'
                      : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-sm font-semibold text-text-primary leading-snug">{r.title}</div>
                  {r.riskLevel && <Badge tone={RISK_TONE[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</Badge>}
                </div>
                {r.mitigation && (
                  <div className="text-xs text-text-secondary leading-relaxed">
                    <span className="text-text-muted uppercase tracking-wider text-[10px]">Mitigación · </span>
                    {r.mitigation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionBlock>

      {/* E — Entregables (Kanban + Gantt) */}
      <DeliverablesSection items={grouped.deliverable} accent={accent} clientId={client.id} readOnly={readOnly} />
    </div>
  );
}

/* ───────────────────────── Sub-componentes ───────────────────────── */

function SectionBlock({
  icon, letter, title, subtitle, accent, children,
}: {
  icon: React.ReactNode;
  letter: string;
  title: string;
  subtitle?: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-5">
      <header className="flex items-center gap-3 mb-4">
        <div
          className="h-10 w-10 rounded-[10px] flex items-center justify-center heading text-lg font-bold"
          style={{ background: withAlpha(accent, 0.15), color: accent }}
        >
          {letter}
        </div>
        <div className="flex-1">
          <h3 className="heading text-base font-bold flex items-center gap-1.5">{icon}{title}</h3>
          {subtitle && <div className="text-[11px] text-text-muted">{subtitle}</div>}
        </div>
      </header>
      {children}
    </section>
  );
}

function OkrCard({ item, accent, compact }: { item: RopreItem; accent: string; compact?: boolean }) {
  const progress = parseProgress(item.currentValue, item.targetValue);
  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-4">
      <div className="text-sm text-text-primary font-medium leading-snug mb-2">{item.title}</div>
      {item.targetValue && (
        <>
          <div className="flex items-baseline justify-between text-xs mt-3">
            <span className="text-text-muted">Actual</span>
            <span className="text-text-primary font-semibold">{item.currentValue ?? '—'}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs mt-1">
            <span className="text-text-muted">Meta</span>
            <span style={{ color: accent }} className="font-semibold">{item.targetValue}</span>
          </div>
          {progress !== null && (
            <div className="mt-3 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0.6)})` }}
              />
            </div>
          )}
        </>
      )}
      {!compact && item.description && (
        <p className="text-xs text-text-secondary mt-3 leading-relaxed">{item.description}</p>
      )}
    </div>
  );
}

function parseProgress(current?: string, target?: string): number | null {
  if (!current || !target || current === '—') return null;
  const c = Number(current.replace(/[^\d.]/g, ''));
  const t = Number(target.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(c) || !Number.isFinite(t) || t === 0) return null;
  return Math.min(100, Math.round((c / t) * 100));
}

function EmptyMini({ accent, message }: { accent: string; message: string }) {
  return (
    <div
      className="rounded-[10px] border border-dashed p-6 text-center text-sm text-text-muted"
      style={{ borderColor: withAlpha(accent, 0.18) }}
    >
      {message}
    </div>
  );
}

/* ───────────────────────── Entregables: Kanban + Gantt ───────────────────────── */

function DeliverablesSection({
  items, accent, clientId, readOnly = false,
}: {
  items: RopreItem[];
  accent: string;
  clientId: string;
  readOnly?: boolean;
}) {
  const [view, setView] = useState<'kanban' | 'gantt'>('kanban');
  const update = useRopreStore((s) => s.update);
  const add = useRopreStore((s) => s.add);
  const addTask = useClientStore((s) => s.addTask);
  const allTasks = useClientStore((s) => s.tasks);

  const promoteToTask = (item: RopreItem) => {
    if (item.linkedTaskId) {
      toast.info('Este entregable ya tiene una tarea vinculada.');
      return;
    }
    const task = buildTaskFromDeliverable(item, clientId);
    addTask(task);
    update(item.id, { linkedTaskId: task.id });
    toast.success(`Tarea creada: "${task.title}"`);
  };

  const syncAll = () => {
    const targets = items.filter((i) => i.type === 'deliverable' && !i.linkedTaskId && i.status !== 'done');
    if (targets.length === 0) {
      toast.info('Todos los entregables ya están sincronizados.');
      return;
    }
    for (const item of targets) {
      const task = buildTaskFromDeliverable(item, clientId);
      addTask(task);
      update(item.id, { linkedTaskId: task.id });
    }
    toast.success(`${targets.length} entregable${targets.length === 1 ? '' : 's'} sincronizado${targets.length === 1 ? '' : 's'} como tarea${targets.length === 1 ? '' : 's'}.`);
  };

  return (
    <section className="surface p-5">
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-[10px] flex items-center justify-center heading text-lg font-bold"
            style={{ background: withAlpha(accent, 0.15), color: accent }}
          >
            E
          </div>
          <div>
            <h3 className="heading text-base font-bold flex items-center gap-1.5">
              <Package className="h-4 w-4" /> Entregables comprometidos
            </h3>
            <div className="text-[11px] text-text-muted">Vista Kanban + línea de tiempo</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-[10px] border border-border-subtle bg-bg-base/40 p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs inline-flex items-center gap-1.5 transition',
                view === 'kanban'
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
            <button
              onClick={() => setView('gantt')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs inline-flex items-center gap-1.5 transition',
                view === 'gantt'
                  ? 'bg-bg-elevated text-text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <GanttChartSquare className="h-3.5 w-3.5" /> Gantt
            </button>
          </div>

          {!readOnly && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Zap className="h-3.5 w-3.5" />}
              onClick={syncAll}
            >
              Sincronizar todos
            </Button>
          )}

          {!readOnly && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() =>
                add({
                  id: genId(),
                  clientId,
                  type: 'deliverable',
                  title: 'Nuevo entregable',
                  status: 'todo',
                  startDate: new Date().toISOString(),
                  dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
                  createdAt: new Date().toISOString(),
                })
              }
            >
              Agregar
            </Button>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyMini accent={accent} message="Sin entregables registrados todavía." />
      ) : view === 'kanban' ? (
        <DeliverablesKanban
          items={items}
          accent={accent}
          onAdvance={(id, status) => update(id, { status })}
          onPromoteToTask={promoteToTask}
          tasksById={Object.fromEntries(allTasks.map((t) => [t.id, t]))}
          readOnly={readOnly}
        />
      ) : (
        <DeliverablesGantt items={items} accent={accent} />
      )}
    </section>
  );
}

function buildTaskFromDeliverable(item: RopreItem, clientId: string): Task {
  // Heredamos prioridad desde el "riesgo asociado" implícito: si el entregable
  // no tiene riskLevel propio, asumimos P2. Estos items son deliverables, no risks,
  // pero usamos su status para inferir urgencia.
  const priority: TaskPriority =
    item.status === 'review' ? 'P1' : item.status === 'in_progress' ? 'P2' : 'P3';
  return {
    id: genId(),
    clientId,
    title: item.title,
    description: item.description,
    status: item.status === 'done' ? 'completed' : 'pending',
    priority,
    assignedTo: item.responsible ?? '',
    dueDate: item.dueDate ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    completedAt: item.status === 'done' ? new Date().toISOString() : undefined,
    moduleTag: 'ROPRE-Entregable',
    isDelayed: false,
    delayDays: 0,
    origin: { type: 'ropre', itemId: item.id },
    createdAt: new Date().toISOString(),
  };
}

function DeliverablesKanban({
  items, accent, onAdvance, onPromoteToTask, tasksById, readOnly = false,
}: {
  items: RopreItem[];
  accent: string;
  onAdvance: (id: string, status: DeliverableStatus) => void;
  onPromoteToTask: (item: RopreItem) => void;
  tasksById: Record<string, Task>;
  readOnly?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {DELIV_COLS.map((col) => {
        const colItems = items.filter((i) => (i.status ?? 'todo') === col.status);
        return (
          <div
            key={col.status}
            className="rounded-[10px] border border-border-subtle p-3 min-h-[220px]"
            style={{ background: 'var(--kanban-column-bg)' }}
          >
            <header className="flex items-center justify-between mb-3">
              <Badge tone={col.tone}>{col.label}</Badge>
              <span className="text-xs text-text-muted font-mono">{colItems.length}</span>
            </header>
            <div className="space-y-2">
              {colItems.map((item, i) => {
                const linkedTask = item.linkedTaskId ? tasksById[item.linkedTaskId] : undefined;
                const taskCreated = !!linkedTask;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-md border p-2.5 transition"
                    style={{
                      background: 'var(--kanban-card-bg)',
                      borderColor: 'var(--kanban-card-border)',
                      boxShadow: 'var(--kanban-card-shadow)',
                    }}
                  >
                    <div className="text-sm text-text-primary leading-snug mb-1.5">{item.title}</div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>{item.responsible ?? '—'}</span>
                      {item.dueDate && <span>{format(parseISO(item.dueDate), 'd MMM')}</span>}
                    </div>

                    {taskCreated && (
                      <div
                        className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
                        style={{ background: withAlpha(accent, 0.10), color: accent }}
                        title={`Tarea: ${linkedTask.title}`}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Tarea creada
                      </div>
                    )}

                    {!readOnly && (
                      <div className="mt-2 flex items-center gap-1.5">
                        {item.status !== 'done' && (
                          <button
                            onClick={() => {
                              const flow: DeliverableStatus[] = ['todo', 'in_progress', 'review', 'done'];
                              const idx = flow.indexOf(item.status ?? 'todo');
                              if (idx < flow.length - 1) onAdvance(item.id, flow[idx + 1]);
                            }}
                            className="flex-1 text-[10px] uppercase tracking-wider py-1 rounded-md border border-border-subtle hover:border-accent-violet/40 transition"
                            style={{ color: accent }}
                          >
                            Avanzar →
                          </button>
                        )}
                        {!taskCreated && item.status !== 'done' && (
                          <button
                            onClick={() => onPromoteToTask(item)}
                            className="text-[10px] uppercase tracking-wider py-1 px-2 rounded-md border border-border-subtle hover:bg-bg-elevated transition flex items-center gap-1"
                            title="Crear tarea en Módulo 04"
                          >
                            <Link2 className="h-3 w-3" /> Tarea
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
              {colItems.length === 0 && (
                <div className="text-[11px] text-text-muted text-center py-4 italic">Vacío</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeliverablesGantt({ items, accent }: { items: RopreItem[]; accent: string }) {
  const withDates = items.filter((i) => i.startDate && i.dueDate);
  if (withDates.length === 0) {
    return <EmptyMini accent={accent} message="Aún no hay entregables con fechas para mostrar." />;
  }

  const starts = withDates.map((i) => parseISO(i.startDate!));
  const ends = withDates.map((i) => parseISO(i.dueDate!));
  const minDate = dateMin(starts);
  const maxDate = dateMax(ends);
  const totalDays = Math.max(differenceInDays(maxDate, minDate), 1);

  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-4 overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex items-center justify-between text-[11px] text-text-muted mb-3 pl-44">
          <span>{format(minDate, 'd MMM yyyy')}</span>
          <span>{format(maxDate, 'd MMM yyyy')}</span>
        </div>
        <div className="space-y-2">
          {withDates.map((item, i) => {
            const start = parseISO(item.startDate!);
            const end = parseISO(item.dueDate!);
            const offset = (differenceInDays(start, minDate) / totalDays) * 100;
            const span = Math.max((differenceInDays(end, start) / totalDays) * 100, 2);
            const tone = STATUS_BG[item.status ?? 'todo'];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-[170px_1fr] gap-3 items-center"
              >
                <div className="text-xs text-text-primary truncate" title={item.title}>
                  {item.title}
                </div>
                <div className="relative h-6 bg-bg-elevated/40 rounded-md">
                  <div
                    className="absolute top-0 bottom-0 rounded-md flex items-center px-2 text-[10px] text-white"
                    style={{
                      left: `${offset}%`,
                      width: `${span}%`,
                      background: `linear-gradient(90deg, ${tone || accent}, ${withAlpha(tone || accent, 0.6)})`,
                      boxShadow: `0 0 12px -4px ${tone || accent}`,
                    }}
                  >
                    <span className="truncate">{item.responsible ?? '—'}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const STATUS_BG: Record<DeliverableStatus, string> = {
  todo: '#6B6B80',
  in_progress: '#6366F1',
  review: '#F59E0B',
  done: '#10B981',
};
