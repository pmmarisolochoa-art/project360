import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, CalendarClock, AlertTriangle, BellRing, ArrowRight, Check } from 'lucide-react';
import { isThisWeek, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useClientStore } from '@/store/useClientStore';
import { avanceForClient } from '@/utils/avance';
import { estaVencida, diasDeAtraso } from '@/utils/vencidas';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useUIDrawerStore } from '@/store/useUIDrawerStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { withAlpha } from '@/utils/colorGenerator';
import { isActiveClient } from '@/types/client';
import type { Notification, NotificationUrgency } from '@/types/notification';
import { toast } from '@/store/useToastStore';

type Tone = 'accent' | 'default' | 'warning' | 'danger';
const TONE_COLOR: Record<Tone, string> = {
  accent: '#6366F1',   // índigo (Clientes)
  default: '#06B6D4',  // cian (Reuniones)
  danger: '#EF4444',   // rojo (Tareas vencidas)
  warning: '#F59E0B',  // amarillo (Alertas)
};

export function GlobalStats() {
  const clients = useClientStore((s) => s.clients);
  const meetings = useClientStore((s) => s.meetings);
  const tasks = useClientStore((s) => s.tasks);
  const notifications = useNotificationStore((s) => s.notifications);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const activeClients = clients.filter(isActiveClient).length;
  // El "de N totales" debe contar lo mismo que el numerador: clientes REALES.
  // La agencia no es un cliente y no sale en ninguna otra pantalla.
  const totalClients = clients.filter((c) => !c.isAgency).length;
  const weekMeetings = meetings.filter((m) => isThisWeek(parseISO(m.scheduledAt), { weekStartsOn: 1 }));
  const meetingsThisWeek = weekMeetings.length;
  // Vencida se CALCULA, no se lee de la marca guardada. Ver utils/vencidas.ts.
  const overdueTasks = tasks.filter((t) => estaVencida(t));
  // El conteo de alertas excluye las obsoletas (entidad origen ya resuelta).
  // Misma lógica que AlertsPanel.isStale para mantener consistencia.
  const unread = notifications.filter((n) => {
    if (n.isRead) return false;
    if ((n.type === 'task_overdue' || n.type === 'task_due_soon' || n.type === 'task_comment') && n.entityId) {
      const task = tasks.find((t) => t.id === n.entityId);
      if (!task || task.status === 'completed') return false;
    }
    if (n.type === 'meeting_soon' && n.entityId) {
      const meeting = meetings.find((m) => m.id === n.entityId);
      if (!meeting || meeting.completed) return false;
    }
    return true;
  }).length;

  const stats: Array<{ label: string; value: string; hint: string; icon: typeof Users; tone: Tone }> = [
    { label: 'Clientes activos', value: String(activeClients), hint: `de ${totalClients} totales`, icon: Users, tone: 'accent' },
    { label: 'Reuniones esta semana', value: String(meetingsThisWeek), hint: 'en todo el portafolio', icon: CalendarClock, tone: 'default' },
    { label: 'Tareas vencidas', value: String(overdueTasks.length), hint: 'requieren intervención', icon: AlertTriangle, tone: overdueTasks.length > 0 ? 'danger' : 'default' },
    { label: 'Alertas pendientes', value: String(unread), hint: 'agrupadas por urgencia', icon: BellRing, tone: unread > 3 ? 'warning' : 'default' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const color = TONE_COLOR[s.tone];
          const isOpen = openIdx === i;
          return (
            <motion.button
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
              whileHover={{ scale: 1.01 }}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="relative text-left surface p-4 overflow-hidden cursor-pointer transition-colors focus-ring"
              style={{
                borderColor: isOpen ? color : 'rgba(255,255,255,0.06)',
                boxShadow: isOpen ? `0 0 24px -6px ${withAlpha(color, 0.5)}` : undefined,
                background: `linear-gradient(135deg, ${withAlpha(color, isOpen ? 0.12 : 0.06)}, transparent 60%)`,
                transition: 'border-color 200ms, box-shadow 200ms, background 200ms',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-[10px] bg-bg-elevated border border-border-default flex items-center justify-center" style={{ color }}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="kpi-number" style={{ color: isOpen ? color : undefined }}>{s.value}</div>
              <div className="mt-1 text-sm text-text-secondary">{s.label}</div>
              <div className="text-[11px] text-text-muted mt-0.5">{s.hint}</div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {openIdx !== null && (
          <motion.div
            key={openIdx}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="surface p-5" style={{ borderColor: TONE_COLOR[stats[openIdx].tone] }}>
              {openIdx === 0 && <ActiveClientsPanel />}
              {openIdx === 1 && <WeekMeetingsPanel meetings={weekMeetings} />}
              {openIdx === 2 && <OverdueTasksPanel />}
              {openIdx === 3 && <AlertsPanel />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────── Sub-paneles ───────── */

function ActiveClientsPanel() {
  const navigate = useNavigate();
  const clients = useClientStore((s) => s.clients);
  const tasks = useClientStore((s) => s.tasks);
  const list = clients.filter(isActiveClient);
  return (
    <div>
      <h3 className="heading text-base font-bold mb-3">Clientes activos</h3>
      <ul className="space-y-1.5">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-base/30 px-3 py-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.primaryColor, boxShadow: `0 0 8px ${c.primaryColor}` }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text-primary truncate">{c.name}</div>
              <div className="text-[10px] text-text-muted">{c.businessType} · {avanceForClient(tasks, c.id)}% avance</div>
            </div>
            <Badge tone="neutral">{c.status}</Badge>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/client/${c.id}`)}>Abrir</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MEETING_TYPE_LABEL: Record<string, string> = {
  kickoff: 'Kickoff', weekly_metrics: 'Revisión semanal', content_strategy: 'Contenido',
  ads_review: 'Revisión ADS', monthly_closing: 'Cierre mensual', crisis: 'Crisis',
  weekly_planning: 'Planeación semanal', ropre_strategy: 'ROPRE & Entregables',
  weekly_closing: 'Cierre de semana',
  general: 'General', management: 'Gerencia',
};

function WeekMeetingsPanel({ meetings }: { meetings: ReturnType<typeof useClientStore.getState>['meetings'] }) {
  const clients = useClientStore((s) => s.clients);
  const openMeeting = useUIDrawerStore((s) => s.openMeeting);
  const sorted = [...meetings].sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  return (
    <div>
      <h3 className="heading text-base font-bold mb-3">Reuniones esta semana</h3>
      {sorted.length === 0 ? (
        <div className="text-sm text-text-muted italic">Sin reuniones esta semana.</div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((m) => {
            const c = clients.find((x) => x.id === m.clientId);
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-base/30 px-3 py-2">
                <div className="text-xs text-text-secondary w-24 shrink-0">{format(parseISO(m.scheduledAt), 'EEE HH:mm', { locale: es })}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{m.title}</div>
                  <div className="text-[10px] text-text-muted">{MEETING_TYPE_LABEL[m.type] ?? m.type}</div>
                </div>
                {c && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: withAlpha(c.primaryColor, 0.15), color: c.primaryColor, border: `1px solid ${withAlpha(c.primaryColor, 0.3)}` }}>
                    {c.name}
                  </span>
                )}
                <div className="flex -space-x-1.5">
                  {m.participants.slice(0, 3).map((p, i) => (
                    <div key={i} title={p.name} className="h-6 w-6 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center text-[9px] text-text-primary">
                      {p.name[0]?.toUpperCase()}
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="secondary" onClick={() => openMeeting(m.id)}>Ver detalles</Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OverdueTasksPanel() {
  const navigate = useNavigate();
  const tasks = useClientStore((s) => s.tasks);
  const clients = useClientStore((s) => s.clients);
  const overdue = tasks
    .filter((t) => estaVencida(t))
    .sort((a, b) => diasDeAtraso(b) - diasDeAtraso(a));
  return (
    <div>
      <h3 className="heading text-base font-bold mb-3">Tareas vencidas</h3>
      {overdue.length === 0 ? (
        <div className="text-sm text-status-success">✅ No hay tareas vencidas.</div>
      ) : (
        <ul className="space-y-1.5">
          {overdue.map((t) => {
            const c = clients.find((x) => x.id === t.clientId);
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-md border border-status-danger/30 bg-status-danger/5 px-3 py-2">
                <Badge tone="danger">{t.priority}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{t.title}</div>
                  <div className="text-[10px] text-text-muted">{t.assignedTo}</div>
                </div>
                {c && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: withAlpha(c.primaryColor, 0.15), color: c.primaryColor }}>{c.name}</span>}
                <span className="text-[10px] uppercase tracking-wider bg-status-danger/20 text-status-danger px-2 py-0.5 rounded-full font-bold">
                  +{diasDeAtraso(t)}d
                </span>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/client/${t.clientId}/tasks`)}>
                  Ir a tarea
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const URGENCY_TONE: Record<NotificationUrgency, { label: string; color: string }> = {
  critical: { label: 'Críticas', color: '#EF4444' },
  high: { label: 'Altas', color: '#F97316' },
  normal: { label: 'Normales', color: '#F59E0B' },
  low: { label: 'Bajas', color: '#A0A0B4' },
};

function AlertsPanel() {
  const navigate = useNavigate();
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const tasks = useClientStore((s) => s.tasks);
  const meetings = useClientStore((s) => s.meetings);
  const openMeeting = useUIDrawerStore((s) => s.openMeeting);

  // Una alerta es "obsoleta" cuando su entidad origen ya no requiere acción:
  // tarea completada/inexistente, reunión hecha/inexistente.
  const isStale = (n: Notification): boolean => {
    if (n.type === 'task_overdue' || n.type === 'task_due_soon' || n.type === 'task_comment') {
      if (!n.entityId) return false;
      const task = tasks.find((t) => t.id === n.entityId);
      return !task || task.status === 'completed';
    }
    if (n.type === 'meeting_soon') {
      if (!n.entityId) return false;
      const meeting = meetings.find((m) => m.id === n.entityId);
      return !meeting || !!meeting.completed;
    }
    return false;
  };

  const unread = notifications.filter((n) => !n.isRead);

  // Auto-markRead las que son obsoletas (no las mostramos).
  // Se ejecuta tras render para evitar warning de setState durante render.
  useEffect(() => {
    const stale = unread.filter(isStale);
    if (stale.length > 0) {
      stale.forEach((n) => markRead(n.id));
    }
    // tasks/meetings como deps para reaccionar cuando cambia el estado de la entidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, meetings, notifications]);

  const visible = unread.filter((n) => !isStale(n));
  const grouped = (['critical', 'high', 'normal', 'low'] as NotificationUrgency[])
    .map((u) => ({ urgency: u, items: visible.filter((n) => n.urgency === u) }))
    .filter((g) => g.items.length > 0);

  const handleResolve = (n: Notification) => {
    // 1. Tarea (vencida / próxima a vencer / con comentario)
    if (n.type === 'task_overdue' || n.type === 'task_due_soon' || n.type === 'task_comment') {
      if (n.entityId) {
        const task = tasks.find((t) => t.id === n.entityId);
        if (!task) {
          toast.info('Esta tarea ya no existe.');
          markRead(n.id);
          return;
        }
        if (task.status === 'completed') {
          toast.success('Esta tarea ya fue completada ✓');
          markRead(n.id);
          return;
        }
        // Navega al módulo Tasks del cliente con query param para auto-abrir el detalle
        navigate(`/client/${n.clientId ?? task.clientId}/tasks?task=${n.entityId}`);
      } else if (n.clientId) {
        navigate(`/client/${n.clientId}/tasks`);
      }
      markRead(n.id);
      return;
    }

    // 2. Reunión próxima
    if (n.type === 'meeting_soon') {
      if (n.entityId) {
        const meeting = meetings.find((m) => m.id === n.entityId);
        if (!meeting) {
          toast.info('Esta reunión ya no existe.');
          markRead(n.id);
          return;
        }
        if (meeting.completed) {
          toast.success('Esta reunión ya fue realizada ✓');
          markRead(n.id);
          return;
        }
        openMeeting(n.entityId);
        navigate(`/client/${n.clientId ?? meeting.clientId}/agenda`);
      } else if (n.clientId) {
        navigate(`/client/${n.clientId}/agenda`);
      }
      markRead(n.id);
      return;
    }

    // 3. Contenido pendiente de aprobación
    if (n.type === 'content_pending_approval') {
      if (n.clientId) {
        navigate(`/client/${n.clientId}/content?filter=in_review`);
      }
      markRead(n.id);
      return;
    }

    // 4. Default: cerebro del cliente
    if (n.clientId) {
      navigate(`/client/${n.clientId}`);
    }
    markRead(n.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="heading text-base font-bold">Alertas pendientes</h3>
        {unread.length > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead}>
            <Check className="h-3 w-3" /> Marcar todas como vistas
          </Button>
        )}
      </div>
      {grouped.length === 0 ? (
        <div className="text-sm text-status-success">✅ Sin alertas pendientes.</div>
      ) : (
        grouped.map(({ urgency, items }) => {
          const meta = URGENCY_TONE[urgency];
          return (
            <div key={urgency} className="mb-3 last:mb-0">
              <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: meta.color }}>{meta.label}</div>
              <ul className="space-y-1">
                {items.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 rounded-md border px-3 py-2"
                    style={{ borderColor: withAlpha(meta.color, 0.3), background: withAlpha(meta.color, 0.05) }}>
                    <div className="flex-1 text-sm text-text-primary">{n.message}</div>
                    <Button size="sm" variant="secondary" onClick={() => handleResolve(n)}>
                      Resolver <ArrowRight className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
