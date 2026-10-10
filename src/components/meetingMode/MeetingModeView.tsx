import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { MEETING_TEMPLATES, type MeetingTemplateId, type MeetingSlideStep } from '@/config/meetingTemplates';
import type { Meeting } from '@/types/meeting';
import { useClientStore } from '@/store/useClientStore';
import { withAlpha } from '@/utils/colorGenerator';
import { useMeetingTimer, formatElapsed } from './useMeetingTimer';
import { SlideBody } from './slides/SlideBody';

/**
 * Modo Reunión — presentación a pantalla completa, paso a paso.
 *
 * Navegación + plantillas + temporizador; las notas por paso se guardan con
 * la reunión (`meeting.modoReunionNotas`, migración 063). Las diapositivas de
 * revisión (tareas reales, contexto, cierre→tareas) jalan datos reales en
 * `slides/`.
 */
export function MeetingModeView({
  meeting,
  initialTemplate,
  onClose,
}: {
  meeting: Meeting;
  initialTemplate: MeetingTemplateId;
  onClose: () => void;
}) {
  const updateMeeting = useClientStore((s) => s.updateMeeting);
  const template = MEETING_TEMPLATES[initialTemplate];
  const [stepIndex, setStepIndex] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>(meeting.modoReunionNotas ?? {});

  // Auto-guarda las notas con la reunión (debounce 2s) — mismo patrón que las
  // notas del drawer (`MeetingDrawer.tsx`).
  const savedNotesRef = useRef(meeting.modoReunionNotas ?? {});
  useEffect(() => {
    if (notes === savedNotesRef.current) return;
    const t = setTimeout(() => {
      updateMeeting(meeting.id, { modoReunionNotas: notes });
      savedNotesRef.current = notes;
    }, 2000);
    return () => clearTimeout(t);
  }, [notes, meeting.id, updateMeeting]);

  const step: MeetingSlideStep = template.pasos[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === template.pasos.length - 1;

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(template.pasos.length - 1, i + 1));

  // Al cerrar no se espera el debounce: si quedó algo sin guardar, se guarda ya.
  const closeAndFlush = () => {
    if (notes !== savedNotesRef.current) updateMeeting(meeting.id, { modoReunionNotas: notes });
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') closeAndFlush();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const elapsedSec = useMeetingTimer(step.id);
  const overTime = elapsedSec > step.minutos * 60;

  const accent = template.color;
  const accentSoft = useMemo(() => withAlpha(accent, 0.12), [accent]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-bg-base text-text-primary">
      {/* Header: progreso + tipo + cerrar */}
      <div className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold uppercase tracking-wider"
            style={{ background: accentSoft, color: accent }}
          >
            {template.nombre}
          </span>
          <span className="text-sm text-text-muted">
            Paso {stepIndex + 1} de {template.pasos.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="inline-flex items-center gap-1.5 text-sm tabular-nums"
            style={{ color: overTime ? '#F59E0B' : 'var(--text-secondary)' }}
          >
            <Clock className="h-4 w-4" />
            {formatElapsed(elapsedSec)}
            <span className="text-text-muted">/ {step.minutos} min sugeridos</span>
          </div>
          <button
            onClick={closeAndFlush}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Cerrar Modo Reunión"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-1 bg-bg-elevated">
        <div
          className="h-full transition-all"
          style={{ width: `${((stepIndex + 1) / template.pasos.length) * 100}%`, background: accent }}
        />
      </div>

      {/* Cuerpo de la diapositiva */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-10 lg:py-16">
          <h1 className="font-display text-3xl lg:text-5xl font-semibold mb-2">{step.titulo}</h1>
          {step.prompt && <p className="text-lg lg:text-xl text-text-secondary mb-10">{step.prompt}</p>}

          <SlideBody step={step} clientId={meeting.clientId} meeting={meeting} accent={accent} />

          <div className="mt-10">
            <label className="block text-xs uppercase tracking-wider text-text-muted mb-2">Notas rápidas</label>
            <textarea
              value={notes[step.id] ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [step.id]: e.target.value }))}
              placeholder="Lo que se dijo, se decidió o hay que recordar de este paso…"
              className="w-full min-h-[100px] rounded-[10px] border border-border-default bg-bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus-ring resize-y"
            />
          </div>
        </div>
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between px-6 lg:px-10 py-4 border-t border-border-subtle">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[10px] text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>

        <div className="flex items-center gap-1.5">
          {template.pasos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setStepIndex(i)}
              aria-label={`Ir al paso ${i + 1}: ${p.titulo}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === stepIndex ? 24 : 8,
                background: i === stepIndex ? accent : 'var(--border-strong)',
              }}
            />
          ))}
        </div>

        <button
          onClick={isLast ? closeAndFlush : goNext}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[10px] text-sm font-medium text-white transition-all hover:brightness-110"
          style={{ background: accent }}
        >
          {isLast ? 'Terminar' : 'Siguiente'} {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
