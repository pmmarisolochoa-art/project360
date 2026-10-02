/**
 * Botón "Importar de Fathom" — solo aparece si el cliente está habilitado en
 * `src/config/fathom.ts`. A diferencia de Paralelo, Fathom no tiene
 * "proyectos": se usa directo con el nombre del cliente.
 */

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FATHOM_CLIENTES } from '@/config/fathom';
import { FathomImportModal } from './FathomImportModal';

interface Props {
  clientId: string;
  clienteNombre: string;
  variant?: 'primary' | 'ghost';
}

export function FathomImportButton({ clientId, clienteNombre, variant = 'ghost' }: Props) {
  const [abierto, setAbierto] = useState(false);

  const habilitado = FATHOM_CLIENTES.some(
    (c) => c.cliente.trim().toLowerCase() === clienteNombre.trim().toLowerCase(),
  );
  if (!habilitado) return null;

  return (
    <>
      <Button variant={variant} onClick={() => setAbierto(true)}>
        <Download className="h-4 w-4" /> Importar de Fathom
      </Button>
      <FathomImportModal
        open={abierto}
        onClose={() => setAbierto(false)}
        clientId={clientId}
        clienteNombre={clienteNombre}
      />
    </>
  );
}
