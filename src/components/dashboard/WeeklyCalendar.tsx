import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Check } from 'lucide-react';
import {
  startOfWeek,
  addDays,
  format,
  parseISO,
  isSameDay,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useClientStore } from '@/store/useClientStore';
import { useUIDrawerStore } from '@/store/useUIDrawerStore';
import { withAlpha } from '@/utils/colorGenerator';
import { IntegrationsModal } from './IntegrationsModal';

const dayWindow = 7;
const hourStart = 8;
const hourEnd = 20;

export function WeeklyCalendar() {
  const meetings = useClientStore((s) => s.meetings);
  const clients = useClientStore((s) => s.clients);
  const openMeeting = useUIDrawerStore((s) => s.openMeeting);
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: dayWindow }, (_, i) => addDays(weekStart, i));

  return (
    <section className="surface p-5">
      <header className="flex items-end justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="heading text-lg font-bold">Agenda semanal global</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Reuniones de todos los clientes — codificadas por color
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-text-muted">
            {format(weekStart, "d MMM", { locale: es })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
          </span>
          <button
            onClick={() => setIntegrationsOpen(true)}
            aria-label="Configurar integraciones"
            title="Configurar integraciones de agenda"
            className="h-8 w-8 rounded-md border border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-hover transition inline-flex items-center justify-center"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, di) => {
          const dayMeetings = meetings.filter((m) => isSameDay(parseISO(m.scheduledAt), day));
          return (
            <motion.div
              key={day.toISOString()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: di * 0.04 }}
              className={`rounded-[10px] border p-2 min-h-[160px] ${
                isToday(day)
                  ? 'border-accent-violet/40 bg-accent-violet/5'
                  : 'border-border-subtle bg-bg-base/30'
              }`}
            >
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  {format(day, 'EEE', { locale: es })}
                </div>
                <div
                  className={`text-sm font-semibold ${
                    isToday(day) ? 'text-accent-violet' : 'text-text-primary'
                  }`}
                >
                  {format(day, 'd')}
                </div>
              </div>

              <div className="space-y-1.5">
                {dayMeetings.length === 0 ? (
                  <div className="text-[10px] text-text-muted opacity-50 italic">Sin reuniones</div>
                ) : (
                  dayMeetings.map((m) => {
                    const client = clientById[m.clientId];
                    const accent = client?.primaryColor ?? '#8B5CF6';
                    const t = parseISO(m.scheduledAt);
                    const hour = t.getHours() + t.getMinutes() / 60;
                    const intensity = Math.max(0, Math.min(1, (hour - hourStart) / (hourEnd - hourStart)));
                    const done = !!m.completed;
                    return (
                      <button
                        key={m.id}
                        onClick={() => openMeeting(m.id)}
                        className="relative w-full text-left rounded-md p-1.5 transition hover:brightness-125 focus-ring"
                        style={{
                          background: `linear-gradient(135deg, ${withAlpha(accent, 0.22)}, ${withAlpha(accent, 0.08)})`,
                          borderLeft: `2px solid ${accent}`,
                          opacity: done ? 0.55 : 0.7 + intensity * 0.3,
                        }}
                        title={`${client?.name} · ${m.title}`}
                      >
                        {done && (
                          <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-status-success flex items-center justify-center">
                            <Check className="h-2 w-2 text-white" />
                          </span>
                        )}
                        <div className="text-[10px] font-semibold text-text-primary truncate">
                          {format(t, 'HH:mm')} · {m.title}
                        </div>
                        <div className="text-[10px] text-text-muted truncate">{client?.name}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <IntegrationsModal open={integrationsOpen} onClose={() => setIntegrationsOpen(false)} />
    </section>
  );
}
