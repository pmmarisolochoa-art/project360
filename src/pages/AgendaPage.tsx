import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Settings, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  format,
  parseISO,
  isSameDay,
  isWithinInterval,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useClientStore } from '@/store/useClientStore';
import { useUIDrawerStore } from '@/store/useUIDrawerStore';
import { withAlpha } from '@/utils/colorGenerator';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { IntegrationsModal } from '@/components/dashboard/IntegrationsModal';
import { MeetingDrawer } from '@/components/dashboard/MeetingDrawer';
import type { Meeting, MeetingType } from '@/types/meeting';
import type { Client } from '@/types/client';

const TYPE_LABEL: Record<MeetingType, string> = {
  kickoff: 'Kickoff',
  weekly_metrics: 'Métricas semanales',
  content_strategy: 'Estrategia de contenido',
  ads_review: 'Revisión de ads',
  monthly_closing: 'Cierre mensual',
  crisis: 'Crisis',
  weekly_planning: 'Planeación semanal',
  ropre_strategy: 'Estrategia ROPRE',
  weekly_closing: 'Sprint de cierre de semana',
};

export function AgendaPage() {
  const meetings = useClientStore((s) => s.meetings);
  const clients = useClientStore((s) => s.clients);
  const meetingId = useUIDrawerStore((s) => s.meetingId);
  const openMeeting = useUIDrawerStore((s) => s.openMeeting);
  const closeMeeting = useUIDrawerStore((s) => s.closeMeeting);
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const [view, setView] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(new Date());
  const [fClient, setFClient] = useState('');
  const [fType, setFType] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  const range = useMemo(() => {
    if (view === 'week') {
      return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }, [view, anchor]);

  const filtered = useMemo(
    () =>
      meetings
        .filter((m) => {
          const d = parseISO(m.scheduledAt);
          if (!isWithinInterval(d, range)) return false;
          if (fClient && m.clientId !== fClient) return false;
          if (fType && m.type !== fType) return false;
          if (fStatus === 'done' && !m.completed) return false;
          if (fStatus === 'pending' && m.completed) return false;
          return true;
        })
        .sort((a, b) => +parseISO(a.scheduledAt) - +parseISO(b.scheduledAt)),
    [meetings, range, fClient, fType, fStatus],
  );

  const activeMeeting = meetingId ? meetings.find((m) => m.id === meetingId) : null;

  const goPrev = () => setAnchor((d) => (view === 'week' ? addWeeks(d, -1) : addMonths(d, -1)));
  const goNext = () => setAnchor((d) => (view === 'week' ? addWeeks(d, 1) : addMonths(d, 1)));

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-1.5">
            Agenda · Vista global
          </div>
          <h1 className="heading text-3xl lg:text-4xl font-bold">
            <span className="gradient-text">Reuniones</span> de todos los clientes
          </h1>
          <p className="text-sm text-text-secondary mt-1.5">
            {filtered.length} reuniones en el rango · click para abrir detalle
          </p>
        </div>
        <button
          onClick={() => setIntegrationsOpen(true)}
          className="h-9 px-3 rounded-md border border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-hover transition inline-flex items-center gap-1.5 text-xs"
        >
          <Settings className="h-3.5 w-3.5" /> Integraciones
        </button>
      </header>

      <div className="surface p-3 flex gap-2 items-center flex-wrap">
        <div className="inline-flex rounded-md border border-border-default overflow-hidden">
          <button
            onClick={() => setView('week')}
            className={`h-9 px-3 text-xs ${view === 'week' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            Semana
          </button>
          <button
            onClick={() => setView('month')}
            className={`h-9 px-3 text-xs border-l border-border-default ${view === 'month' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            Mes
          </button>
        </div>
        <div className="inline-flex items-center gap-1">
          <button onClick={goPrev} className="h-9 w-9 rounded-md border border-border-subtle text-text-secondary hover:text-text-primary inline-flex items-center justify-center">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="h-9 px-3 rounded-md border border-border-subtle text-xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Hoy
          </button>
          <button onClick={goNext} className="h-9 w-9 rounded-md border border-border-subtle text-text-secondary hover:text-text-primary inline-flex items-center justify-center">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-text-muted ml-1">
          {format(range.start, "d MMM", { locale: es })} – {format(range.end, "d MMM yyyy", { locale: es })}
        </span>
        <div className="flex-1" />
        <Select
          value={fClient}
          onChange={(e) => setFClient(e.target.value)}
          className="min-w-[180px]"
          options={[{ value: '', label: 'Todos los clientes' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <Select
          value={fType}
          onChange={(e) => setFType(e.target.value)}
          className="min-w-[180px]"
          options={[{ value: '', label: 'Todos los tipos' }, ...Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
        />
        <Select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className="min-w-[140px]"
          options={[
            { value: '', label: 'Todas' },
            { value: 'pending', label: 'Pendientes' },
            { value: 'done', label: 'Realizadas' },
          ]}
        />
      </div>

      {view === 'week' ? (
        <WeekGrid range={range} meetings={filtered} clientById={clientById} onClick={openMeeting} />
      ) : (
        <MonthGrid range={range} meetings={filtered} clientById={clientById} onClick={openMeeting} />
      )}

      <section className="surface p-4">
        <h2 className="heading text-sm font-semibold mb-3">Lista cronológica</h2>
        {filtered.length === 0 ? (
          <div className="text-sm text-text-muted py-6 text-center">Sin reuniones en este rango.</div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((m) => {
              const c = clientById[m.clientId];
              const t = parseISO(m.scheduledAt);
              return (
                <li key={m.id}>
                  <button
                    onClick={() => openMeeting(m.id)}
                    className="w-full text-left rounded-md border border-border-subtle bg-bg-base/30 hover:bg-bg-elevated/40 px-3 py-2 flex items-center gap-3"
                  >
                    <span className="text-[10px] uppercase tracking-wider text-text-muted w-32 shrink-0">
                      {format(t, "EEE d 'de' MMM · HH:mm", { locale: es })}
                    </span>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c?.primaryColor ?? '#8B5CF6' }} />
                    <span className="text-sm text-text-primary font-medium truncate flex-1">{m.title}</span>
                    <Badge tone="info">{TYPE_LABEL[m.type]}</Badge>
                    <span className="text-xs text-text-muted truncate max-w-[140px]">{c?.name ?? '—'}</span>
                    {m.completed && <Badge tone="success">✓</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <IntegrationsModal open={integrationsOpen} onClose={() => setIntegrationsOpen(false)} />
      <AnimatePresence>
        {activeMeeting && <MeetingDrawer meeting={activeMeeting} onClose={closeMeeting} />}
      </AnimatePresence>
    </div>
  );
}

function WeekGrid({
  range,
  meetings,
  clientById,
  onClick,
}: {
  range: { start: Date; end: Date };
  meetings: Meeting[];
  clientById: Record<string, Client>;
  onClick: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
  return (
    <section className="surface p-4">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayMeetings = meetings.filter((m) => isSameDay(parseISO(m.scheduledAt), day));
          return (
            <div
              key={day.toISOString()}
              className={`rounded-[10px] border p-2 min-h-[180px] ${
                isToday(day) ? 'border-accent-violet/40 bg-accent-violet/5' : 'border-border-subtle bg-bg-base/30'
              }`}
            >
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">{format(day, 'EEE', { locale: es })}</div>
                <div className={`text-sm font-semibold ${isToday(day) ? 'text-accent-violet' : 'text-text-primary'}`}>{format(day, 'd')}</div>
              </div>
              <div className="space-y-1.5">
                {dayMeetings.length === 0 ? (
                  <div className="text-[10px] text-text-muted opacity-50 italic">—</div>
                ) : (
                  dayMeetings.map((m) => {
                    const c = clientById[m.clientId];
                    const accent = c?.primaryColor ?? '#8B5CF6';
                    return (
                      <button
                        key={m.id}
                        onClick={() => onClick(m.id)}
                        className="w-full text-left rounded-md p-1.5 transition hover:brightness-125"
                        style={{
                          background: `linear-gradient(135deg, ${withAlpha(accent, 0.22)}, ${withAlpha(accent, 0.08)})`,
                          borderLeft: `2px solid ${accent}`,
                          opacity: m.completed ? 0.55 : 1,
                        }}
                      >
                        <div className="text-[10px] font-semibold text-text-primary truncate">
                          {format(parseISO(m.scheduledAt), 'HH:mm')} · {m.title}
                        </div>
                        <div className="text-[10px] text-text-muted truncate">{c?.name}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MonthGrid({
  range,
  meetings,
  clientById,
  onClick,
}: {
  range: { start: Date; end: Date };
  meetings: Meeting[];
  clientById: Record<string, Client>;
  onClick: (id: string) => void;
}) {
  const gridStart = startOfWeek(range.start, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(range.end, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <section className="surface p-4">
      <div className="grid grid-cols-7 gap-2">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="text-[10px] uppercase tracking-wider text-text-muted text-center pb-1">{d}</div>
        ))}
        {days.map((day) => {
          const dayMeetings = meetings.filter((m) => isSameDay(parseISO(m.scheduledAt), day));
          const inMonth = day >= range.start && day <= range.end;
          return (
            <div
              key={day.toISOString()}
              className={`rounded-md border p-1.5 min-h-[88px] ${
                isToday(day) ? 'border-accent-violet/40 bg-accent-violet/5' : 'border-border-subtle bg-bg-base/30'
              } ${!inMonth ? 'opacity-40' : ''}`}
            >
              <div className={`text-[10px] mb-1 ${isToday(day) ? 'text-accent-violet font-bold' : 'text-text-muted'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayMeetings.slice(0, 3).map((m) => {
                  const accent = clientById[m.clientId]?.primaryColor ?? '#8B5CF6';
                  return (
                    <button
                      key={m.id}
                      onClick={() => onClick(m.id)}
                      title={m.title}
                      className="w-full text-left rounded px-1 py-0.5 text-[9px] text-text-primary truncate hover:brightness-125"
                      style={{ background: withAlpha(accent, 0.25), borderLeft: `2px solid ${accent}`, opacity: m.completed ? 0.55 : 1 }}
                    >
                      {format(parseISO(m.scheduledAt), 'HH:mm')} {m.title}
                    </button>
                  );
                })}
                {dayMeetings.length > 3 && (
                  <div className="text-[9px] text-text-muted">+{dayMeetings.length - 3} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
