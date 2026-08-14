import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, Plus, Clock, CheckCircle2, ChevronLeft, ChevronRight,
  Video, Sparkles, LayoutGrid, List as ListIcon, Trash2,
} from 'lucide-react';
import {
  format, parseISO, addDays, startOfWeek, endOfWeek, isToday, isSameDay,
  isAfter, isBefore, isWithinInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Meeting, MeetingType } from '@/types/meeting';
import { useClientStore } from '@/store/useClientStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIDrawerStore } from '@/store/useUIDrawerStore';
import { MeetingDrawer } from '@/components/dashboard/MeetingDrawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { withAlpha } from '@/utils/colorGenerator';
import { toast } from '@/store/useToastStore';
import { genId } from '@/utils/id';
import { ParaleloImportButton } from './ParaleloImportButton';

const TYPE_LABEL: Record<MeetingType, string> = {
  kickoff: 'Kickoff',
  weekly_metrics: 'Métricas semanales',
  content_strategy: 'Estrategia de contenido',
  ads_review: 'Revisión de ads',
  monthly_closing: 'Cierre mensual',
  crisis: 'Crisis',
  weekly_planning: 'Planeación semanal',
  ropre_strategy: 'Estrategia ROPRE & Entregables',
  weekly_closing: 'Sprint de cierre de semana',
  general: 'Reunión general',
  management: 'Reunión de gerencia',
};

const TYPE_TONE: Record<MeetingType, 'info' | 'success' | 'warning' | 'accent' | 'neutral' | 'danger'> = {
  kickoff: 'accent',
  weekly_metrics: 'info',
  content_strategy: 'success',
  ads_review: 'warning',
  monthly_closing: 'neutral',
  crisis: 'danger',
  weekly_planning: 'info',
  ropre_strategy: 'accent',
  weekly_closing: 'success',
  general: 'neutral',
  management: 'accent',
};

// Descripciones que se muestran en el modal "Nueva reunión" al seleccionar tipo.
// Educan al PM sobre qué automatizaciones tiene cada uno.
export const TYPE_DESCRIPTION: Record<MeetingType, string> = {
  kickoff: '🚀 Primera reunión del proyecto. Define objetivos, expectativas y compromisos para los primeros 14 días.',
  weekly_metrics: '📊 Revisión semanal de métricas y avance de tareas. Decisiones de ajuste y prioridades de la próxima semana.',
  content_strategy: '🎬 Pipeline de piezas, aprobaciones, ángulos y calendario de las próximas 2-4 semanas.',
  ads_review: '💰 ROAS por canal, hooks ganadores, A/B tests, decisiones de escala o pausa de campañas.',
  monthly_closing: '📅 Resultados del mes vs proyecciones, lecciones aprendidas y plan del próximo mes.',
  crisis: '🚨 Diagnóstico de causa raíz, plan de mitigación inmediato con responsables y deadline.',
  weekly_planning: '📅 Coordina las tareas de la semana por día y persona. La agenda se genera con tareas pendientes y reuniones programadas.',
  ropre_strategy: '🎯 Sesión estratégica para actualizar el ROPRE y convertir entregables en tareas. El resultado se guarda directamente en el módulo ROPRE.',
  weekly_closing: '🏁 Cierre de la semana: resumen automático de tareas completadas vs pendientes, cumplimiento por persona y compromisos que pasan a la próxima semana.',
  general: '🗣️ Reunión general y esporádica, sin un tema fijo. Para alineaciones puntuales, novedades o temas varios del equipo.',
  management: '🏛️ Reunión de gerencia: sistema y procesos (SOPs), objetivos y KPIs generales de la agencia, y decisiones importantes de dirección.',
};

// Reuniones "internas" = de la agencia (dirección/equipo), no de un cliente.
const INTERNAL_TYPES: ReadonlySet<MeetingType> = new Set(['general', 'management']);
export const isInternalMeeting = (t: MeetingType) => INTERNAL_TYPES.has(t);

