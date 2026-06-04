import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, CheckCircle2, AlertTriangle, User, Clock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { genId } from '@/utils/id';
import { toast } from '@/store/useToastStore';
import { resolveAssignee, resolveRoleLabel } from '@/utils/roleResolver';
import type { Funnel, FunnelPhase } from '@/types/funnel';
import type { Task } from '@/types/task';
import { useClientStore } from '@/store/useClientStore';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { Badge } from '@/components/ui/Badge';

type PhaseHealth = 'completed' | 'active' | 'pending' | 'delayed';

/**
 * Roadmap visual del embudo: timeline horizontal con fases, día actual,
 * cuenta regresiva al evento principal y panel expandible de tareas por fase.
 *
 * Si simplified=true (portal cliente), oculta detalle de responsables y
 * cuenta regresiva muestra solo % avance + fase activa.
 */
export function FunnelRoadmap({
  funnel,
  simplified = false,
  onOpenTask,
  accent = '#8B5CF6',
}: {
  funnel: Funnel;
  simplified?: boolean;
  onOpenTask?: (taskId: string) => void;
  accent?: string;
}) {
  // Mismo anti-pattern Zustand: filtrar en el selector dispara loop.
  const allPhases = useFunnelLaunchStore((s) => s.phases);
  const phases = useMemo(
    () => allPhases.filter((p) => p.funnelId === funnel.id).sort((a, b) => a.order - b.order),
    [allPhases, funnel.id],
  );
  const allTasks = useClientStore((s) => s.tasks);
  const tasks = useMemo(() => allTasks.filter((t) => t.funnelId === funnel.id), [allTasks, funnel.id]);
  const addTask = useClientStore((s) => s.addTask);
  const deleteTask = useClientStore((s) => s.deleteTask);

  const [expandedPhase, setExpandedPhase] = useState<string | null>(phases[0]?.id ?? null);

  const startDate = parseISO(funnel.startDate);
  const today = new Date();
  const daysSinceStart = differenceInDays(today, startDate);

  // Cálculo de salud por fase.
  const phaseHealthMap = useMemo(() => {
    const map = new Map<string, { health: PhaseHealth; total: number; done: number }>();
    for (const phase of phases) {
      const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
      const done = phaseTasks.filter((t) => t.status === 'completed').length;
      const total = phaseTasks.length;
      const phaseEnded = daysSinceStart > phase.dayEnd;
      const phaseStarted = daysSinceStart >= phase.dayStart;

      let health: PhaseHealth;
      if (total > 0 && done === total) {
        health = 'completed';
      } else if (phaseStarted && !phaseEnded) {
        // Fase activa: si hay tareas vencidas y no completadas, delayed
        const hasOverdue = phaseTasks.some((t) => t.isDelayed && t.status !== 'completed');
        health = hasOverdue ? 'delayed' : 'active';
      } else if (phaseEnded && done < total) {
        health = 'delayed';
      } else {
        health = 'pending';
      }
      map.set(phase.id, { health, total, done });
    }
    return map;
  }, [phases, tasks, daysSinceStart]);

  // Progreso global del embudo.
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'completed').length;
  const progressPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  // Cuenta regresiva al evento principal o cierre.
  const targetDate = funnel.eventDate ? parseISO(funnel.eventDate) : funnel.endDate ? parseISO(funnel.endDate) : null;
  const daysToTarget = targetDate ? differenceInDays(targetDate, today) : null;
  const targetLabel = funnel.eventDate ? 'Evento principal' : 'Cierre del embudo';

  return (
    <div className="space-y-5">
      {/* Header */}
      <FunnelHeader
        funnel={funnel}
        progressPct={progressPct}
        daysToTarget={daysToTarget}
        targetLabel={targetLabel}
        simplified={simplified}
        accent={accent}
      />

      {/* Timeline horizontal */}
      <Timeline
        phases={phases}
        healthMap={phaseHealthMap}
        daysSinceStart={daysSinceStart}
        expandedPhase={expandedPhase}
        onSelectPhase={(id) => setExpandedPhase(expandedPhase === id ? null : id)}
      />

      {/* Panel de tareas de la fase expandida (oculto en simplified) */}
      {!simplified && expandedPhase && (() => {
        // Defensa: si el expandedPhase quedó apuntando a una fase de otro
        // funnel (al cambiar de tab sin remontaje), simplemente no rendereamos.
        const expanded = phases.find((p) => p.id === expandedPhase);
        if (!expanded) return null;
        return (
          <AnimatePresence mode="wait">
            <motion.div
              key={expandedPhase}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <PhaseTasksPanel
                phase={expanded}
                tasks={tasks.filter((t) => t.phaseId === expandedPhase)}
                clientId={funnel.clientId}
                funnelId={funnel.id}
                funnelStartDate={funnel.startDate}
                onOpenTask={onOpenTask}
                onAddTask={(task) => addTask(task)}
                onDeleteTask={(taskId) => {
                  if (confirm('¿Eliminar esta tarea? No se puede deshacer.')) {
                    deleteTask(taskId);
                    toast.success('Tarea eliminada');
                  }
                }}
              />
            </motion.div>
          </AnimatePresence>
        );
      })()}

      {simplified && (
        <SimplifiedPhasesView phases={phases} healthMap={phaseHealthMap} progressPct={progressPct} />
      )}
    </div>
  );
}

