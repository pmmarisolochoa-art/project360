/**
 * Bandeja para limpiar leads importados por CSV que se quedaron en "Nuevo" —
 * pedido de la founder (04-oct-2026) para poder reimportar el Excel limpio
 * y que quede bien actualizado, sin duplicar lo que vino por la API/webhook.
 *
 * Identidad del origen: el primer evento del "viaje del lead" (creado al
 * importar, ver `ImportarLeadsCSVModal.tsx`) trae `nota: 'Importado desde CSV'`.
 * Los que llegan por `api/v1/leads` no tienen ese evento/nota, así que se
 * distinguen por su ausencia — no hay campo dedicado de origen hoy.
 *
 * Solo entran candidatos en etapa 'nuevo': uno que ya avanzó en el pipeline
 * (contactado, agendado, ganado…) significa trabajo real encima — borrarlo
 * se llevaría ese trabajo, y no es lo que se pidió ("solo los que dice nuevo").
 */

import { useMemo, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/useToastStore';
import { useLeadsStore } from '@/store/useLeadsStore';
import type { Lead } from '@/types/lead';

export function LeadsCSVLimpiarModal({
  open, onClose, clientId,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
}) {
  const allLeads = useLeadsStore((s) => s.leads);
  const allEvents = useLeadsStore((s) => s.events);
  const removeLead = useLeadsStore((s) => s.remove);

  const candidatos = useMemo(() => {
    const porLead = new Map<string, boolean>(); // leadId -> vino de CSV
    for (const e of allEvents) {
      if (e.nota === 'Importado desde CSV') porLead.set(e.leadId, true);
    }
    return allLeads
      .filter((l) => l.clientId === clientId && l.etapa === 'nuevo' && porLead.get(l.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [allLeads, allEvents, clientId]);

  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(candidatos.map((l) => l.id)));
  const [eliminando, setEliminando] = useState(false);

  const alternar = (id: string) =>
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const eliminar = async () => {
    if (marcados.size === 0) return;
    setEliminando(true);
    try {
      for (const id of marcados) removeLead(id);
      toast.success(`${marcados.size} lead${marcados.size === 1 ? '' : 's'} eliminado${marcados.size === 1 ? '' : 's'} — listo para reimportar.`);
      onClose();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={'🧹 Limpiar leads de CSV en "Nuevo"'}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-xs text-text-muted">
            {marcados.size} de {candidatos.length} marcado{marcados.size === 1 ? '' : 's'}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={eliminando}>Cancelar</Button>
            <Button onClick={eliminar} disabled={eliminando || marcados.size === 0}>
              <Trash2 className="h-4 w-4" />
              {eliminando ? 'Eliminando…' : `Eliminar ${marcados.size || ''}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-[10px] border border-status-warning/40 bg-status-warning/5 p-3 text-xs text-text-secondary flex gap-2">
          <AlertTriangle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
          <div>
            Solo leads en etapa <strong>Nuevo</strong> cuyo primer evento dice "Importado desde CSV". Los que
            llegaron por el webhook/API (sin esa nota) o ya avanzaron de etapa NO aparecen aquí — no se tocan.
            Esto borra el historial del lead también; no se puede deshacer.
          </div>
        </div>

        {candidatos.length === 0 && (
          <div className="surface p-8 text-center text-sm text-text-secondary">
            No hay leads de CSV en "Nuevo" para limpiar.
          </div>
        )}

        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {candidatos.map((l: Lead) => (
            <label
              key={l.id}
              className="flex items-center gap-2.5 rounded-[8px] border border-border-subtle px-3 py-2 text-xs cursor-pointer hover:bg-bg-base/40"
            >
              <input
                type="checkbox"
                checked={marcados.has(l.id)}
                onChange={() => alternar(l.id)}
                className="h-4 w-4 accent-current"
              />
              <span className="text-text-primary font-medium">{l.nombre}</span>
              {l.telefono && <span className="text-text-muted">· {l.telefono}</span>}
              {l.email && <span className="text-text-muted">· {l.email}</span>}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
