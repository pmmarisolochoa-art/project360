import { useState } from 'react';
import type { Client } from '@/types/client';
import { clientSigla } from '@/utils/sigla';
import { cn } from '@/utils/cn';

/**
 * Logo del cliente si existe (`onboardingData.identity.logoUrl`), con la
 * sigla de siempre como respaldo si no hay URL o si la imagen falla al cargar.
 * Mismo componente en header del cerebro y tarjeta de Clientes — un solo sitio
 * que decide "¿hay logo o no?" para que no diverjan.
 */
export function ClientLogo({
  client, accent, className, textClassName,
}: {
  client: Client;
  accent: string;
  className?: string;
  textClassName?: string;
}) {
  const logoUrl = client.onboardingData.identity?.logoUrl?.trim();
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${client.name}`}
        onError={() => setFailed(true)}
        className={cn('object-contain rounded-md bg-white shrink-0', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-bold text-white shrink-0 rounded-md',
        className, textClassName,
      )}
      style={{ background: accent }}
      title={`Sigla de ${client.name}`}
    >
      {clientSigla(client)}
    </span>
  );
}
