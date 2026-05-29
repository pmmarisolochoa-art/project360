import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useClientStore } from '@/store/useClientStore';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import type { TaskPriority, TaskStatus } from '@/types/task';

const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'warning' | 'neutral'> = {
  P1: 'danger', P2: 'warning', P3: 'neutral',
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendiente', in_progress: 'En progreso', in_review: 'Revisión', completed: 'Completada', blocked: 'Bloqueada',
};

export function AllTasksPage() {
  const navigate = useNavigate();
  const tasks = useClientStore((s) => s.tasks);
  const clients = useClientStore((s) => s.clients);
  const [fClient, setFClient] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fStatus, setFStatus] = useState('');

  const filtered = useMemo(
    () => tasks
      .filter((t) => (!fClient || t.clientId === fClient) && (!fPriority || t.priority === fPriority) && (!fStatus || t.status === fStatus))
      .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate)),
    [tasks, fClient, fPriority, fStatus],
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Vista global</div>
        <h1 className="heading text-3xl font-bold gradient-text">Todas las tareas</h1>
        <p className="text-sm text-text-secondary mt-1">Tareas de todos los clientes con filtros</p>
      </header>

      <div className="surface p-3 flex gap-2 flex-wrap">
        <Select value={fClient} onChange={(e) => setFClient(e.target.value)} className="min-w-[200px]"
          options={[{ value: '', label: 'Todos los clientes' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className="min-w-[160px]"
          options={[{ value: '', label: 'Todas las prioridades' }, { value: 'P1', label: 'P1' }, { value: 'P2', label: 'P2' }, { value: 'P3', label: 'P3' }]} />
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="min-w-[180px]"
          options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))]} />
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted border-b border-border-default bg-bg-elevated/40">
              <th className="py-2 pl-3 pr-3">Prioridad</th>
              <th className="py-2 pr-3">Tarea</th>
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">Responsable</th>
              <th className="py-2 pr-3">Vence</th>
              <th className="py-2 pr-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-text-muted">Sin tareas con esos filtros.</td></tr>
            ) : filtered.map((t) => {
              const c = clients.find((x) => x.id === t.clientId);
              return (
                <tr key={t.id} onClick={() => navigate(`/client/${t.clientId}/tasks`)}
                  className="border-b border-border-subtle/30 cursor-pointer hover:bg-bg-elevated/20">
                  <td className="py-2.5 pl-3 pr-3"><Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge></td>
                  <td className="py-2.5 pr-3 text-text-primary">{t.title}</td>
                  <td className="py-2.5 pr-3">
                    {c && (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.primaryColor }} />
                        {c.name}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-text-secondary">{t.assignedTo}</td>
                  <td className="py-2.5 pr-3 text-xs" style={t.isDelayed && t.status !== 'completed' ? { color: '#EF4444' } : undefined}>
                    {format(parseISO(t.dueDate), 'd MMM yyyy', { locale: es })}
                    {t.isDelayed && t.status !== 'completed' && ` · vencida ${t.delayDays}d`}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-text-secondary">{STATUS_LABEL[t.status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-text-muted">
        {filtered.length} tarea{filtered.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}
