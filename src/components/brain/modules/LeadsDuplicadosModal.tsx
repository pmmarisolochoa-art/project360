/**
 * Bandeja de duplicados de leads — detecta por nombre+teléfono, preselecciona
 * cuál conservar (el más completo / más avanzado en el pipeline) y cuáles
 * eliminar, pero NO borra nada sin que alguien lo confirme aquí.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/useToastStore';
import { useLeadsStore } from '@/store/useLeadsStore';
import { detectarLeadsDuplicados } from '@/utils/leadDedup';
import { LEAD_STAGE_LABELS } from '@/types/lead';
import type { Lead } from '@/types/lead';

export function LeadsDuplicadosModal({
  open, onClose, clientId,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
}) {
  const allLeads = useLeadsStore((s) => s.leads);
  const removeLead = useLeadsStore((s) => s.remove);
  const grupos = useMemo(() => detectarLeadsDuplicados(allLeads, clientId), [allLeads, clientId]);

  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(grupos.flatMap((g) => g.eliminar.map((l) => l.id))),
  );
  const [eliminando, setEliminando] = useState(false);

  const alternar = (id: string) =>
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const eliminar = async () => {
    if (marcados.size === 0) return;
    setEliminando(true);
    try {
      for (const id of marcados) removeLead(id);
      toast.success(`${marcados.size} lead${marcados.size === 1 ? '' : 's'} duplicado${marcados.size === 1 ? '' : 's'} eliminado${marcados.size === 1 ? '' : 's'}.`);
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
      title="🔁 Leads duplicados"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-xs text-text-muted">
            {marcados.size > 0 ? `${marcados.size} marcado${marcados.size === 1 ? '' : 's'} para eliminar` : 'Nada marcado'}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={eliminando}>Cancelar</Button>
            <Button onClick={eliminar} disabled={eliminando || marcados.size === 0}>
              <Trash2 className="h-4 w-4" />
              {eliminando ? 'Eliminando…' : 'Eliminar marcados'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-text-secondary">
          Mismo nombre + mismo teléfono = mismo lead. Se preseleccionó para conservar el más
          completo o el más avanzado en el pipeline de cada grupo — revisa antes de eliminar.
        </p>

        {grupos.length === 0 && (
          <div className="surface p-8 text-center text-sm text-text-secondary">
            No se encontraron duplicados por nombre + teléfono.
          </div>
        )}

        {grupos.map((g) => (
          <div key={g.clave} className="rounded-[10px] border border-border-subtle p-3 space-y-2">
            <LeadRow lead={g.conservar} conservar marcado={false} onToggle={() => {}} />
            {g.eliminar.map((l) => (
              <LeadRow
                key={l.id}
                lead={l}
                conservar={false}
                marcado={marcados.has(l.id)}
                onToggle={() => alternar(l.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function LeadRow({
  lead, conservar, marcado, onToggle,
}: {
  lead: Lead;
  conservar: boolean;
  marcado: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[8px] p-2 ${
        conservar ? 'bg-status-success/5' : marcado ? 'bg-status-danger/5' : 'bg-bg-base/30'
      }`}
    >
      {conservar ? (
        <Badge tone="success">Conservar</Badge>
      ) : (
        <input
          type="checkbox"
          checked={marcado}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0 accent-current cursor-pointer"
          aria-label={`Eliminar ${lead.nombre}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">{lead.nombre}</div>
        <div className="text-xs text-text-muted mt-0.5 flex flex-wrap gap-x-2">
          <span>{lead.telefono || 'sin teléfono'}</span>
          {lead.email && <span>· {lead.email}</span>}
          <span>· {LEAD_STAGE_LABELS[lead.etapa]}</span>
          <span>· creado {new Date(lead.createdAt).toLocaleDateString('es')}</span>
          {!!lead.programValue && <span>· ${lead.programValue.toLocaleString()} pactado</span>}
        </div>
      </div>
      {!conservar && !marcado && (
        <AlertTriangle className="h-3.5 w-3.5 text-status-warning shrink-0 mt-0.5" />
      )}
    </div>
  );
}
