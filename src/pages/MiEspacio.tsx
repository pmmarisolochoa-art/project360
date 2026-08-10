import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FolderUp, Calendar, Users, TrendingUp, ExternalLink, CalendarClock, Video } from 'lucide-react';
import { differenceInCalendarDays, isToday, isTomorrow, isPast } from 'date-fns';
import { useAuthStore } from '@/store/useAuthStore';
import { useClientStore } from '@/store/useClientStore';
import { TaskLinksRepo, type TaskLink } from '@/services/taskLinks';
import { DeliverableDrawer } from '@/components/member/DeliverableDrawer';
import { MiSemana } from '@/components/member/MiSemana';
import { NuevaTareaMiEspacio } from '@/components/member/NuevaTareaMiEspacio';
import { MisTareasPersonales } from '@/components/member/MisTareasPersonales';
import { useLinksStore } from '@/store/useLinksStore';
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

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Etiqueta amigable de cuándo es una reunión: "Hoy · 15:00", "Mañana · 09:30", "12 ago · 16:00". */
function meetingWhen(dateStr: string): string {
  const d = new Date(dateStr);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (isToday(d)) return `Hoy · ${time}`;
  if (isTomorrow(d)) return `Mañana · ${time}`;
  return `${d.getDate()} ${MESES[d.getMonth()]} · ${time}`;
}

