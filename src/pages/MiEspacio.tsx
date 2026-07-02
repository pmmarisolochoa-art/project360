import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FolderUp, Calendar, Users, TrendingUp, ExternalLink } from 'lucide-react';
import { differenceInCalendarDays, isToday, isTomorrow, isPast } from 'date-fns';
import { useAuthStore } from '@/store/useAuthStore';
import { useClientStore } from '@/store/useClientStore';
import { TaskLinksRepo, type TaskLink } from '@/services/taskLinks';
import { DeliverableDrawer } from '@/components/member/DeliverableDrawer';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/useToastStore';
import { cn } from '@/utils/cn';
import { withAlpha } from '@/utils/colorGenerator';
import type { Task } from '@/types/task';

function greetingPrefix(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function MiEspacio() {
  const navigate = useNavigate();
  const accesses = useAuthStore((s) => s.clientAccesses);
  const userId = useAuthStore((s) => s.user?.id);
  const clients = useClientStore((s) => s.clients);
  const allTasks = useClientStore((s) => s.tasks);
  const updateTask = useClientStore((s) => s.updateTask);

  const [links, setLinks] = useState<TaskLink[]>([]);
  const [deliverableTask, setDeliverableTask] = useState<Task | null>(null);

  const myClientIds = useMemo(() => accesses.map((a) => a.clientId), [accesses]);
  const myNames = useMemo(
    () => new Set(accesses.map((a) => a.nombre.trim().toLowerCase()).filter(Boolean)),
    [accesses],
  );
  const firstName = (accesses[0]?.nombre || '').split(' ')[0] || '';

  const myClients = useMemo(
    () => clients.filter((c) => myClientIds.includes(c.id)),
    [clients, myClientIds],
  );
  const clientById = useMemo(() => Object.fromEntries(myClients.map((c) => [c.id, c])), [myClients]);

  // Mis tareas = de mis clientes, asignadas a mi nombre.
  const myTasks = useMemo(
    () =>
      allTasks.filter(
        (t) => myClientIds.includes(t.clientId) && myNames.has((t.assignedTo ?? '').trim().toLowerCase()),
      ),
    [allTasks, myClientIds, myNames],
  );

  const pending = useMemo(() => myTasks.filter((t) => t.status !== 'completed'), [myTasks]);
  const overdue = useMemo(
    () => pending.filter((t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))),
    [pending],
  );
  const overdueSinEntregar = useMemo(() => overdue.filter((t) => !t.driveLink), [overdue]);

  // Cargar links entregados (persistentes) de mis clientes.
  useEffect(() => {
    let cancel = false;
    if (myClientIds.length === 0) return;
    void TaskLinksRepo.listByClientIds(myClientIds).then((all) => {
      if (cancel) return;
      setLinks(all.filter((l) => !userId || l.createdBy === userId).slice(0, 5));
    });
    return () => { cancel = true; };
  }, [myClientIds, userId]);

  // Subtítulo contextual del saludo.
  const todayTasks = pending.filter((t) => t.dueDate && isToday(new Date(t.dueDate)));
  let subtitle: string;
  if (overdue.length > 0) subtitle = `Tienes ${overdue.length} entrega${overdue.length === 1 ? '' : 's'} vencida${overdue.length === 1 ? '' : 's'} sin subir`;
  else if (todayTasks.length > 0) subtitle = `Tienes ${todayTasks.length} entrega${todayTasks.length === 1 ? '' : 's'} para hoy`;
  else subtitle = 'Estás al día esta semana ✓';

  // Métricas.
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const weekTasks = myTasks.filter((t) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= in7);
  const weekDone = weekTasks.filter((t) => t.status === 'completed').length;
  const completedAll = myTasks.filter((t) => t.status === 'completed');
  const onTime = completedAll.filter((t) => t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate)).length;
  const cumplimiento = myTasks.length > 0 ? Math.round((onTime / myTasks.length) * 100) : 0;
  const activeClientIds = new Set(myTasks.map((t) => t.clientId));

  // Entregas urgentes: pendientes con vencimiento hasta mañana. Vencidas primero.
  const urgent = useMemo(() => {
    return pending
      .filter((t) => t.dueDate && (isPast(new Date(t.dueDate)) || isToday(new Date(t.dueDate)) || isTomorrow(new Date(t.dueDate))))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [pending]);

  const markDone = (t: Task) => {
    updateTask(t.id, { status: 'completed', completedAt: new Date().toISOString() });
    toast.success('Tarea completada');
  };

  const dueColor = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isPast(d) && !isToday(d)) return '#EF4444';
    if (isToday(d)) return '#F59E0B';
    return '#10B981';
  };
  const dueLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Hoy';
    if (isTomorrow(d)) return 'Mañana';
    if (isPast(d)) return `Venció hace ${Math.abs(differenceInCalendarDays(d, now))}d`;
    return `En ${differenceInCalendarDays(d, now)}d`;
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Saludo */}
      <div>
        <h1 className="heading text-2xl lg:text-3xl font-bold">
          {greetingPrefix()}, {firstName} <span className="align-middle">👋</span>
        </h1>
        <p className={cn('text-sm mt-1', overdue.length > 0 ? 'text-status-danger' : 'text-text-muted')}>{subtitle}</p>
      </div>

      {/* 2. Banner de alerta */}
      {overdueSinEntregar.length > 0 && (
        <div className="rounded-[12px] border border-status-danger/40 bg-status-danger/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-status-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-text-primary">
              {overdueSinEntregar.length === 1 ? (
                <>
                  <span className="font-medium">{overdueSinEntregar[0].title}</span> venció y no tiene entregable subido.
                  Súbelo hoy para no bloquear el proyecto.
                </>
              ) : (
                <>
                  Tienes <span className="font-medium">{overdueSinEntregar.length} tareas vencidas sin entregable</span>.
                  La más urgente: {overdueSinEntregar[0].title}
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setDeliverableTask(overdueSinEntregar[0])}
            className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-status-danger text-white hover:brightness-110 transition"
          >
            Subir ahora
          </button>
        </div>
      )}

      {/* 3. Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<Calendar className="h-4 w-4" />}
          label="Tareas esta semana"
          value={weekTasks.length}
          sub={`${weekDone} completadas · ${weekTasks.length - weekDone} pendientes`}
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Vencidas sin entregar"
          value={overdueSinEntregar.length}
          sub="Requieren atención hoy"
          danger={overdueSinEntregar.length > 0}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Mi cumplimiento"
          value={`${cumplimiento}%`}
          sub="Entregas a tiempo / asignadas"
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Clientes activos"
          value={activeClientIds.size}
          sub={myClients.filter((c) => activeClientIds.has(c.id)).map((c) => c.name).join(' · ') || '—'}
        />
      </div>

      {/* 4. Entregas urgentes */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Entregas urgentes — hoy y mañana</h2>
        {urgent.length === 0 ? (
          <div className="surface p-8 text-center text-sm text-text-muted">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-status-success" />
            Nada urgente. Estás al día 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {urgent.map((t) => {
              const c = clientById[t.clientId];
              return (
                <div key={t.id} className="surface p-3 flex items-center gap-3">
                  <button
                    onClick={() => markDone(t)}
                    title="Marcar completada"
                    className="h-5 w-5 rounded-full border border-border-default hover:border-status-success hover:bg-status-success/10 transition shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{t.title}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted flex-wrap">
                      {c && (
                        <button
                          onClick={() => navigate(`/client/${c.id}/tasks`)}
                          className="inline-flex items-center gap-1 hover:text-text-primary transition"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: c.primaryColor }} />
                          {c.name}
                        </button>
                      )}
                      {t.moduleTag && <span>· {t.moduleTag}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium shrink-0" style={{ color: dueColor(t.dueDate) }}>
                    {dueLabel(t.dueDate)}
                  </span>
                  <Badge tone={t.priority === 'P1' ? 'danger' : t.priority === 'P2' ? 'warning' : 'neutral'}>
                    {t.priority}
                  </Badge>
                  {t.driveLink ? (
                    <button
                      onClick={() => setDeliverableTask(t)}
                      className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-md bg-status-success/15 text-status-success inline-flex items-center gap-1 hover:brightness-110 transition"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Entregado
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeliverableTask(t)}
                      className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-md bg-accent-violet/15 text-accent-violet inline-flex items-center gap-1 hover:bg-accent-violet/25 transition"
                    >
                      <FolderUp className="h-3.5 w-3.5" /> Subir entregable
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Últimos links entregados */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Últimos links entregados</h2>
        {links.length === 0 ? (
          <div className="surface p-6 text-center text-xs text-text-muted">Aún no has subido entregables.</div>
        ) : (
          <div className="surface divide-y divide-border-subtle/40">
            {links.map((l) => {
              const c = clientById[l.clientId];
              return (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-elevated/30 transition text-sm"
                >
                  {c && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.primaryColor }} />}
                  <span className="text-text-primary truncate flex-1">{l.nombre}</span>
                  <span className="text-[11px] text-text-muted shrink-0">{c?.name ?? ''}</span>
                  <span
                    className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: withAlpha('#8b5cf6', 0.15), color: '#a78bfa' }}
                  >
                    {l.tipo}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-text-muted shrink-0" />
                </a>
              );
            })}
          </div>
        )}
      </div>

      {deliverableTask && (
        <DeliverableDrawer
          task={{ id: deliverableTask.id, clientId: deliverableTask.clientId, title: deliverableTask.title, driveLink: deliverableTask.driveLink }}
          onClose={() => setDeliverableTask(null)}
          onSaved={() => {
            void TaskLinksRepo.listByClientIds(myClientIds).then((all) =>
              setLinks(all.filter((l) => !userId || l.createdBy === userId).slice(0, 5)),
            );
          }}
        />
      )}
    </div>
  );
}

function MetricCard({
  icon, label, value, sub, danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-text-muted mb-2">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-2xl font-bold', danger ? 'text-status-danger' : 'text-text-primary')}>{value}</div>
      <div className="text-[11px] text-text-muted mt-1 truncate" title={sub}>{sub}</div>
    </div>
  );
}
