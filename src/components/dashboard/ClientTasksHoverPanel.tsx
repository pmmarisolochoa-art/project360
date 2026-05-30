import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useClientStore } from '@/store/useClientStore';
import { Badge } from '@/components/ui/Badge';
import { formatRelative } from '@/utils/dateHelpers';
import { withAlpha } from '@/utils/colorGenerator';
import type { TaskPriority } from '@/types/task';
import { cn } from '@/utils/cn';

const PRIORITY_RANK: Record<TaskPriority, number> = { P1: 0, P2: 1, P3: 2 };
const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'warning' | 'subtle'> = {
  P1: 'danger',
  P2: 'warning',
  P3: 'subtle',
};

interface Props {
  clientId: string;
  accent: string;
  open: boolean;
}

/**
 * Popover lateral derecho que aparece al hover sobre una ClientCard.
 * Muestra hasta 3 tareas pendientes ordenadas por prioridad y fecha.
 * Se renderiza como hermano del article para no quedar atrapado por
 * el `overflow-hidden` de la card.
 */
export function ClientTasksHoverPanel({ clientId, accent, open }: Props) {
  const navigate = useNavigate();
  const allTasks = useClientStore((s) => s.tasks);

  // IMPORTANTE: el selector debe ser estable. Filtramos con useMemo, no en el selector.
  const tasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.clientId === clientId && t.status !== 'completed')
        .sort((a, b) => {
          const dp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          if (dp !== 0) return dp;
          return +new Date(a.dueDate) - +new Date(b.dueDate);
        }),
    [allTasks, clientId],
  );

  const top3 = tasks.slice(0, 3);
  const overflow = tasks.length - top3.length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'absolute left-full top-0 ml-3 w-72 z-30 rounded-[14px] border',
            !open && 'pointer-events-none',
          )}
          style={{
            background: 'var(--popover-bg)',
            borderColor: withAlpha(accent, 0.3),
            boxShadow: 'var(--popover-shadow)',
            color: 'var(--popover-text)',
          }}
        >
          <header
            className="px-3 py-2 border-b border-border-subtle text-[10px] uppercase tracking-wider"
            style={{ color: accent }}
          >
            📋 Tareas pendientes
          </header>

          {top3.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-secondary">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-status-success" />
              ✅ Sin tareas pendientes
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle/40">
              {top3.map((t) => (
                <li key={t.id} className="px-3 py-2">
                  <div className="flex items-start gap-2">
                    <Badge tone={PRIORITY_TONE[t.priority]} className="shrink-0">{t.priority}</Badge>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-xs font-medium leading-snug line-clamp-2"
                        style={{ color: 'var(--popover-text)' }}
                      >
                        {t.title}
                      </div>
                      <div
                        className="text-[10px] mt-1"
                        style={{ color: 'var(--popover-text-muted)' }}
                      >
                        {formatRelative(t.dueDate)}
                        {t.assignedTo && <> · {t.assignedTo}</>}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {(overflow > 0 || top3.length > 0) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/client/${clientId}/tasks`);
              }}
              className="w-full px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-bg-elevated border-t border-border-subtle text-center transition"
              style={{ color: overflow > 0 ? accent : undefined }}
            >
              {overflow > 0 ? `+${overflow} tareas más → Ver todas` : 'Ver todas las tareas'}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