export function MeetingsModule({ client, readOnly = false }: { client: Client; readOnly?: boolean }) {
  const allMeetings = useClientStore((s) => s.meetings);
  const meetings = useMemo(
    () => allMeetings.filter((m) => m.clientId === client.id).sort((a, b) => +parseISO(b.scheduledAt) - +parseISO(a.scheduledAt)),
    [allMeetings, client.id],
  );
  const addMeeting = useClientStore((s) => s.addMeeting);
  const deleteMeeting = useClientStore((s) => s.deleteMeeting);
  const openMeeting = useUIDrawerStore((s) => s.openMeeting);
  const meetingId = useUIDrawerStore((s) => s.meetingId);
  const closeMeeting = useUIDrawerStore((s) => s.closeMeeting);
  const activeMeeting = meetingId ? meetings.find((m) => m.id === meetingId) : null;

  const [view, setView] = useState<'list' | 'week'>('list');
  const [fType, setFType] = useState<string>('');
  const [fStatus, setFStatus] = useState<'all' | 'upcoming' | 'past' | 'completed' | 'pending'>('all');
  const [fScope, setFScope] = useState<'all' | 'client' | 'internal'>('all');
  const [creating, setCreating] = useState(false);
  const [defaultType, setDefaultType] = useState<MeetingType>('weekly_metrics');

  // Atajo desde RopreModule empty state — abre el modal con type pre-seleccionado.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const createKey = searchParams.get('create');
    if (createKey === 'ropre') {
      setDefaultType('ropre_strategy');
      setCreating(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    } else if (createKey === 'weekly_planning') {
      setDefaultType('weekly_planning');
      setCreating(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Deep-link ?meeting=<id> (ej. desde el buscador global): abre esa reunión.
  const openedMeetingRef = useRef<string | null>(null);
  useEffect(() => {
    const mid = searchParams.get('meeting');
    if (!mid || openedMeetingRef.current === mid) return;
    if (meetings.some((m) => m.id === mid)) {
      openedMeetingRef.current = mid;
      openMeeting(mid);
      const next = new URLSearchParams(searchParams);
      next.delete('meeting');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, meetings, openMeeting, setSearchParams]);
  const [anchor, setAnchor] = useState(new Date());

  const accent = client.primaryColor;

  const filtered = useMemo(() => {
    const now = new Date();
    return meetings.filter((m) => {
      // La agenda del cliente es siempre del equipo: lo privado vive solo en
      // "Mi agenda privada" de la Agenda Global (S5).
      if (m.esPrivada) return false;
      if (fScope === 'internal' && !isInternalMeeting(m.type)) return false;
      if (fScope === 'client' && isInternalMeeting(m.type)) return false;
      if (fType && m.type !== fType) return false;
      const d = parseISO(m.scheduledAt);
      if (fStatus === 'upcoming' && !isAfter(d, now)) return false;
      if (fStatus === 'past' && !isBefore(d, now)) return false;
      if (fStatus === 'completed' && !m.completed) return false;
      if (fStatus === 'pending' && m.completed) return false;
      return true;
    });
  }, [meetings, fType, fStatus, fScope]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const thisWeek = meetings.filter((m) => isWithinInterval(parseISO(m.scheduledAt), { start: weekStart, end: weekEnd }));
    const upcoming = meetings.filter((m) => isAfter(parseISO(m.scheduledAt), now) && !m.completed);
    const completed = meetings.filter((m) => m.completed);
    const totalMin = meetings.reduce((acc, m) => acc + (m.durationMin ?? 0), 0);
    return { total: meetings.length, thisWeek: thisWeek.length, upcoming: upcoming.length, completed: completed.length, totalHours: Math.round(totalMin / 60) };
  }, [meetings]);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    meetings.forEach((m) => { map[m.type] = (map[m.type] ?? 0) + 1; });
    return map;
  }, [meetings]);

  return (
    <div className="space-y-4">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface p-5"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}88)`, boxShadow: `0 0 20px -4px ${accent}88` }}
            >
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="heading text-xl font-bold">Agenda & Reuniones</h2>
              <p className="text-sm text-text-secondary mt-1">
                {stats.total} reuniones · {stats.upcoming} próximas · {stats.completed} realizadas
              </p>
            </div>
          </div>
          {!readOnly && (
            <div className="flex gap-2 shrink-0">
              <ParaleloImportButton clientId={client.id} />
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> Nueva reunión
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Stat label="Esta semana" value={stats.thisWeek} icon={<Clock className="h-3.5 w-3.5" />} tone="info" />
          <Stat label="Próximas" value={stats.upcoming} icon={<CalendarIcon className="h-3.5 w-3.5" />} tone="accent" />
          <Stat label="Realizadas" value={stats.completed} icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="success" />
          <Stat label="Horas totales" value={`${stats.totalHours}h`} icon={<Clock className="h-3.5 w-3.5" />} tone="neutral" />
        </div>
      </motion.header>

      {Object.keys(byType).length > 0 && (
        <section className="surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Distribución por tipo</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(byType) as MeetingType[]).map((t) => (
              <Badge key={t} tone={TYPE_TONE[t]}>{TYPE_LABEL[t]} · {byType[t]}</Badge>
            ))}
          </div>
        </section>
      )}

      <div className="surface p-3 flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-md border border-border-default overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`h-9 px-3 inline-flex items-center gap-1.5 text-xs ${view === 'list' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            <ListIcon className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            onClick={() => setView('week')}
            className={`h-9 px-3 inline-flex items-center gap-1.5 text-xs border-l border-border-default ${view === 'week' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Semana
          </button>
        </div>
        <Select
          value={fScope}
          onChange={(e) => setFScope(e.target.value as typeof fScope)}
          className="min-w-[150px]"
          options={[
            { value: 'all', label: 'Cliente + internas' },
            { value: 'client', label: '👥 De cliente' },
            { value: 'internal', label: '🏛️ Internas (agencia)' },
          ]}
        />
        <Select
          value={fType}
          onChange={(e) => setFType(e.target.value)}
          className="min-w-[180px]"
          options={[{ value: '', label: 'Todos los tipos' }, ...Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
        />
        <Select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value as typeof fStatus)}
          className="min-w-[160px]"
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'upcoming', label: 'Próximas' },
            { value: 'past', label: 'Pasadas' },
            { value: 'pending', label: 'Pendientes' },
            { value: 'completed', label: 'Realizadas' },
          ]}
        />
        <div className="text-xs text-text-muted ml-auto">
          {filtered.length} reuni{filtered.length === 1 ? 'ón' : 'ones'}
        </div>
      </div>

      {view === 'list' ? (
        <ListView meetings={filtered} accent={accent} onOpen={openMeeting} readOnly={readOnly} onDelete={(m) => {
          if (confirm(`¿Eliminar "${m.title}"?`)) {
            deleteMeeting(m.id);
            toast.success('Reunión eliminada');
          }
        }} />
      ) : (
        <WeekView meetings={filtered} accent={accent} anchor={anchor} setAnchor={setAnchor} onOpen={openMeeting} />
      )}

      {creating && (
        <NewMeetingModal
          clientId={client.id}
          clientName={client.name}
          defaultType={defaultType}
          onClose={() => setCreating(false)}
          onCreate={(m) => {
            addMeeting(m);
            // Abrimos el drawer con auto-gen activado — la agenda se genera sola
            // con todo el contexto del cliente. El PM llega con todo listo.
            openMeeting(m.id, { autoGenAgenda: true });
            toast.success('Reunión creada · generando agenda con IA…');
            setCreating(false);
          }}
        />
      )}


      <AnimatePresence>
        {activeMeeting && <MeetingDrawer meeting={activeMeeting} onClose={closeMeeting} readOnly={readOnly} />}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number | string; icon: React.ReactNode; tone: 'info' | 'accent' | 'success' | 'neutral' }) {
  const colors: Record<typeof tone, string> = {
    info: '#06B6D4',
    accent: '#8B5CF6',
    success: '#10B981',
    neutral: '#9CA3AF',
  };
  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
        <span style={{ color: colors[tone] }}>{icon}</span>
      </div>
      <div className="text-xl font-bold text-text-primary">{value}</div>
    </div>
  );
}

function ListView({ meetings, accent, onOpen, onDelete, readOnly = false }: {
  meetings: Meeting[]; accent: string; onOpen: (id: string) => void; onDelete: (m: Meeting) => void; readOnly?: boolean;
}) {
  if (meetings.length === 0) {
    return (
      <div className="surface p-10 text-center">
        <div className="text-text-muted text-sm mb-1">📅</div>
        <div className="text-text-secondary text-sm">Sin reuniones en este filtro</div>
      </div>
    );
  }
  return (
    <div className="surface overflow-hidden">
      <ul className="divide-y divide-border-subtle/40">
        {meetings.map((m) => {
          const t = parseISO(m.scheduledAt);
          const past = isBefore(t, new Date());
          return (
            <li key={m.id} className="group">
              <div className="flex items-center gap-3 p-3 hover:bg-bg-elevated/30 transition">
                <button
                  onClick={() => onOpen(m.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div
                    className="h-10 w-10 rounded-md flex items-center justify-center shrink-0 text-[10px] uppercase font-bold"
                    style={{
                      background: m.completed ? `${accent}30` : `linear-gradient(135deg, ${withAlpha(accent, 0.22)}, ${withAlpha(accent, 0.08)})`,
                      borderLeft: `2px solid ${accent}`,
                      opacity: m.completed ? 0.55 : 1,
                    }}
                  >
                    <div className="text-center leading-tight">
                      <div className="text-text-primary">{format(t, 'd')}</div>
                      <div className="text-[8px] text-text-muted">{format(t, 'MMM', { locale: es })}</div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary truncate">{m.title}</span>
                      {m.completed && <Badge tone="success">✓ Realizada</Badge>}
                      {!m.completed && past && <Badge tone="warning">Pasada</Badge>}
                      {m.videoCallLink && <Video className="h-3 w-3 text-text-muted" />}
                      {m.agenda && <Sparkles className="h-3 w-3 text-text-muted" />}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                      <span>{format(t, "EEE d 'de' MMM · HH:mm", { locale: es })}</span>
                      <span>·</span>
                      <span>{m.durationMin} min</span>
                      <span>·</span>
                      <Badge tone={TYPE_TONE[m.type]}>{TYPE_LABEL[m.type]}</Badge>
                      {isInternalMeeting(m.type) && <Badge tone="accent">🏛️ Interna</Badge>}
                      {m.participants && m.participants.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{m.participants.length} participante{m.participants.length === 1 ? '' : 's'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
                {!readOnly && (
                  <button
                    onClick={() => onDelete(m)}
                    title="Eliminar"
                    className="opacity-0 group-hover:opacity-100 transition h-8 w-8 inline-flex items-center justify-center rounded-md text-text-muted hover:text-status-danger hover:bg-status-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WeekView({ meetings, accent, anchor, setAnchor, onOpen }: {
  meetings: Meeting[]; accent: string; anchor: Date; setAnchor: (d: Date) => void; onOpen: (id: string) => void;
}) {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <section className="surface p-4">
      <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-[11px] uppercase tracking-wider text-text-muted">
          Semana del {format(weekStart, "d MMM", { locale: es })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
        </div>
        <div className="inline-flex items-center gap-1">
          <button onClick={() => setAnchor(addDays(anchor, -7))} className="h-7 w-7 rounded-md border border-border-subtle text-text-secondary hover:text-text-primary inline-flex items-center justify-center">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setAnchor(new Date())} className="h-7 px-2 rounded-md border border-border-subtle text-xs text-text-secondary hover:text-text-primary">
            Hoy
          </button>
          <button onClick={() => setAnchor(addDays(anchor, 7))} className="h-7 w-7 rounded-md border border-border-subtle text-text-secondary hover:text-text-primary inline-flex items-center justify-center">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayMeetings = meetings.filter((m) => isSameDay(parseISO(m.scheduledAt), day));
          return (
            <div
              key={day.toISOString()}
              className={`rounded-md border p-2 min-h-[160px] ${
                isToday(day) ? 'border-accent-violet/40 bg-accent-violet/5' : 'border-border-subtle bg-bg-base/30'
              }`}
            >
              <div className="mb-2">
                <div className="text-[9px] uppercase tracking-wider text-text-muted">{format(day, 'EEE', { locale: es })}</div>
                <div className={`text-sm font-semibold ${isToday(day) ? 'text-accent-violet' : 'text-text-primary'}`}>{format(day, 'd')}</div>
              </div>
              <div className="space-y-1">
                {dayMeetings.length === 0 ? (
                  <div className="text-[10px] text-text-muted opacity-50 italic">—</div>
                ) : (
                  dayMeetings.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onOpen(m.id)}
                      className="w-full text-left rounded p-1.5 transition hover:brightness-125"
                      style={{
                        background: `linear-gradient(135deg, ${withAlpha(accent, 0.22)}, ${withAlpha(accent, 0.08)})`,
                        borderLeft: `2px solid ${accent}`,
                        opacity: m.completed ? 0.55 : 1,
                      }}
                      title={m.title}
                    >
                      <div className="text-[10px] font-semibold text-text-primary truncate">
                        {format(parseISO(m.scheduledAt), 'HH:mm')} · {m.title}
                      </div>
                      <div className="text-[9px] text-text-muted truncate">{TYPE_LABEL[m.type]}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NewMeetingModal({ clientId, clientName, defaultType = 'weekly_metrics', onClose, onCreate }: {
  clientId: string; clientName: string; defaultType?: MeetingType; onClose: () => void; onCreate: (m: Meeting) => void;
}) {
  const [type, setType] = useState<MeetingType>(defaultType);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(45);
  const [link, setLink] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [esPrivada, setEsPrivada] = useState(false);
  const authUserId = useAuthStore((s) => s.user?.id);

  // Título auto-generado a partir de tipo + cliente + fecha.
  // Si el usuario lo edita manualmente (titleTouched), respetamos su valor.
  const autoTitle = `${TYPE_LABEL[type]} — ${clientName} — ${format(parseISO(`${date}T00:00:00`), "d MMM yyyy", { locale: es })}`;
  const [title, setTitle] = useState(autoTitle);
  // Actualiza auto-title cuando cambian tipo/fecha y el usuario no lo ha editado a mano.
  if (!titleTouched && title !== autoTitle) {
    setTitle(autoTitle);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    const meeting: Meeting = {
      id: genId(),
      clientId,
      title: title.trim(),
      type,
      scheduledAt,
      durationMin: duration,
      participants: [],
      videoCallLink: link.trim() || undefined,
      completed: false,
      esPrivada,
      // Sin dueño la fila sería invisible para todos (CHECK de la 030).
      propietarioId: esPrivada ? authUserId : undefined,
    };
    onCreate(meeting);
  }

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Nueva reunión</span>}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Tipo</span>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as MeetingType)}
            options={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          />
          <div className="mt-1.5 text-[11px] text-text-muted leading-relaxed">{TYPE_DESCRIPTION[type]}</div>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Título *</span>
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
            placeholder="Ej: Revisión semanal de métricas"
            required
          />
          {!titleTouched && (
            <div className="text-[10px] text-text-muted mt-1">Auto-generado · puedes editarlo</div>
          )}
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Fecha</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Hora</span>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Duración (min)</span>
            <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10) || 30)} required />
          </label>
        </div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Link videollamada (opcional)</span>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." />
        </label>
        <label className="flex items-start gap-2.5 rounded-lg border border-border-subtle px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={esPrivada}
            onChange={(e) => setEsPrivada(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent-violet"
          />
          <span>
            <span className="block text-xs font-medium text-text-primary">🔒 Reunión privada (solo yo la veo)</span>
            <span className="block text-[11px] text-text-secondary mt-0.5">
              No aparece en la agenda del equipo ni en los reportes.
            </span>
          </span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Crear reunión</Button>
        </div>
      </form>
    </Modal>
  );
}
