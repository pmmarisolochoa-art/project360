import type { ReactNode } from 'react';

/**
 * Estado vacío reutilizable para módulos sin datos. Texto en español,
 * tono cálido (emoji opcional), 1-2 botones de acción primaria.
 *
 * Uso típico: cuando un módulo no tiene tareas / reuniones / embudos
 * y queremos guiar al usuario hacia la acción siguiente sin que vea
 * una pantalla en blanco o "Sin datos" críptico.
 */

interface Props {
  emoji?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({ emoji, title, description, actions, className }: Props) {
  return (
    <div className={`surface p-8 text-center space-y-3 ${className ?? ''}`}>
      {emoji && <div className="text-4xl">{emoji}</div>}
      <h3 className="heading text-base font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {actions && (
        <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
