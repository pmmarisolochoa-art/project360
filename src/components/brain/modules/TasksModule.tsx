import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Filter, Clock, AlertTriangle, Trash2, ArrowRight, MessageSquare, Link2,
  LayoutGrid, List, GanttChartSquare, FileInput, FileOutput, Lock,
} from 'lucide-react';
import {
  addDays, differenceInDays, differenceInHours, format, parseISO,
  max as dateMax, min as dateMin,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Task, TaskPriority, TaskStatus } from '@/types/task';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useClientStore } from '@/store/useClientStore';
import { withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/dateHelpers';
import { genId } from '@/utils/id';

const COLUMNS: Array<{ status: TaskStatus; label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = [
  { status: 'pending', label: 'Pendiente', tone: 'neutral' },
  { status: 'in_progress', label: 'En Progreso', tone: 'info' },
  { status: 'in_review', label: 'En Revisión', tone: 'warning' },
  { status: 'completed', label: 'Completado', tone: 'success' },
  { status: 'blocked', label: 'Bloqueado', tone: 'danger' },
];

const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'warning' | 'subtle'> = {
  P1: 'danger',
  P2: 'warning',
  P3: 'subtle',
};

export function TasksModule({ client }: { client: Client }) {
  // IMPORTANTE: el selector debe devolver una referencia estable.
  // Filtrar dentro del selector crea un array nuevo en cada render y
  // dispara "Maximum update depth exceeded" en Zustand + StrictMode.
  const allTasks = useClientStore((s) => s.tasks);
  const tasks = useMemo(
    () => allTasks.filter((t) => t.clientId === client.id),
    [allTasks, client.id],
  );
  const addTask = useClientStore((s) => s.addTask);
  const updateTask = useClientStore((s) => s.updateTask);
  const deleteTask = useClientStore((s) => s.deleteTask);

  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<'kanban' | 'list' | 'gantt'>('kanban');

  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assignedTo).filter(Boolean))),
    [tasks],
  );

  const filtered = tasks.filter(
    (t) =>
      (!filterAssignee || t.assignedTo === filterAssignee) &&
      (!filterPriority || t.priority === filterPriority),
  );

  const accent = client.primaryColor;

  const overdueCount = filtered.filter((t) => t.isDelayed && t.status !== 'completed').length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="surface p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-text-muted mr-2">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <Select
          options={[
            { value: '', label: 'Todos los responsables' },
            ...assignees.map((a) => ({ value: a, label: a })),
          ]}
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="min-w-[180px]"
        />
        <Select
          options={[
            { value: '', label: 'Todas las prioridades' },
            { value: 'P1', label: 'P1 · Crítica' },
            { value: 'P2', label: 'P2 · Alta' },
            { value: 'P3', label: 'P3 · Normal' },
          ]}
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="min-w-[180px]"
        />

        <div className="ml-auto flex items-center gap-2">
          {overdueCount > 0 && (
            <Badge tone="danger">
              <AlertTriangle className="h-3 w-3" /> {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
            </Badge>
          )}
          <div className="inline-flex rounded-[10px] border border-border-subtle bg-bg-base/40 p-0.5">
            <button onClick={() => setView('kanban')} className={cn('px-2 py-1 rounded-md text-xs inline-flex items-center gap-1', view === 'kanban' ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary')}>
              <LayoutGrid className="h-3 w-3" /> Kanban
            </button>
            <button onClick={() => setView('list')} className={cn('px-2 py-1 rounded-md text-xs inline-flex items-center gap-1', view === 'list' ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary')}>
              <List className="h-3 w-3" /> Lista
            </button>
            <button onClick={() => setView('gantt')} className={cn('px-2 py-1 rounded-md text-xs inline-flex items-center gap-1', view === 'gantt' ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary')}>
              <GanttChartSquare className="h-3 w-3" /> Gantt
            </button>
          </div>
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Nueva tarea
          </Button>
        </div>
      </div>

      {/* Vista seleccionada */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className="rounded-[14px] p-3 min-h-[400px] flex flex-col border border-border-subtle"
                style={{ background: 'var(--kanban-column-bg)' }}
              >
                <header className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={col.tone}>{col.label}</Badge>
                  </div>
                  <span className="text-xs text-text-muted font-mono">{colTasks.length}</span>
                </header>
                <div className="space-y-2 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="text-[11px] text-text-muted text-center py-6 italic">Sin tareas</div>
                  ) : (
                    colTasks.map((task, idx) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        accent={accent}
                        index={idx}
                        clientId={client.id}
                        allTasks={tasks}
                        onOpen={() => setEditing(task)}
                        onAdvance={() => advanceStatus(task, updateTask)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <TasksList tasks={filtered} accent={accent} allTasks={tasks} onOpen={setEditing} />
      )}

      {view === 'gantt' && (
        <TasksGantt tasks={filtered} accent={accent} allTasks={tasks} onOpen={setEditing} />
      )}

      {/* Modal detalle / edición */}
      {editing && (
        <TaskModal
          task={editing}
          accent={accent}
          allTasks={tasks}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateTask(editing.id, patch);
            setEditing(null);
          }}
          onDelete={() => {
            deleteTask(editing.id);
            setEditing(null);
          }}
        />
      )}

      {creating && (
        <TaskModal
          accent={accent}
          allTasks={tasks}
          onClose={() => setCreating(false)}
          onSave={(patch) => {
            addTask({
              id: genId(),
              clientId: client.id,
              title: patch.title ?? '',
              description: patch.description,
              status: (patch.status as TaskStatus) ?? 'pending',
              priority: (patch.priority as TaskPriority) ?? 'P2',
              assignedTo: patch.assignedTo ?? '',
              dueDate: patch.dueDate ?? new Date().toISOString(),
              isDelayed: false,
              delayDays: 0,
              moduleTag: patch.moduleTag,
              createdAt: new Date().toISOString(),
            });
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function advanceStatus(task: Task, updateTask: (id: string, p: Partial<Task>) => void) {
  const flow: TaskStatus[] = ['pending', 'in_progress', 'in_review', 'completed'];
  const i = flow.indexOf(task.status);
  if (i < 0 || i === flow.length - 1) return;
  const nextStatus = flow[i + 1];
  updateTask(task.id, {
    status: nextStatus,
    completedAt: nextStatus === 'completed' ? new Date().toISOString() : undefined,
  });
}

/* ───────────────────────── Task Card ───────────────────────── */

function TaskCard({
  task, accent, index, onOpen, onAdvance, clientId, allTasks,
}: {
  task: Task;
  accent: string;
  index: number;
  onOpen: () => void;
  onAdvance: () => void;
  clientId: string;
  allTasks: Task[];
}) {
  const navigate = useNavigate();
  const hoursUntil = differenceInHours(parseISO(task.dueDate), new Date());
  const dueSoon = hoursUntil >= 0 && hoursUntil <= 24 && task.status !== 'completed';
  const fromRopre = task.origin?.type === 'ropre';
  const blockingDeps = (task.dependsOn ?? []).map((id) => allTasks.find((t) => t.id === id)).filter((t): t is Task => !!t && t.status !== 'completed');
  const dependentsCount = allTasks.filter((t) => t.dependsOn?.includes(task.id)).length;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      onClick={onOpen}
      className="w-full text-left rounded-[10px] border p-3 transition focus-ring hover:brightness-[1.02]"
      style={{
        background: 'var(--kanban-card-bg)',
        borderColor:
          task.isDelayed && task.status !== 'completed'
            ? 'rgba(239,68,68,0.5)'
            : dueSoon
            ? 'rgba(245,158,11,0.5)'
            : 'var(--kanban-card-border)',
        boxShadow: 'var(--kanban-card-shadow)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[task.priority]} className="shrink-0">
            {task.priority}
          </Badge>
          {fromRopre && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/client/${clientId}/ropre`);
              }}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition cursor-pointer hover:brightness-125"
              style={{
                background: withAlpha(accent, 0.15),
                borderColor: withAlpha(accent, 0.4),
                color: accent,
              }}
              title="Ver entregable en Módulo 05 · ROPRE"
            >
              <Link2 className="h-2.5 w-2.5" /> ROPRE
            </span>
          )}
        </div>
        {task.moduleTag && !fromRopre && (
          <span className="text-[9px] uppercase tracking-wider text-text-muted">
            {task.moduleTag}
          </span>
        )}
      </div>

      <div className="text-sm text-text-primary leading-snug mb-2 line-clamp-3">
        {task.title}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span
          className="flex items-center gap-1 text-text-muted"
          style={task.isDelayed && task.status !== 'completed' ? { color: '#EF4444' } : undefined}
        >
          <Clock className="h-3 w-3" />
          {task.isDelayed && task.status !== 'completed'
            ? `${task.delayDays}d vencida`
            : formatRelative(task.dueDate)}
        </span>
        <span
          className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
          title={task.assignedTo}
        >
          {task.assignedTo[0]?.toUpperCase() ?? '?'}
        </span>
      </div>

      {/* I/O + dependencias badges */}
      {(task.input || task.output || (task.dependsOn?.length ?? 0) > 0 || dependentsCount > 0) && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {task.input && (
            <span title={`INPUT: ${task.input}`} className="inline-flex items-center gap-0.5 rounded-full bg-bg-elevated/60 border border-border-subtle px-1.5 py-0.5 text-[9px] text-text-secondary">
              <FileInput className="h-2.5 w-2.5" /> IN
            </span>
          )}
          {task.output && (
            <span title={`OUTPUT: ${task.output}`} className="inline-flex items-center gap-0.5 rounded-full bg-bg-elevated/60 border border-border-subtle px-1.5 py-0.5 text-[9px] text-text-secondary">
              <FileOutput className="h-2.5 w-2.5" /> OUT
            </span>
          )}
          {(task.dependsOn?.length ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: 'rgba(245,158,11,0.10)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Link2 className="h-2.5 w-2.5" /> Depende de {task.dependsOn!.length}
            </span>
          )}
          {dependentsCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-cyan/15 border border-accent-cyan/30 px-1.5 py-0.5 text-[9px] text-accent-cyan">
              <Link2 className="h-2.5 w-2.5" /> {dependentsCount} dependen
            </span>
          )}
        </div>
      )}
      {blockingDeps.length > 0 && task.status !== 'completed' && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] uppercase tracking-wider" style={{ background: 'rgba(245,158,11,0.10)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Lock className="h-2.5 w-2.5" /> Bloqueada — depende de: {blockingDeps[0].title.slice(0, 24)}{blockingDeps.length > 1 ? ` +${blockingDeps.length - 1}` : ''}
        </div>
      )}

      {task.status !== 'completed' && task.status !== 'blocked' && (
        <div
          className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-end text-[11px] text-text-muted hover:text-accent-violet"
          onClick={(e) => {
            e.stopPropagation();
            onAdvance();
          }}
        >
          Avanzar <ArrowRight className="h-3 w-3 ml-1" />
        </div>
      )}
    </motion.button>
  );
}

/* ───────────────────────── Modal ───────────────────────── */

function TaskModal({
  task, accent, onClose, onSave, onDelete, allTasks,
}: {
  task?: Task;
  accent: string;
  onClose: () => void;
  onSave: (patch: Partial<Task>) => void;
  onDelete?: () => void;
  allTasks: Task[];
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'P2');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '');
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 16) : new Date().toISOString().slice(0, 16),
  );
  const [moduleTag, setModuleTag] = useState(task?.moduleTag ?? '');
  const [input, setInput] = useState(task?.input ?? '');
  const [output, setOutput] = useState(task?.output ?? '');
  const [dependsOn, setDependsOn] = useState<string[]>(task?.dependsOn ?? []);
  const dependents = task ? allTasks.filter((t) => t.dependsOn?.includes(task.id)) : [];

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          {task ? 'Editar tarea' : 'Nueva tarea'}
        </span>
      }
      footer={
        <>
          {onDelete && (
            <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={onDelete}>
              Eliminar
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onSave({
                title, description, status, priority, assignedTo,
                dueDate: new Date(dueDate).toISOString(),
                moduleTag: moduleTag || undefined,
                input: input || undefined,
                output: output || undefined,
                dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
              })
            }
          >
            {task ? 'Guardar' : 'Crear tarea'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Título"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          label="Descripción"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Estado"
            options={COLUMNS.map((c) => ({ value: c.status, label: c.label }))}
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          />
          <Select
            label="Prioridad"
            options={[
              { value: 'P1', label: 'P1 · Crítica' },
              { value: 'P2', label: 'P2 · Alta' },
              { value: 'P3', label: 'P3 · Normal' },
            ]}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          />
          <Input
            label="Responsable"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          />
          <Input
            label="Vencimiento"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <Input
          label="Etiqueta de módulo"
          value={moduleTag}
          onChange={(e) => setModuleTag(e.target.value)}
          placeholder="content, ads, strategy, ops…"
        />

        <div className="grid grid-cols-1 gap-3 rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
          <Textarea
            label="INPUT — ¿Qué se necesita para iniciar esta tarea?"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Activos, accesos, decisiones previas…"
          />
          <Textarea
            label="OUTPUT — ¿Qué entrega/produce esta tarea?"
            rows={2}
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder="Entregable concreto, resultado medible…"
          />
        </div>

        <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Esta tarea depende de</label>
            <select
              multiple
              value={dependsOn}
              onChange={(e) => setDependsOn(Array.from(e.target.selectedOptions).map((o) => o.value))}
              className="w-full bg-bg-surface border border-border-subtle rounded-md px-2 py-2 text-sm text-text-primary outline-none focus:border-accent-violet/60 min-h-[80px]"
            >
              {allTasks.filter((t) => t.id !== task?.id).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.priority} · {t.title.slice(0, 60)}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-text-muted mt-1">Mantén Cmd/Ctrl para seleccionar varias</div>
          </div>
          {task && dependents.length > 0 && (
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">De esta tarea dependen</label>
              <div className="space-y-1">
                {dependents.map((t) => (
                  <div key={t.id} className="rounded-md border border-border-subtle bg-bg-elevated/30 px-2 py-1.5 text-xs text-text-secondary">
                    {t.priority} · {t.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {task && (
          <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 text-xs text-text-muted flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Hilo de comentarios y subtareas — disponible en próxima iteración.
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ───────────────────────── Vista Lista ───────────────────────── */

function TasksList({
  tasks, accent, allTasks, onOpen,
}: {
  tasks: Task[];
  accent: string;
  allTasks: Task[];
  onOpen: (t: Task) => void;
}) {
  const sorted = [...tasks].sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted border-b border-border-default [background:var(--table-header-bg)] [color:var(--table-header-text)]">
            <th className="py-2 pl-3 pr-3">Prioridad</th>
            <th className="py-2 pr-3">Tarea</th>
            <th className="py-2 pr-3">Responsable</th>
            <th className="py-2 pr-3">Vence</th>
            <th className="py-2 pr-3">Estado</th>
            <th className="py-2 pr-3">Deps</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const blocked = (t.dependsOn ?? []).some((id) => allTasks.find((x) => x.id === id)?.status !== 'completed');
            return (
              <tr key={t.id} onClick={() => onOpen(t)} className="border-b border-border-subtle/30 cursor-pointer hover:bg-bg-elevated/30">
                <td className="py-2.5 pl-3 pr-3"><Badge tone={t.priority === 'P1' ? 'danger' : t.priority === 'P2' ? 'warning' : 'neutral'}>{t.priority}</Badge></td>
                <td className="py-2.5 pr-3 text-text-primary">
                  {t.title}
                  {blocked && t.status !== 'completed' && (
                    <span className="ml-2 text-[10px] inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5" style={{ background: 'rgba(245,158,11,0.10)', color: '#F59E0B' }}>
                      <Lock className="h-2.5 w-2.5" /> Bloqueada
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-text-secondary text-xs">{t.assignedTo}</td>
                <td className="py-2.5 pr-3 text-xs">{format(parseISO(t.dueDate), 'd MMM', { locale: es })}</td>
                <td className="py-2.5 pr-3 text-xs text-text-secondary">{t.status}</td>
                <td className="py-2.5 pr-3 text-xs text-text-muted">{(t.dependsOn?.length ?? 0)} / {allTasks.filter((x) => x.dependsOn?.includes(t.id)).length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Vista Gantt ───────────────────────── */

function TasksGantt({
  tasks, accent, allTasks, onOpen,
}: {
  tasks: Task[];
  accent: string;
  allTasks: Task[];
  onOpen: (t: Task) => void;
}) {
  if (tasks.length === 0) {
    return <div className="surface p-10 text-center text-sm text-text-muted">Sin tareas para mostrar.</div>;
  }
  const taskStart = (t: Task) => t.startDate ? parseISO(t.startDate) : parseISO(t.createdAt);
  const taskEnd = (t: Task) => parseISO(t.dueDate);
  const allStarts = tasks.map(taskStart);
  const allEnds = tasks.map(taskEnd);
  const minDate = dateMin(allStarts);
  const maxDate = dateMax(allEnds);
  const totalDays = Math.max(differenceInDays(maxDate, minDate), 1);
  const ratio = (d: Date) => (differenceInDays(d, minDate) / totalDays) * 100;

  const sorted = [...tasks].sort((a, b) => +taskStart(a) - +taskStart(b));
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));

  const STATUS_COLOR: Record<Task['status'], string> = {
    pending: '#6B6B80',
    in_progress: accent,
    in_review: '#F59E0B',
    completed: '#10B981',
    blocked: '#EF4444',
  };

  return (
    <div className="surface p-4 overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="flex items-center justify-between text-[10px] text-text-muted mb-3 pl-[280px]">
          <span>{format(minDate, 'd MMM yyyy', { locale: es })}</span>
          <span>{format(maxDate, 'd MMM yyyy', { locale: es })}</span>
        </div>
        <div className="space-y-2 relative">
          {/* Líneas de dependencia (capa SVG absoluta) */}
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ overflow: 'visible' }}>
            {sorted.map((t, ti) => {
              const deps = (t.dependsOn ?? []).map((id) => taskById[id]).filter(Boolean);
              return deps.map((dep) => {
                const di = sorted.findIndex((x) => x.id === dep.id);
                if (di < 0) return null;
                const fromY = (di + 0.5) * 36 + 24;
                const toY = (ti + 0.5) * 36 + 24;
                const fromXPct = ratio(taskEnd(dep));
                const toXPct = ratio(taskStart(t));
                const conflict = +taskStart(t) < +taskEnd(dep);
                return (
                  <line
                    key={`${t.id}-${dep.id}`}
                    x1={`calc(280px + ${fromXPct}% * (100% - 280px) / 100%)`}
                    y1={fromY}
                    x2={`calc(280px + ${toXPct}% * (100% - 280px) / 100%)`}
                    y2={toY}
                    stroke={conflict ? '#EF4444' : withAlpha(accent, 0.6)}
                    strokeWidth={1.5}
                    strokeDasharray={conflict ? '0' : '3 3'}
                    markerEnd={conflict ? 'url(#arrow-red)' : 'url(#arrow-accent)'}
                  />
                );
              });
            })}
            <defs>
              <marker id="arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={accent} />
              </marker>
              <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
              </marker>
            </defs>
          </svg>

          {sorted.map((t) => {
            const start = taskStart(t);
            const end = taskEnd(t);
            const offset = ratio(start);
            const span = Math.max(((differenceInDays(end, start) + 1) / totalDays) * 100, 2);
            const color = STATUS_COLOR[t.status];
            return (
              <div key={t.id} className="grid grid-cols-[260px_1fr] gap-3 items-center" style={{ height: 28 }}>
                <button
                  onClick={() => onOpen(t)}
                  className="flex items-center gap-2 text-left text-xs text-text-primary hover:text-accent-violet truncate focus-ring"
                  title={`${t.title}\nResponsable: ${t.assignedTo}\nInput: ${t.input ?? '—'}\nOutput: ${t.output ?? '—'}\n${format(start, 'd MMM', { locale: es })} → ${format(end, 'd MMM', { locale: es })}\nEstado: ${t.status}`}
                >
                  <span
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
                  >
                    {t.assignedTo[0]?.toUpperCase() ?? '?'}
                  </span>
                  <span className="truncate">{t.title}</span>
                </button>
                <div className="relative h-6">
                  <button
                    onClick={() => onOpen(t)}
                    className="absolute rounded-md flex items-center px-1.5 hover:brightness-125 transition"
                    style={{
                      left: `${offset}%`,
                      width: `${span}%`,
                      top: 6,
                      bottom: 6,
                      background: color,
                      boxShadow: `0 0 10px -4px ${color}`,
                    }}
                  >
                    <span className="text-[9px] text-white truncate">{t.priority}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