export function MiEspacio() {
  const navigate = useNavigate();
  const accesses = useAuthStore((s) => s.clientAccesses);
  const authUserId = useAuthStore((s) => s.user?.id);
  const clients = useClientStore((s) => s.clients);
  const allTasks = useClientStore((s) => s.tasks);
  const allMeetings = useClientStore((s) => s.meetings);
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

  /**
   * Mis tareas = de mis clientes, y además una de estas dos:
   *   · asignadas a mi nombre, o
   *   · PRIVADAS y mías.
   *
   * La segunda condición faltaba. Una tarea privada es de su `propietarioId`,
   * no de su `assignedTo`: si alguien creaba una privada sin ponerse a sí mismo
   * como responsable, desaparecía de su propio espacio. Se veía únicamente
   * entrando al cerebro del cliente, que es justo lo que Mi Espacio evita.
   *
   * No hace falta excluir lo privado de OTROS: las policies de la migración 030
   * hacen que esas filas ni lleguen al navegador.
   */
  const myTasks = useMemo(
    () =>
      allTasks.filter((t) => {
        // Lo privado propio entra SIEMPRE, sin mirar de qué cliente cuelga.
        //
        // Una tarea PERSONAL vive en el Espacio de Agencia, que no está entre
        // los clientes del miembro. Al exigir primero que el cliente fuera suyo,
        // su propia tarea personal quedaba fuera de su propio espacio: se
        // guardaba bien y no aparecía nunca.
        if (t.esPrivada) return t.propietarioId === authUserId;
        if (!myClientIds.includes(t.clientId)) return false;
        return myNames.has((t.assignedTo ?? '').trim().toLowerCase());
      }),
    [allTasks, myClientIds, myNames, authUserId],
  );

  /** Reuniones de mis clientes. Mismo criterio para las privadas. */
  const myMeetings = useMemo(
    () =>
      allMeetings.filter((m) => {
        if (m.esPrivada) return m.propietarioId === authUserId;
        return myClientIds.includes(m.clientId);
      }),
    [allMeetings, myClientIds, authUserId],
  );

  const pending = useMemo(() => myTasks.filter((t) => t.status !== 'completed'), [myTasks]);
  const overdue = useMemo(
    () => pending.filter((t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))),
    [pending],
  );
  const overdueSinEntregar = useMemo(() => overdue.filter((t) => !t.driveLink), [overdue]);

  // Cargar links entregados (persistentes) de mis clientes.
  const refreshLinks = () => {
    if (myClientIds.length === 0) return;
    void TaskLinksRepo.listByClientIds(myClientIds).then((all) => setLinks(all.slice(0, 5)));
  };
  useEffect(() => {
    let cancel = false;
    if (myClientIds.length === 0) return;
    void TaskLinksRepo.listByClientIds(myClientIds).then((all) => {
      if (cancel) return;
      setLinks(all.slice(0, 5));
    });
    return () => { cancel = true; };
    // Solo depende de myClientIds a propósito: re-consultar por cada cambio de links dispararía un bucle.
  }, [myClientIds]);

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
  // Cumplimiento = entregas a tiempo ÷ lo que YA debías entregar (completadas +
  // vencidas sin entregar). NO cuenta las pendientes que aún no vencen, así el %
  // refleja la puntualidad real y no se hunde por tener trabajo futuro abierto.
  const overdueOpen = myTasks.filter(
    (t) => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now,
  ).length;
  const dueSoFar = completedAll.length + overdueOpen;
  const cumplimiento = dueSoFar > 0 ? Math.round((onTime / dueSoFar) * 100) : 100;
  const activeClientIds = new Set(myTasks.map((t) => t.clientId));

  // Destinos para las tarjetas cliqueables (el board de tareas ya filtra por el
  // miembro). Preferimos el cliente de la tarea relevante; si no, el primero.
  const firstActiveClientId = [...activeClientIds][0] ?? myClientIds[0];
  const weekTargetClientId = weekTasks[0]?.clientId ?? firstActiveClientId;
  const overdueTargetClientId = overdueSinEntregar[0]?.clientId ?? overdue[0]?.clientId ?? firstActiveClientId;

  // Entregas urgentes: pendientes con vencimiento hasta mañana. Vencidas primero.
  const urgent = useMemo(() => {
    return pending
      .filter((t) => t.dueDate && (isPast(new Date(t.dueDate)) || isToday(new Date(t.dueDate)) || isTomorrow(new Date(t.dueDate))))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [pending]);

  // Reuniones agrupadas por cliente: próximas arriba (más cercana primero),
  // luego las recientes pasadas (más nueva primero, hasta 4 por cliente).
  const isUpcomingMeeting = (m: { scheduledAt: string; completed?: boolean }) => {
    const d = new Date(m.scheduledAt);
    return !m.completed && (isToday(d) || !isPast(d));
  };
  const meetingsByClient = useMemo(() => {
    const mine = myMeetings.filter((m) => m.scheduledAt);
    return myClients
      .map((c) => {
        const list = mine.filter((m) => m.clientId === c.id);
        const upcoming = list
          .filter(isUpcomingMeeting)
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        const past = list
          .filter((m) => !isUpcomingMeeting(m))
          .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
          .slice(0, 4);
        return { client: c, meetings: [...upcoming, ...past], upcomingCount: upcoming.length };
      })
      .filter((g) => g.meetings.length > 0);
    // Deps explícitas a propósito: el resto son helpers estables.
  }, [myMeetings, myClients]);

  const markDone = (t: Task) => {
    updateTask(t.id, { status: 'completed', completedAt: new Date().toISOString() });
    toast.success('Tarea completada');
  };

  /** Deshacer un "completada" marcado por error. */
  const reabrir = (t: Task) => {
    // `completedAt` se limpia: si se quedara puesto, la tarea seguiría contando
    // como entregada en el cumplimiento aunque esté pendiente otra vez.
    updateTask(t.id, { status: 'pending', completedAt: undefined });
    toast.success('Tarea reabierta');
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

      {/* 2. Crear algo suyo — el espacio dejó de ser de solo consumo. */}
      <div className="flex justify-end">
        <NuevaTareaMiEspacio misClientes={myClients} />
      </div>

      {/* 3. Lo personal, siempre a la vista — NO depende de la semana. Va antes
          que la rejilla porque es lo que la persona revisa a diario y lo único
          que no tiene otro sitio donde vivir. */}
      <MisTareasPersonales tareas={myTasks} onCompletar={markDone} onReabrir={reabrir} />

      {/* 4. Mi semana — todo lo suyo (tareas + reuniones, de todos sus
          clientes) en una sola rejilla. Va arriba del todo a propósito: es la
          respuesta a "¿qué tengo esta semana?", que es con lo que se abre la
          app por la mañana. */}
      <MiSemana
        tareas={myTasks}
        reuniones={myMeetings}
        clientePorId={clientById}
        onAbrirTarea={setDeliverableTask}
        onCompletar={markDone}
      />

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
          onClick={weekTargetClientId ? () => navigate(`/client/${weekTargetClientId}/tasks?filter=week`) : undefined}
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Vencidas sin entregar"
          value={overdueSinEntregar.length}
          sub="Requieren atención hoy"
          danger={overdueSinEntregar.length > 0}
          onClick={overdueTargetClientId ? () => navigate(`/client/${overdueTargetClientId}/tasks?filter=overdue`) : undefined}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Mi cumplimiento"
          value={`${cumplimiento}%`}
          sub="A tiempo / lo que ya debías entregar"
          onClick={firstActiveClientId ? () => navigate(`/client/${firstActiveClientId}/tasks?filter=mine`) : undefined}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Clientes activos"
          value={activeClientIds.size}
          sub={myClients.filter((c) => activeClientIds.has(c.id)).map((c) => c.name).join(' · ') || '—'}
          onClick={firstActiveClientId ? () => navigate(`/client/${firstActiveClientId}`) : undefined}
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
                  {/* 7B: los links ya subidos a esta tarea, a un clic. */}
                  <LinksDeTarea taskId={t.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4a. Reuniones por cliente (próximas + recientes) */}
      {meetingsByClient.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-text-muted" /> Reuniones
          </h2>
          <div className="space-y-4">
            {meetingsByClient.map((g) => (
              <div key={g.client.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: g.client.primaryColor }} />
                  <span className="text-xs font-semibold text-text-primary">{g.client.name}</span>
                  {g.upcomingCount > 0 && (
                    <span className="text-[10px] text-text-muted">
                      · {g.upcomingCount} próxima{g.upcomingCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {g.meetings.map((m) => {
                    const past = !isUpcomingMeeting(m);
                    return (
                      <div key={m.id} className={cn('surface p-3 flex items-center gap-3', past && 'opacity-60')}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary truncate">{m.title}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted flex-wrap">
                            {m.type && <span>{m.type}</span>}
                            {past && <span>· realizada</span>}
                          </div>
                        </div>
                        <span className={cn('text-[11px] font-medium shrink-0', past ? 'text-text-muted' : 'text-text-secondary')}>
                          {meetingWhen(m.scheduledAt)}
                        </span>
                        {!past && m.videoCallLink && (
                          <a
                            href={m.videoCallLink}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-md bg-accent-violet/15 text-accent-violet inline-flex items-center gap-1 hover:bg-accent-violet/25 transition"
                          >
                            <Video className="h-3.5 w-3.5" /> Unirse
                          </a>
                        )}
                        {past && <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4b. Mis clientes → cronograma de tareas */}
      {myClients.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Mis clientes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myClients.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/client/${c.id}/tasks`)}
                className="surface p-4 text-left hover:brightness-110 transition flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.primaryColor }} />
                  <div className="min-w-0">
                    <div className="text-sm text-text-primary truncate">{c.name}</div>
                    <div className="text-[11px] text-text-muted">Ver cronograma de tareas</div>
                  </div>
                </div>
                <Calendar className="h-4 w-4 text-text-muted shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

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
          task={{
            id: deliverableTask.id,
            clientId: deliverableTask.clientId,
            title: deliverableTask.title,
            driveLink: deliverableTask.driveLink,
            meetingId: deliverableTask.meetingId,
          }}
          onClose={() => setDeliverableTask(null)}
          onSaved={refreshLinks}
        />
      )}
    </div>
  );
}

function MetricCard({
  icon, label, value, sub, danger, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-text-muted mb-2">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-2xl font-bold', danger ? 'text-status-danger' : 'text-text-primary')}>{value}</div>
      <div className="text-[11px] text-text-muted mt-1 truncate" title={sub}>{sub}</div>
    </>
  );
  if (!onClick) return <div className="surface p-4">{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface p-4 text-left w-full transition hover:border-accent-violet/40 hover:bg-bg-elevated/40 focus-ring cursor-pointer"
    >
      {content}
    </button>
  );
}

/**
 * Links ya subidos a una tarea (7B). Lee del store global de `task_links`, que
 * es la misma fila que ve el PM en /links-entregables — no una copia.
 */
function LinksDeTarea({ taskId }: { taskId: string }) {
  const links = useLinksStore((s) => s.links);
  const propios = links.filter((l) => l.taskId === taskId);
  if (propios.length === 0) return null;
  return (
    <div className="basis-full flex flex-wrap items-center gap-1.5 pl-1">
      {propios.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={l.nombre}
          className="inline-flex items-center gap-1 rounded-md bg-bg-base/60 px-1.5 py-0.5 text-[10px] text-text-secondary hover:text-accent-violet max-w-[200px]"
        >
          📎 <span className="truncate">{l.nombre}</span>
        </a>
      ))}
    </div>
  );
}
