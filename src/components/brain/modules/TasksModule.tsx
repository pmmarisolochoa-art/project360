import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Filter, Clock, AlertTriangle, Trash2, ArrowRight, MessageSquare, Link2,
  LayoutGrid, List, GanttChartSquare, FileInput, FileOutput, Lock, FolderOpen, ChevronDown,
} from 'lucide-react';
import {
  differenceInDays, differenceInHours, format, parseISO,
  max as dateMax, min as dateMin,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Task, TaskPriority, TaskStatus } from '@/types/task';
import { TASK_TAG_LABEL } from '@/types/task';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useClientStore } from '@/store/useClientStore';
import { toast } from '@/store/useToastStore';
import { ROLE_DEFS } from '@/types/team';
import { useTeamStore } from '@/store/useTeamStore';
import { resolveRoleLabel } from '@/utils/roleResolver';
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
  const [filterTag, setFilterTag] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'mine' | 'overdue' | 'today' | 'week'>('all');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<'kanban' | 'list' | 'gantt'>('kanban');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
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
  const bulkMove = (status: TaskStatus) => {
    for (const id of selectedIds) {
      updateTask(id, {
        status,
        completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      });
    }
    toast.success(`${selectedCount} tarea${selectedCount === 1 ? '' : 's'} movida${selectedCount === 1 ? '' : 's'}`);
    clearSelection();
  };
  const bulkDelete = () => {
    if (!confirm(`¿Eliminar ${selectedCount} tarea${selectedCount === 1 ? '' : 's'}? Esta acción no se puede deshacer.`)) return;
    for (const id of selectedIds) deleteTask(id);
    toast.success(`${selectedCount} tarea${selectedCount === 1 ? '' : 's'} eliminada${selectedCount === 1 ? '' : 's'}`);
    clearSelection();
  };

  // Auto-abrir el detalle de una tarea si la URL trae ?task=<id>.
  // Lo usa "Resolver →" del AlertsPanel para navegar directo al origen del problema.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId) return;
    const target = tasks.find((t) => t.id === taskId);
    if (target) {
      setEditing(target);
      // Limpia el query param para que cerrar/reabrir no re-abra el modal.
      const next = new URLSearchParams(searchParams);
      next.delete('task');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, tasks, setSearchParams]);

  // Filtro de responsable: SOLO por rol. Una tarea matchea un rol si:
  //  - su assignedTo es ese slug, o
  //  - su assignedTo es el nombre de un miembro del equipo con ese rol
  // El nombre se sigue mostrando dentro de la card como información.
  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);
    return tasks.filter((t) => {
      if (filterAssignee) {
        // filterAssignee es un slug de rol — buscamos coincidencia por slug o por nombre→rol
        const roleLabel = resolveRoleLabel(t.assignedTo, t.clientId);
        const targetLabel = ROLE_DEFS.find((r) => r.slug === filterAssignee)?.title;
        if (roleLabel !== targetLabel) return false;
      }
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterTag && t.tag !== filterTag) return false;
      if (quickFilter === 'mine' && t.assignedTo !== 'Marisol Ochoa') return false;
      if (quickFilter === 'overdue' && !(t.isDelayed && t.status !== 'completed')) return false;
      if (quickFilter === 'today') {
        const d = new Date(t.dueDate);
        if (d < todayStart || d >= todayEnd) return false;
      }
      if (quickFilter === 'week') {
        const d = new Date(t.dueDate);
        if (d < todayStart || d >= weekEnd) return false;
      }
      return true;
    });
  }, [tasks, filterAssignee, filterPriority, filterTag, quickFilter]);

  const accent = client.primaryColor;

  const overdueCount = filtered.filter((t) => t.isDelayed && t.status !== 'completed').length;

  const QUICK_FILTERS: Array<{ key: typeof quickFilter; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'mine', label: 'Mis tareas' },
    { key: 'overdue', label: 'Vencidas' },
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Esta semana' },
  ];

  return (
    <div className="space-y-4">
      {/* Quick filters chips */}
      <div className="surface p-2 flex flex-wrap items-center gap-1.5">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition',
              quickFilter === f.key
                ? 'bg-accent-violet/15 text-accent-violet border border-accent-violet/40'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40 border border-transparent',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="surface p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-text-muted mr-2">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <Select
          options={[
            { value: '', label: 'Todos los roles' },
            ...ROLE_DEFS.map((r) => ({ value: r.slug, label: r.title })),
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
        <Select
          options={[
            { value: '', label: 'Todas las etiquetas' },
            ...Object.entries(TASK_TAG_LABEL).map(([v, l]) => ({ value: v, label: l })),
          ]}
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="min-w-[160px]"
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
            const isDropTarget = dragOverStatus === col.status;
            return (
              <div
                key={col.status}
                className="rounded-[14px] p-3 min-h-[400px] flex flex-col border transition-colors"
                style={{
                  background: 'var(--kanban-column-bg)',
                  borderColor: isDropTarget ? accent : 'var(--border-subtle)',
                  boxShadow: isDropTarget ? `inset 0 0 0 1px ${accent}` : undefined,
                }}
                onDragOver={(e) => {
                  if (!draggedTaskId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverStatus !== col.status) setDragOverStatus(col.status);
                }}
                onDragLeave={(e) => {
                  // Solo limpia si el cursor sale del bounding box completo
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverStatus === col.status) setDragOverStatus(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
                  if (taskId) {
                    const task = tasks.find((t) => t.id === taskId);
                    if (task && task.status !== col.status) {
                      updateTask(taskId, {
                        status: col.status,
                        completedAt: col.status === 'completed' ? new Date().toISOString() : undefined,
                      });
                    }
                  }
                  setDraggedTaskId(null);
                  setDragOverStatus(null);
                }}
              >
                <header className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={col.tone}>{col.label}</Badge>
                  </div>
                  <span className="text-xs text-text-muted font-mono">{colTasks.length}</span>
                </header>
                <div className="space-y-2 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="text-[11px] text-text-muted text-center py-6 italic">
                      {isDropTarget ? 'Soltar aquí' : 'Sin tareas'}
                    </div>
                  ) : (
                    colTasks.map((task, idx) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        accent={accent}
                        index={idx}
                        clientId={client.id}
                        allTasks={tasks}
                        isDragging={draggedTaskId === task.id}
                        isSelected={selectedIds.has(task.id)}
                        anySelected={selectedCount > 0}
                        onToggleSelected={() => toggleSelected(task.id)}
                        onDragStart={(id) => setDraggedTaskId(id)}
                        onDragEnd={() => { setDraggedTaskId(null); setDragOverStatus(null); }}
                        onOpen={() => {
                          // Si hay selección activa, click en la card alterna selección
                          // (más intuitivo que abrir el modal mientras seleccionas).
                          if (selectedCount > 0) { toggleSelected(task.id); return; }
                          setEditing(task);
                        }}
                        onAdvance={() => advanceStatus(task, updateTask)}
                        onDelete={() => deleteTask(task.id)}
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

      {/* Barra flotante de acciones bulk — aparece cuando hay 1+ seleccionada */}
      {selectedCount > 0 && (
        <BulkActionsBar
          count={selectedCount}
          accent={accent}
          onMove={bulkMove}
          onDelete={bulkDelete}
          onCancel={clearSelection}
        />
      )}

      {/* Modal detalle / edición */}
      {editing && (
        <TaskModal
          task={editing}
          accent={accent}
          allTasks={tasks}
          clientId={client.id}
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
          clientId={client.id}
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
  task, accent, index, onOpen, onAdvance, onDelete, clientId, allTasks,
  isDragging, onDragStart, onDragEnd,
  isSelected, anySelected, onToggleSelected,
}: {
  task: Task;
  accent: string;
  index: number;
  onOpen: () => void;
  onAdvance: () => void;
  onDelete?: () => void;
  clientId: string;
  allTasks: Task[];
  isDragging?: boolean;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
  isSelected?: boolean;
  anySelected?: boolean;
  onToggleSelected?: () => void;
}) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hoursUntil = differenceInHours(parseISO(task.dueDate), new Date());
  const dueSoon = hoursUntil >= 0 && hoursUntil <= 24 && task.status !== 'completed';
  const fromRopre = task.origin?.type === 'ropre';
  const blockingDeps = (task.dependsOn ?? []).map((id) => allTasks.find((t) => t.id === id)).filter((t): t is Task => !!t && t.status !== 'completed');
  const dependentsCount = allTasks.filter((t) => t.dependsOn?.includes(task.id)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="group relative w-full text-left rounded-[10px] border p-3 transition hover:brightness-[1.02] cursor-grab active:cursor-grabbing"
      onClick={onOpen}
      draggable
      onDragStart={(e) => {
        // framer-motion tipa onDragStart con su propio DragEvent, pero el handler
        // recibe el evento nativo en runtime; convertimos para usar dataTransfer.
        const native = e as unknown as DragEvent;
        if (native.dataTransfer) {
          native.dataTransfer.setData('text/plain', task.id);
          native.dataTransfer.effectAllowed = 'move';
        }
        onDragStart?.(task.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      style={{
        background: 'var(--kanban-card-bg)',
        borderColor: isSelected
          ? accent
          : task.isDelayed && task.status !== 'completed'
            ? 'rgba(239,68,68,0.5)'
            : dueSoon
            ? 'rgba(245,158,11,0.5)'
            : 'var(--kanban-card-border)',
        boxShadow: isSelected
          ? `0 0 0 2px ${accent}, var(--kanban-card-shadow)`
          : 'var(--kanban-card-shadow)',
      }}
    >
      {/* Checkbox de selección múltiple — visible en hover o cuando ya hay selección */}
      {onToggleSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelected(); }}
          aria-label={isSelected ? 'Deseleccionar tarea' : 'Seleccionar tarea'}
          title={isSelected ? 'Deseleccionar' : 'Seleccionar para acción masiva'}
          className={cn(
            'absolute top-2 left-2 h-5 w-5 rounded border flex items-center justify-center transition z-10',
            (isSelected || anySelected) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            isSelected ? 'border-transparent text-white' : 'border-border-default bg-bg-base/80 text-transparent hover:border-accent-violet',
          )}
          style={isSelected ? { background: accent, borderColor: accent } : undefined}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
            <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {/* Delete button — visible on hover */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          className="absolute top-2 right-2 h-6 w-6 rounded-md bg-bg-base/80 text-text-muted hover:text-status-danger hover:bg-status-danger/10 opacity-0 group-hover:opacity-100 transition inline-flex items-center justify-center z-10"
          aria-label="Eliminar tarea"
          title="Eliminar tarea"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {/* Confirm overlay inline */}
      {confirmDelete && onDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 rounded-[10px] bg-bg-base/95 backdrop-blur-sm flex flex-col items-center justify-center p-3 z-20 gap-2"
        >
          <div className="text-[11px] text-text-primary text-center font-medium">¿Eliminar "{task.title.slice(0, 40)}{task.title.length > 40 ? '…' : ''}"?</div>
          <div className="text-[10px] text-text-muted text-center">No se puede deshacer</div>
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
              className="text-[11px] px-2 py-1 rounded-md border border-border-subtle text-text-secondary hover:bg-bg-elevated"
            >Cancelar</button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); toast.success('Tarea eliminada'); }}
              className="text-[11px] px-2 py-1 rounded-md bg-status-danger text-white hover:brightness-110"
            >Eliminar</button>
          </div>
        </div>
      )}
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
          className="flex items-center gap-1"
          style={{
            color:
              task.isDelayed && task.status !== 'completed'
                ? '#EF4444'
                : hoursUntil >= 0 && hoursUntil <= 72
                ? hoursUntil <= 24 ? '#EF4444' : '#F59E0B'
                : task.status !== 'completed' ? '#10B981' : 'var(--text-muted)',
          }}
        >
          <Clock className="h-3 w-3" />
          {task.isDelayed && task.status !== 'completed'
            ? `+${task.delayDays}d vencida`
            : formatRelative(task.dueDate)}
        </span>
        {(task.subtasks?.length ?? 0) > 0 && (
          <span className="text-text-muted text-[10px]" title="Subtareas">
            ☑ {task.subtasks!.filter((s) => s.done).length}/{task.subtasks!.length}
          </span>
        )}
        {(task.comments?.length ?? 0) > 0 && (
          <span className="text-text-muted text-[10px]" title="Comentarios">
            💬 {task.comments!.length}
          </span>
        )}
        <span
          className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
          title={task.assignedTo}
        >
          {task.assignedTo[0]?.toUpperCase() ?? '?'}
        </span>
      </div>

      {/* I/O + dependencias badges */}
      {(task.input || task.output || task.driveLink || (task.dependsOn?.length ?? 0) > 0 || dependentsCount > 0) && (
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
          {task.driveLink && (
            <a
              href={task.driveLink}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Abrir entregable: ${task.driveLink}`}
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] hover:underline"
              style={{ background: 'rgba(34,197,94,0.10)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <FolderOpen className="h-2.5 w-2.5" /> Drive
            </a>
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
    </motion.div>
  );
}

/* ───────────────────────── Modal ───────────────────────── */

function TaskModal({
  task, accent, onClose, onSave, onDelete, allTasks, clientId,
}: {
  task?: Task;
  accent: string;
  onClose: () => void;
  onSave: (patch: Partial<Task>) => void;
  onDelete?: () => void;
  allTasks: Task[];
  clientId: string;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'P2');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '');

  // Opciones del Responsable = team del cliente + roles
  const teamAssignments = useTeamStore((s) => s.assignments).filter((a) => a.clientId === clientId);
  const responsibleOptions = useMemo(() => {
    const teamOpts = teamAssignments.map((a) => {
      const role = ROLE_DEFS.find((r) => r.slug === a.roleSlug);
      return { value: a.memberName, label: `👤 ${a.memberName} · ${role?.title ?? a.roleSlug}` };
    });
    const roleOpts = ROLE_DEFS.map((r) => ({ value: r.slug, label: `🏷️ Por rol: ${r.title}` }));
    return [
      { value: '', label: '— Sin asignar —' },
      ...teamOpts,
      ...roleOpts,
    ];
  }, [teamAssignments]);

  // Si assignedTo viene como slug, mostrar título legible. Si viene como
  // nombre que no está en team, igualmente sale en el select como custom.
  const assignedToOption = useMemo(() => {
    if (!assignedTo) return '';
    // Existe como miembro o como rol
    if (responsibleOptions.some((o) => o.value === assignedTo)) return assignedTo;
    // Valor custom (nombre escrito a mano) — agrégalo dinámicamente
    return assignedTo;
  }, [assignedTo, responsibleOptions]);
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 16) : new Date().toISOString().slice(0, 16),
  );
  const [moduleTag, setModuleTag] = useState(task?.moduleTag ?? '');
  const [tag, setTag] = useState<string>(task?.tag ?? '');
  const [input, setInput] = useState(task?.input ?? '');
  const [output, setOutput] = useState(task?.output ?? '');
  const [driveLink, setDriveLink] = useState(task?.driveLink ?? '');
  const [dependsOn, setDependsOn] = useState<string[]>(task?.dependsOn ?? []);
  const [showDepsEditor, setShowDepsEditor] = useState((task?.dependsOn?.length ?? 0) > 0);
  const [subtasks, setSubtasks] = useState(task?.subtasks ?? []);
  const [comments, setComments] = useState(task?.comments ?? []);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const dependents = task ? allTasks.filter((t) => t.dependsOn?.includes(task.id)) : [];

  const addSubtask = () => {
    if (!newSubtask.trim() || subtasks.length >= 5) return;
    setSubtasks([...subtasks, { id: genId(), title: newSubtask.trim(), done: false }]);
    setNewSubtask('');
  };
  const toggleSubtask = (id: string) => setSubtasks(subtasks.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  const removeSubtask = (id: string) => setSubtasks(subtasks.filter((s) => s.id !== id));
  const addComment = () => {
    if (!newComment.trim()) return;
    setComments([...comments, { id: genId(), author: 'Yo', text: newComment.trim(), createdAt: new Date().toISOString() }]);
    setNewComment('');
  };

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
                tag: (tag || undefined) as Task['tag'],
                input: input || undefined,
                output: output || undefined,
                driveLink: driveLink.trim() || undefined,
                dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
                subtasks,
                comments,
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
          <div>
            <Select
              label="Responsable"
              value={assignedToOption}
              onChange={(e) => setAssignedTo(e.target.value)}
              options={
                assignedTo && !responsibleOptions.some((o) => o.value === assignedTo)
                  ? [{ value: assignedTo, label: `👤 ${assignedTo} (custom)` }, ...responsibleOptions]
                  : responsibleOptions
              }
            />
            <div className="text-[10px] text-text-muted mt-1">
              Elige un miembro del team o un rol. El nombre se muestra en la tarea.
            </div>
          </div>
          <Input
            label="Vencimiento"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Etiqueta"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            options={[
              { value: '', label: '— Sin etiqueta —' },
              ...Object.entries(TASK_TAG_LABEL).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <Input
            label="Tag libre (opcional)"
            value={moduleTag}
            onChange={(e) => setModuleTag(e.target.value)}
            placeholder="ej: q4-launch"
          />
        </div>

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
          <Input
            label="Link de Drive / repositorio"
            type="url"
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="https://drive.google.com/…"
          />
        </div>

        <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Dependencias {dependsOn.length > 0 && <span className="text-text-muted">({dependsOn.length})</span>}
              </label>
              {!showDepsEditor && (
                <button
                  type="button"
                  onClick={() => setShowDepsEditor(true)}
                  className="text-[11px] text-accent-violet hover:underline"
                >
                  + Configurar dependencias
                </button>
              )}
              {showDepsEditor && dependsOn.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setDependsOn([]); }}
                  className="text-[11px] text-status-danger hover:underline"
                >
                  Limpiar selección
                </button>
              )}
            </div>
            {!showDepsEditor && dependsOn.length === 0 ? (
              <div className="text-xs text-text-muted italic px-2 py-2">Sin dependencias — esta tarea es independiente.</div>
            ) : (
              <>
                <div className="space-y-1 mb-2 max-h-[180px] overflow-y-auto pr-1">
                  {allTasks.filter((t) => t.id !== task?.id).map((t) => {
                    const checked = dependsOn.includes(t.id);
                    return (
                      <label key={t.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer text-xs ${checked ? 'border-accent-violet/40 bg-accent-violet/10' : 'border-border-subtle bg-bg-surface hover:bg-bg-hover'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setDependsOn(checked ? dependsOn.filter((id) => id !== t.id) : [...dependsOn, t.id])}
                          className="h-3.5 w-3.5 accent-accent-violet"
                        />
                        <span className="text-text-muted font-semibold">{t.priority}</span>
                        <span className="text-text-primary truncate flex-1">{t.title}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="text-[10px] text-text-muted">Marca solo las tareas que deben completarse antes que esta.</div>
              </>
            )}
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

        {/* Subtareas */}
        <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">Subtareas ({subtasks.length}/5)</label>
            {subtasks.length > 0 && (
              <span className="text-[10px] text-text-muted">
                {subtasks.filter((s) => s.done).length}/{subtasks.length} hechas
              </span>
            )}
          </div>
          {subtasks.map((s) => (
            <div key={s.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => toggleSubtask(s.id)}
                className="h-3.5 w-3.5 accent-accent-violet shrink-0"
              />
              <span className={cn('flex-1 text-xs', s.done && 'line-through text-text-muted')}>{s.title}</span>
              <button
                onClick={() => removeSubtask(s.id)}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-danger transition"
                aria-label="Eliminar subtarea"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {subtasks.length < 5 && (
            <div className="flex gap-2">
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                placeholder="Nueva subtarea…"
                className="flex-1 bg-bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-violet/60"
              />
              <button
                onClick={addSubtask}
                disabled={!newSubtask.trim()}
                className="px-2 py-1 rounded-md bg-accent-violet/15 text-accent-violet text-xs hover:bg-accent-violet/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Agregar
              </button>
            </div>
          )}
        </div>

        {/* Comentarios */}
        {task && (
          <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-2">
            <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Comentarios ({comments.length})
            </label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {comments.length === 0 ? (
                <div className="text-[11px] text-text-muted italic py-2">Sin comentarios aún.</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-md border border-border-subtle bg-bg-surface p-2">
                    <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                      <span className="font-semibold text-text-secondary">{c.author}</span>
                      <span>{formatRelative(c.createdAt)}</span>
                    </div>
                    <div className="text-xs text-text-primary whitespace-pre-wrap">{c.text}</div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                placeholder="Escribe un comentario…"
                className="flex-1 bg-bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-violet/60"
              />
              <button
                onClick={addComment}
                disabled={!newComment.trim()}
                className="px-2 py-1 rounded-md bg-accent-violet/15 text-accent-violet text-xs hover:bg-accent-violet/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ───────────────────────── Vista Lista ───────────────────────── */

function TasksList({
  tasks, allTasks, onOpen,
}: {
  tasks: Task[];
  accent?: string;
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
  tasks, accent, onOpen,
}: {
  tasks: Task[];
  accent: string;
  allTasks?: Task[];
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

/* ───────────────────────── Bulk Actions Bar ───────────────────────── */

function BulkActionsBar({
  count, accent, onMove, onDelete, onCancel,
}: {
  count: number;
  accent: string;
  onMove: (status: TaskStatus) => void;
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
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ background: withAlpha(accent, 0.18), color: accent }}
        >
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
            {COLUMNS.map((c) => (
              <button
                key={c.status}
                onClick={() => { onMove(c.status); setMoveOpen(false); }}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-bg-elevated transition inline-flex items-center gap-2"
              >
                <Badge tone={c.tone}>{c.label}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        className="text-xs px-3 py-1.5 rounded-md hover:bg-status-danger/10 transition inline-flex items-center gap-1.5 text-status-danger"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar
      </button>

      <button
        onClick={onCancel}
        className="text-xs px-3 py-1.5 rounded-md hover:bg-bg-elevated transition text-text-muted"
      >
        Cancelar
      </button>
    </motion.div>
  );
}
