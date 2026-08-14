/**
 * Botón "Importar de Paralelo" — punto de entrada reutilizable.
 *
 * Existe porque la importación se pide desde DOS sitios y no pueden divergir:
 *
 *   - Dentro del cerebro de un cliente (Agenda): el cliente ya está decidido.
 *   - En la vista global de Tareas: no hay cliente, así que hay que elegir de
 *     qué proyecto de Paralelo se trae.
 *
 * El puente entre los dos mundos se declara por NOMBRE en `PARALELO_PROYECTOS`
 * (los UUID cambian entre local y producción). Aquí ese nombre se resuelve
 * contra los clientes cargados: si no aparece ninguno, el botón lo dice en vez
 * de abrir una bandeja que no podría escribir en ningún lado.
 */

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useClientStore } from '@/store/useClientStore';
import { PARALELO_PROYECTOS } from '@/config/paralelo';
import { ParaleloImportModal } from './ParaleloImportModal';

interface Props {
  /**
   * Si se pasa, el botón importa SOLO de ese cliente (uso dentro del cerebro).
   * Si se omite, ofrece todos los proyectos habilitados (uso en la vista global).
   */
  clientId?: string;
  variant?: 'primary' | 'ghost';
}

export function ParaleloImportButton({ clientId, variant = 'ghost' }: Props) {
  const clients = useClientStore((s) => s.clients);
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);

  /**
   * Proyectos de Paralelo que además existen como cliente cargado.
   *
   * OJO si alguna vez "no sale el botón donde debería": el nombre del cliente
   * en Project360 tiene que coincidir EXACTO con el de `PARALELO_PROYECTOS`.
   */
  const disponibles = useMemo(() => {
    const porNombre = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c]));
    return PARALELO_PROYECTOS.map((p) => ({
      ...p,
      client: porNombre.get(p.cliente.trim().toLowerCase()),
    }))
      .filter((p) => p.client)
      .filter((p) => !clientId || p.client!.id === clientId);
  }, [clients, clientId]);

  // Sin proyectos que apliquen, el botón no existe. Un botón que solo puede
  // fallar es peor que no tenerlo.
  if (disponibles.length === 0) return null;

  const abrir = () => {
    if (disponibles.length === 1) {
      setElegido(disponibles[0].projectId);
      setAbierto(true);
      return;
    }
    // Con varios habilitados hace falta elegir. Se resuelve con el selector de
    // abajo en vez de adivinar: importar al cliente equivocado es de lo más
    // caro de deshacer (hay que borrar reunión y tareas a mano).
    setElegido(null);
    setAbierto(true);
  };

  const activo = disponibles.find((p) => p.projectId === elegido);

  return (
    <>
      <Button variant={variant} onClick={abrir}>
        <Download className="h-4 w-4" /> Importar de Paralelo
      </Button>

      {/* Selección de proyecto: solo aparece si hay más de uno habilitado. */}
      {abierto && !activo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm" onClick={() => setAbierto(false)} />
          <div className="surface relative p-5 w-full max-w-sm space-y-3">
            <h3 className="heading text-base font-bold">¿De qué cliente?</h3>
            <p className="text-xs text-text-secondary">
              Paralelo organiza por proyecto. Elige a cuál cliente entran las reuniones.
            </p>
            <div className="space-y-1.5">
              {disponibles.map((p) => (
                <button
                  key={p.projectId}
                  type="button"
                  onClick={() => setElegido(p.projectId)}
                  className="w-full text-left rounded-[10px] border border-border-subtle hover:border-accent/50 px-3 py-2.5 text-sm text-text-primary transition-colors"
                >
                  {p.cliente}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {activo && (
        <ParaleloImportModal
          open={abierto}
          onClose={() => {
            setAbierto(false);
            setElegido(null);
          }}
          clientId={activo.client!.id}
          clienteNombre={activo.client!.name}
          projectId={activo.projectId}
        />
      )}
    </>
  );
}
