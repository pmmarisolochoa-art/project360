import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, History, CheckCircle2, Clock, AlertTriangle, HelpCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Meeting } from '@/types/meeting';
import type { Task } from '@/types/task';
import { withAlpha } from '@/utils/colorGenerator';

type Estado = 'cumplida' | 'vencida' | 'pendiente' | 'sin-registro';

const ESTADO_META: Record<Estado, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  cumplida: { label: 'Cumplida', color: '#16a34a', Icon: CheckCircle2 },
  vencida: { label: 'Vencida', color: '#dc2626', Icon: AlertTriangle },
  pendiente: { label: 'Pendiente', color: '#d97706', Icon: Clock },
  'sin-registro': { label: 'Sin registro', color: '#94a3b8', Icon: HelpCircle },
};

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Recuento enlazado: al abrir una reunión, muestra los compromisos de la reunión
 * ANTERIOR del mismo cliente y su estado actual (resuelto contra las tareas vivas
 * por coincidencia de título). Sirve para hacerle seguimiento a lo que quedó
 * pendiente antes de empezar la reunión de hoy. No consume tokens.
 */
export function MeetingRecap({
  meeting, allMeetings, tasks, accent,
}: {
  meeting: Meeting;
  allMeetings: Meeting[];
  tasks: Task[];
  accent: string;
}) {
  const [open, setOpen] = useState(true);

  const prev = useMemo(() => {
    return allMeetings
      .filter((m) => m.clientId === meeting.clientId && m.id !== meeting.id
        && new Date(m.scheduledAt) < new Date(meeting.scheduledAt))
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0] ?? null;
  }, [allMeetings, meeting.clientId, meeting.id, meeting.scheduledAt]);

  const items = useMemo(() => {
    if (!prev?.extractedTasks?.length) return [];
    const now = Date.now();
    // Índice de tareas vivas del cliente por título normalizado.
    const byTitle = new Map<string, Task>();
    for (const t of tasks) {
      if (t.clientId !== meeting.clientId) continue;
      byTitle.set(norm(t.title), t);
    }
    return prev.extractedTasks.map((c) => {
      const match = byTitle.get(norm(c.title));
      let estado: Estado;
      if (!match) estado = 'sin-registro';
      else if (match.status === 'completed') estado = 'cumplida';
      else if (match.isDelayed || new Date(match.dueDate).getTime() < now) estado = 'vencida';
      else estado = 'pendiente';
      return { title: c.title, responsible: c.responsibleRole, estado };
    });
  }, [prev, tasks, meeting.clientId]);

  if (!prev) return null;

  const total = items.length;
  const cumplidas = items.filter((i) => i.estado === 'cumplida').length;
  const vencidas = items.filter((i) => i.estado === 'vencida').length;
  const pendientes = items.filter((i) => i.estado === 'pendiente').length;
  const abiertas = vencidas + pendientes;

  return (
    <section className="rounded-lg border" style={{ borderColor: withAlpha(accent, 0.3), background: withAlpha(accent, 0.05) }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />}
        <History className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
        <span className="text-xs font-semibold" style={{ color: accent }}>Recuento de la reunión anterior</span>
        {total > 0 && (
          <span className="ml-auto text-[11px] font-medium text-text-secondary">
            {cumplidas}/{total} cumplidos{abiertas > 0 ? ` · ${abiertas} por revisar` : ''}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3">
          <p className="text-[11px] text-text-muted mb-2">
            {prev.title} · {format(parseISO(prev.scheduledAt), "d 'de' MMM, yyyy", { locale: es })}
          </p>

          {total === 0 ? (
            <p className="text-xs text-text-muted italic">La reunión anterior no dejó compromisos registrados.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((it, i) => {
                const m = ESTADO_META[it.estado];
                return (
                  <li key={i} className="flex items-start gap-2 rounded-md bg-bg-surface/60 border border-border-subtle px-2.5 py-1.5">
                    <m.Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: m.color }} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs ${it.estado === 'cumplida' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {it.title}
                      </div>
                      <div className="text-[10px] text-text-muted">{it.responsible}</div>
                    </div>
                    <span className="text-[10px] font-medium shrink-0 mt-0.5" style={{ color: m.color }}>{m.label}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {abiertas > 0 && (
            <p className="mt-2 text-[11px] font-medium" style={{ color: accent }}>
              👉 Da seguimiento a {abiertas} compromiso{abiertas === 1 ? '' : 's'} que sigue{abiertas === 1 ? '' : 'n'} abierto{abiertas === 1 ? '' : 's'}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