function FunnelHeader({
  funnel, progressPct, daysToTarget, targetLabel, simplified, accent,
}: {
  funnel: Funnel;
  progressPct: number;
  daysToTarget: number | null;
  targetLabel: string;
  simplified: boolean;
  accent: string;
}) {
  const urgent = daysToTarget !== null && daysToTarget >= 0 && daysToTarget < 7;
  return (
    <div className="surface p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Embudo de lanzamiento</div>
          <h3 className="heading text-lg font-bold">{funnel.name}</h3>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-text-secondary">
            <Calendar className="h-3 w-3" />
            <span>Inicio: {format(parseISO(funnel.startDate), "d MMM yyyy", { locale: es })}</span>
            {funnel.endDate && (
              <>
                <span className="text-text-muted">→</span>
                <span>{format(parseISO(funnel.endDate), "d MMM yyyy", { locale: es })}</span>
              </>
            )}
          </div>
        </div>
        {daysToTarget !== null && (
          <div className={`text-right ${urgent ? 'text-status-danger' : 'text-text-primary'}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-70">{targetLabel}</div>
            <div className={`text-2xl font-bold ${urgent ? 'animate-pulse' : ''}`}>
              {daysToTarget >= 0 ? `${daysToTarget}d` : `Hace ${Math.abs(daysToTarget)}d`}
            </div>
            <div className="text-[10px] opacity-70">{daysToTarget >= 0 ? 'restantes' : 'pasado'}</div>
          </div>
        )}
      </div>

      {/* Barra de progreso global */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-text-muted">Avance global</span>
          <span className="font-semibold text-text-primary">{progressPct}%</span>
        </div>
        <div className="h-2 bg-bg-base rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6 }}
            className="h-full"
            style={{ background: accent }}
          />
        </div>
      </div>

      {!simplified && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={funnel.status === 'active' ? 'success' : funnel.status === 'completed' ? 'neutral' : 'warning'}>
            {funnel.status}
          </Badge>
          <Badge tone="neutral">{funnel.templateKey.replace(/_/g, ' ')}</Badge>
        </div>
      )}
    </div>
  );
}

function Timeline({
  phases, healthMap, daysSinceStart, expandedPhase, onSelectPhase,
}: {
  phases: FunnelPhase[];
  healthMap: Map<string, { health: PhaseHealth; total: number; done: number }>;
  daysSinceStart: number;
  expandedPhase: string | null;
  onSelectPhase: (id: string) => void;
}) {
  if (phases.length === 0) return null;
  const maxDay = Math.max(...phases.map((p) => p.dayEnd));
  const todayPct = Math.max(0, Math.min(100, (daysSinceStart / maxDay) * 100));

  const HEALTH_STYLE: Record<PhaseHealth, { bg: string; border: string; label: string }> = {
    completed: { bg: 'bg-status-success/15', border: 'border-status-success/50', label: 'Completada' },
    active: { bg: 'bg-accent-violet/15', border: 'border-accent-violet/50', label: 'Activa' },
    pending: { bg: 'bg-bg-elevated', border: 'border-border-subtle', label: 'Pendiente' },
    delayed: { bg: 'bg-status-danger/15', border: 'border-status-danger/50', label: 'Retrasada' },
  };

  return (
    <div className="surface p-5 space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">Timeline del embudo</div>

      {/* Cards de fase */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {phases.map((phase, i) => {
          const data = healthMap.get(phase.id) ?? { health: 'pending' as PhaseHealth, total: 0, done: 0 };
          const style = HEALTH_STYLE[data.health];
          const isExpanded = expandedPhase === phase.id;
          return (
            <motion.button
              key={phase.id}
              onClick={() => onSelectPhase(phase.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`text-left rounded-[10px] border-2 ${style.border} ${style.bg} p-3 transition hover:brightness-110 ${isExpanded ? 'ring-2 ring-accent-violet/40' : ''}`}
              style={{ borderTopColor: phase.color, borderTopWidth: 3 }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase tracking-wider font-bold opacity-70" style={{ color: phase.color }}>
                  Fase {String(phase.order).padStart(2, '0')}
                </div>
                {data.health === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />}
                {data.health === 'delayed' && <AlertTriangle className="h-3.5 w-3.5 text-status-danger" />}
              </div>
              <div className="text-sm font-bold text-text-primary leading-tight line-clamp-2">{phase.name.replace(/^FASE \d+\s*[—-]\s*/, '')}</div>
              <div className="text-[10px] text-text-muted mt-1">Días {phase.dayStart}-{phase.dayEnd}</div>
              <div className="text-[11px] text-text-secondary mt-1.5">
                <strong>{data.done}/{data.total}</strong> tareas · <span className="opacity-70">{style.label}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Barra temporal con marcador de "hoy" */}
      <div className="relative h-2 bg-bg-base rounded-full mt-3">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-violet/40 to-accent-pink/40 rounded-full" style={{ width: `${todayPct}%` }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-accent-violet ring-2 ring-bg-surface"
          style={{ left: `calc(${todayPct}% - 6px)` }}
          title={`Hoy — día ${daysSinceStart}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>Día 1</span>
        <span>Hoy · día {daysSinceStart}</span>
        <span>Día {maxDay}</span>
      </div>
    </div>
  );
}

function PhaseTasksPanel({
  phase, tasks, clientId, funnelId, funnelStartDate, onOpenTask, onAddTask, onDeleteTask,
}: {
  phase: FunnelPhase;
  tasks: Task[];
  clientId: string;
  funnelId: string;
  funnelStartDate: string;
  onOpenTask?: (taskId: string) => void;
  onAddTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');

  const sorted = [...tasks].sort((a, b) => {
    const pri: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
    const dp = (pri[a.priority] ?? 3) - (pri[b.priority] ?? 3);
    if (dp !== 0) return dp;
    return +new Date(a.dueDate) - +new Date(b.dueDate);
  });

  const handleAdd = () => {
    if (!newTitle.trim()) {
      toast.error('Escribe el título de la tarea');
      return;
    }
    // dueDate = a la mitad del rango de la fase
    const startMs = parseISO(funnelStartDate).getTime();
    const midDay = Math.round((phase.dayStart + phase.dayEnd) / 2);
    const dueDate = new Date(startMs + midDay * 86400000);
    dueDate.setHours(10, 0, 0, 0);
    const task: Task = {
      id: genId(),
      clientId,
      title: newTitle.trim(),
      status: 'pending',
      priority: 'P2',
      assignedTo: newAssignee.trim() || 'Sin asignar',
      dueDate: dueDate.toISOString(),
      startDate: new Date(startMs + phase.dayStart * 86400000).toISOString(),
      isDelayed: false,
      delayDays: 0,
      moduleTag: 'funnel',
      tag: 'strategy',
      funnelId,
      phaseId: phase.id,
      createdAt: new Date().toISOString(),
    };
    onAddTask?.(task);
    toast.success('Tarea creada');
    setNewTitle('');
    setNewAssignee('');
    setShowAddForm(false);
  };

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: phase.color }} />
          <h4 className="heading text-sm font-bold">{phase.name}</h4>
          <span className="text-[11px] text-text-muted">· {tasks.length} tareas</span>
        </div>
        {onAddTask && !showAddForm && (
          <Button size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddForm(true)}>
            Agregar tarea
          </Button>
        )}
      </div>

      {/* Form inline para agregar tarea */}
      {showAddForm && (
        <div className="rounded-[10px] border border-accent-violet/40 bg-accent-violet/5 p-3 mb-3 space-y-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título de la tarea…"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <Input
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            placeholder="Responsable (opcional)"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewTitle(''); setNewAssignee(''); }}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd}>Crear tarea</Button>
          </div>
        </div>
      )}

      {tasks.length === 0 && !showAddForm ? (
        <div className="text-sm text-text-muted text-center py-4 italic">
          Esta fase aún no tiene tareas. Agrega la primera con el botón de arriba.
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onOpen={() => onOpenTask?.(t.id)}
              onDelete={onDeleteTask ? () => onDeleteTask(t.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onOpen, onDelete }: { task: Task; onOpen?: () => void; onDelete?: () => void }) {
  const assigneeName = resolveAssignee(task.assignedTo, task.clientId);
  const roleLabel = resolveRoleLabel(task.assignedTo, task.clientId);
  const today = new Date();
  const due = parseISO(task.dueDate);
  const daysToDue = differenceInDays(due, today);
  const overdue = task.isDelayed && task.status !== 'completed';
  const dueColor = task.status === 'completed' ? 'text-text-muted' : overdue ? 'text-status-danger' : daysToDue <= 1 ? 'text-status-warning' : 'text-text-secondary';

  const priorityTone = task.priority === 'P1' ? 'danger' : task.priority === 'P2' ? 'warning' : 'neutral';

  return (
    <div className="group w-full rounded-md border border-border-subtle bg-bg-base/30 hover:bg-bg-elevated/40 p-2.5 transition flex items-center gap-3">
      <div className={`h-4 w-4 rounded border ${task.status === 'completed' ? 'bg-status-success border-status-success' : 'border-border-default'} flex items-center justify-center shrink-0`}>
        {task.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-white" />}
      </div>
      <Badge tone={priorityTone}>{task.priority}</Badge>
      <button onClick={onOpen} className="flex-1 text-left">
        <span className={`text-xs ${task.status === 'completed' ? 'line-through text-text-muted' : 'text-text-primary'} truncate block`}>{task.title}</span>
      </button>
      <span className="text-[11px] text-text-secondary inline-flex items-center gap-1 shrink-0">
        <User className="h-3 w-3" />
        <span>{assigneeName}</span>
        {roleLabel && roleLabel !== assigneeName && (
          <span className="text-text-muted">· {roleLabel}</span>
        )}
      </span>
      <span className={`text-[11px] inline-flex items-center gap-1 shrink-0 ${dueColor}`}>
        <Clock className="h-3 w-3" />
        {overdue ? `Vencida ${task.delayDays}d` : daysToDue === 0 ? 'Hoy' : daysToDue > 0 ? `+${daysToDue}d` : ''}
      </span>
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label="Eliminar tarea"
          className="text-text-muted hover:text-status-danger opacity-0 group-hover:opacity-100 transition shrink-0"
          title="Eliminar tarea"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SimplifiedPhasesView({
  phases, healthMap, progressPct,
}: {
  phases: FunnelPhase[];
  healthMap: Map<string, { health: PhaseHealth; total: number; done: number }>;
  progressPct: number;
}) {
  const activePhase = phases.find((p) => healthMap.get(p.id)?.health === 'active');
  return (
    <div className="surface p-5">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-3">Estado de tu lanzamiento</div>
      {activePhase && (
        <div className="text-sm text-text-primary mb-3">
          Tu lanzamiento va en <strong style={{ color: activePhase.color }}>{activePhase.name}</strong>
        </div>
      )}
      <div className="space-y-2">
        {phases.map((p) => {
          const data = healthMap.get(p.id);
          const pct = data && data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
          return (
            <div key={p.id} className="rounded-md border border-border-subtle p-2.5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-text-primary">{p.name.replace(/^FASE \d+\s*[—-]\s*/, '')}</span>
                <span className="text-text-muted">{pct}%</span>
              </div>
              <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
                <div className="h-full" style={{ width: `${pct}%`, background: p.color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[11px] text-text-muted text-center">
        Avance total: <strong className="text-text-primary">{progressPct}%</strong>
      </div>
    </div>
  );
}
