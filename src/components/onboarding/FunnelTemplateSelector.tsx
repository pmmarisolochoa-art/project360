import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FUNNEL_TEMPLATES } from '@/data/funnelTemplates';
import type { FunnelTemplate, FunnelTemplateKey } from '@/types/funnel';
import { cn } from '@/utils/cn';

type Props = {
  clientName: string;
  accentColor: string;
  onConfirm: (templateKey: FunnelTemplateKey) => void;
  onSkip: () => void;
};

/**
 * Pantalla post-onboarding: pregunta qué tipo de proyecto va a gestionar.
 * 4 cards (las 4 plantillas) + "Omitir por ahora".
 *
 * Al seleccionar una card, expande un preview con el conteo de fases y
 * tareas que se van a crear. Al confirmar, llama a onConfirm(templateKey)
 * — el padre se encarga de materializar y de mostrar el progress bar.
 */
export function FunnelTemplateSelector({ clientName, accentColor, onConfirm, onSkip }: Props) {
  const [selected, setSelected] = useState<FunnelTemplateKey | null>(null);
  const selectedTemplate = selected ? FUNNEL_TEMPLATES.find((t) => t.key === selected) ?? null : null;

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-6">
      <header className="space-y-2 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
          Último paso · {clientName}
        </div>
        <h1 className="heading text-3xl font-bold">
          ¿Qué tipo de proyecto vas a gestionar?
        </h1>
        <p className="text-sm text-text-secondary">
          Elige el sistema de ventas y armamos el roadmap de tareas automáticamente.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FUNNEL_TEMPLATES.map((tpl) => (
          <TemplateCard
            key={tpl.key}
            template={tpl}
            isSelected={selected === tpl.key}
            accentColor={accentColor}
            onClick={() => setSelected(tpl.key)}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedTemplate && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="surface p-5 border-2"
            style={{ borderColor: accentColor }}
          >
            <TemplatePreview template={selectedTemplate} accentColor={accentColor} />
            <div className="flex items-center justify-end mt-4">
              <Button
                size="md"
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={() => onConfirm(selectedTemplate.key)}
              >
                Crear cliente con este embudo
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-center pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-text-muted hover:text-text-secondary underline-offset-4 hover:underline transition"
        >
          Omitir por ahora · elegir embudo más tarde
        </button>
      </div>
    </div>
  );
}

function TemplateCard({
  template, isSelected, accentColor, onClick,
}: {
  template: FunnelTemplate;
  isSelected: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative text-left rounded-[14px] border p-4 transition-all',
        'hover:brightness-[1.05] hover:-translate-y-0.5',
        isSelected
          ? 'shadow-lg'
          : 'border-border-subtle hover:border-border-default',
      )}
      style={{
        background: 'var(--surface-bg)',
        borderColor: isSelected ? accentColor : undefined,
        boxShadow: isSelected ? `0 0 0 1px ${accentColor}, 0 12px 30px -12px ${accentColor}66` : undefined,
      }}
    >
      {isSelected && (
        <span
          className="absolute top-3 right-3 h-6 w-6 rounded-full flex items-center justify-center text-white"
          style={{ background: accentColor }}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="text-3xl mb-2">{template.emoji}</div>
      <div className="font-semibold text-text-primary mb-1">{template.name}</div>
      <div className="text-xs text-text-secondary leading-relaxed">
        {template.shortDescription}
      </div>
    </button>
  );
}

function TemplatePreview({ template }: { template: FunnelTemplate; accentColor: string }) {
  const totalTasks = template.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm text-text-secondary">
            Se crearán <strong className="text-text-primary">{totalTasks} tareas</strong> en{' '}
            <strong className="text-text-primary">{template.phases.length} fases</strong>:
          </div>
        </div>
        <div className="text-xs text-text-muted">
          Duración estimada: <strong>{template.estimatedDays.min}–{template.estimatedDays.max} días</strong>
        </div>
      </div>
      <ul className="space-y-1.5">
        {template.phases.map((phase, idx) => (
          <li
            key={phase.name}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-xs"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <span
              className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
              style={{ background: phase.color }}
            >
              {idx + 1}
            </span>
            <span className="flex-1 text-text-primary truncate">{phase.name}</span>
            <span className="text-text-muted text-[11px] shrink-0">
              {phase.tasks.length} tarea{phase.tasks.length === 1 ? '' : 's'} · días {phase.dayStart}–{phase.dayEnd}
            </span>
          </li>
        ))}
      </ul>
      <div className="text-[11px] text-text-muted text-center pt-1">
        Podrás ajustar fechas, responsables y tareas en cualquier momento.
      </div>
    </div>
  );
}

/* ─────────────────────── Progress bar de creación ─────────────────────── */

export function FunnelCreationProgress({
  templateName, accentColor,
}: { templateName: string; accentColor: string }) {
  return (
    <div className="max-w-md mx-auto p-8 text-center space-y-5">
      <div
        className="h-14 w-14 rounded-full mx-auto flex items-center justify-center"
        style={{ background: accentColor }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
          className="h-7 w-7 border-2 border-white border-t-transparent rounded-full"
        />
      </div>
      <div>
        <div className="heading text-xl font-semibold mb-1">Creando tu embudo</div>
        <div className="text-sm text-text-secondary">
          {templateName}
        </div>
      </div>
      <div className="text-xs text-text-muted">
        Generando fases, tareas, responsables y fechas…
      </div>
    </div>
  );
}
