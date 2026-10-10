import { ListChecks, AlertTriangle, Target, FileText, CheckCircle2, ClipboardList, Smile, Frown, Lightbulb, History, CalendarCheck2 } from 'lucide-react';
import type { MeetingSlideStep, SlideKind } from '@/config/meetingTemplates';
import type { Meeting } from '@/types/meeting';
import { ReviewTasksSlide } from './ReviewTasksSlide';
import { ContextSlide } from './ContextSlide';
import { ClosingSlide } from './ClosingSlide';
import { WeekRecapSlide } from './WeekRecapSlide';

/**
 * Cuerpo visual de cada tipo de paso.
 *
 * `week_recap`, `review_tasks`, `context` y `closing` jalan datos reales
 * (tareas, reuniones, cliente). El resto sigue siendo captura guiada con
 * notas — no pedían datos reales, solo estructura.
 */
const ICON_BY_KIND: Record<SlideKind, typeof ListChecks> = {
  intro: Target,
  week_recap: CalendarCheck2,
  context: FileText,
  review_tasks: ListChecks,
  blockers: AlertTriangle,
  topics: ClipboardList,
  decisions: CheckCircle2,
  action_plan: ListChecks,
  priorities: Target,
  retro_question: Smile,
  retro_actions: Lightbulb,
  retro_previous: History,
  closing: CheckCircle2,
};

const PLACEHOLDER_TEXT: Record<SlideKind, string> = {
  intro: 'Aquí se escribe el objetivo del encuentro en voz alta antes de arrancar.',
  week_recap: '',
  context: '',
  review_tasks: '',
  blockers: 'Para cada bloqueo: qué se necesita y de quién depende.',
  topics: 'Máximo 3 temas. Asigna un tiempo a cada uno antes de empezar a hablar.',
  decisions: 'Escribe la decisión tal como se dijo — no la intención, la decisión.',
  action_plan: 'Próximamente: convertir cada acción en una tarea real con responsable y fecha.',
  priorities: 'Lo que SÍ se hace esta semana — y lo que conscientemente se deja de lado.',
  retro_question: 'Una idea por persona. Sin interrumpir, sin justificar.',
  retro_actions: 'Máximo 3 acciones. Cada una necesita un responsable, o no sirve.',
  retro_previous: 'Próximamente: las acciones de la retro anterior, con su estado real.',
  closing: '',
};

export function SlideBody({
  step,
  clientId,
  meeting,
  accent,
}: {
  step: MeetingSlideStep;
  clientId: string;
  meeting: Meeting;
  accent: string;
}) {
  if (step.kind === 'week_recap') return <WeekRecapSlide meeting={meeting} accent={accent} />;
  if (step.kind === 'review_tasks') return <ReviewTasksSlide clientId={clientId} accent={accent} />;
  if (step.kind === 'context') return <ContextSlide clientId={clientId} accent={accent} />;
  if (step.kind === 'closing') return <ClosingSlide meeting={meeting} accent={accent} />;

  const Icon = ICON_BY_KIND[step.kind];
  const RetroIcon = step.id === 'mal' ? Frown : Icon;

  return (
    <div
      className="rounded-[14px] border border-border-default border-dashed p-8 lg:p-12 flex items-center gap-5"
      style={{ background: 'var(--bg-surface)' }}
    >
      <RetroIcon className="h-8 w-8 flex-shrink-0" style={{ color: accent }} />
      <p className="text-base lg:text-lg text-text-secondary">{PLACEHOLDER_TEXT[step.kind]}</p>
    </div>
  );
}
