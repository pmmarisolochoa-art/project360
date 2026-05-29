import type { FormEventHandler, ReactNode } from 'react';

interface Props {
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}

/**
 * Contenedor común de cada paso del wizard.
 * El formulario se envía vía evento `submit` desde el botón del wizard
 * (id="onboarding-step-form") para mantener la lógica de submit dentro del paso.
 */
export function StepShell({ onSubmit, children }: Props) {
  return (
    <form id="onboarding-step-form" onSubmit={onSubmit} className="space-y-5">
      {children}
    </form>
  );
}
