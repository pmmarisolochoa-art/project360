import { estaVencida, diasDeAtraso } from '@/utils/vencidas';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListChecks, ArrowRight, Check } from 'lucide-react';
import { isSameDay, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useClientStore } from '@/store/useClientStore';
import { Badge } from '@/components/ui/Badge';
import { withAlpha } from '@/utils/colorGenerator';
import type { Task, TaskPriority } from '@/types/task';
import { cn } from '@/utils/cn';

const PRIORITY_RANK: Record<TaskPriority, number> = { P1: 0, P2: 1, P3: 2 };
const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'warning' | 'subtle'> = {
  P1: 'danger', P2: 'warning', P3: 'subtle',
};

export function TodayTasks() {
  const navigate = useNavigate();
  const allTasks = useClientStore((s) => s.tasks);
  const clients = useClientStore((s) => s.clients);
  const updateTask = useClientStore((s) => s.updateTask);
  const [expanded, setExpanded] = useState(false);

  const tasks = useMemo(() => {
    const today = new Date();
    return allTasks
      .filter((t) => t.status !== 'completed' && (estaVencida(t) || isSameDay(parseISO(t.dueDate), today)))
      .sort((a, b) => {
        const dp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (dp !== 0) return dp;
        return +new Date(a.dueDate) - +new Date(b.dueDate);
      });
  }, [allTasks]);

  const visible = expanded ? tasks : tasks.slice(0, 8);
  const todayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const todayCap = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  return (
    <section className="surface p-5">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-3">
          <h2 className="heading text-lg font-bold flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Tareas para hoy
          </h2>
          <Badge tone={tasks.length > 0 ? 'danger' : 'success'}>{tasks.length}</Badge>
          <span className="text-xs text-text-muted">{todayCap}</span>
        </div>
        <Link to="/tareas" className="text-xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1">
          Ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      {tasks.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border-default p-8 text-center text-sm text-text-muted">
          🎯 Todo al día — no hay tareas pendientes para hoy
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map((t) => (
              <TodayRow
                key={t.id}
                task={t}
                client={clients.find((c) => c.id === t.clientId)}
                onToggle={() => updateTask(t.id, { status: 'completed', completedAt: new Date().toISOString() })}
                onOpen={() => navigate(`/client/${t.clientId}/tasks`)}
              />
            ))}
          </ul>
          {tasks.length > 8 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 w-full text-xs text-text-secondary hover:text-text-primary text-center py-2"
            >
              {expanded ? 'Ocultar' : `Ver ${tasks.length - 8} más`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function TodayRow({
  task, client, onToggle, onOpen,
}: {
  task: Task;
  client?: ReturnType<typeof useClientStore.getState>['clients'][number];
  onToggle: () => void;
  onOpen: () => void;
}) {
  const overdue = estaVencida(task);
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-2.5 hover:bg-bg-elevated/40 transition"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          aria-label="Marcar como completada"
          className="shrink-0 h-5 w-5 rounded-md border border-border-default bg-bg-base hover:border-status-success/60 inline-flex items-center justify-center transition"
        >
          <Check className="h-3 w-3 text-status-success opacity-0 hover:opacity-100" />
        </button>
        <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
        <button
          onClick={onOpen}
          className="flex-1 min-w-0 text-left text-sm text-text-primary hover:text-accent-violet truncate"
        >
          {task.title}
        </button>
        {client && (
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
            style={{
              background: withAlpha(client.primaryColor, 0.15),
              color: client.primaryColor,
              border: `1px solid ${withAlpha(client.primaryColor, 0.3)}`,
            }}
          >
            {client.name}
          </span>
        )}
      </div>
      <div className="mt-1 ml-12 flex items-center gap-2 text-[11px] text-text-muted">
        <span>👤 {task.assignedTo}</span>
        <span className={cn(overdue ? 'text-status-danger' : 'text-status-success')}>
          {overdue ? `Vencida hace ${diasDeAtraso(task)} día${diasDeAtraso(task) === 1 ? '' : 's'}` : 'Vence: Hoy'}
        </span>
      </div>
    </motion.li>
  );
}
