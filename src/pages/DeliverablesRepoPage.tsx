import { useMemo, useState } from 'react';
import { Plus, Trash2, ExternalLink, FileText } from 'lucide-react';
import { useRepositoryStore } from '@/store/useRepositoryStore';
import { useClientStore } from '@/store/useClientStore';
import { useRopreStore } from '@/store/useRopreStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import {
  DELIVERABLE_TYPE_LABEL, DELIVERABLE_STATUS_TONE,
  type DeliverableItem, type DeliverableType, type DeliverableStatus,
} from '@/types/repository';
import { toast } from '@/store/useToastStore';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function DeliverablesRepoPage() {
  const clients = useClientStore((s) => s.clients);
  const ropreItems = useRopreStore((s) => s.items);
  const deliverables = useRepositoryStore((s) => s.deliverables);
  const add = useRepositoryStore((s) => s.addDeliverable);
  const remove = useRepositoryStore((s) => s.removeDeliverable);
  const [open, setOpen] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Auto-sync: entregables completados del ROPRE se reflejan acá
  const ropreSynced = useMemo<DeliverableItem[]>(() => {
    return ropreItems
      .filter((i) => i.type === 'deliverable' && i.status === 'done')
      .map((i) => ({
        id: `dr_${i.id}`,
        clientId: i.clientId,
        name: i.title,
        type: 'other' as DeliverableType,
        status: 'approved' as DeliverableStatus,
        deliveryDate: i.dueDate ?? new Date().toISOString(),
        notes: i.description,
        createdAt: i.createdAt,
        source: { type: 'ropre' as const, itemId: i.id },
      }));
  }, [ropreItems]);

  const all = [...deliverables, ...ropreSynced.filter((r) => !deliverables.find((d) => d.id === r.id))];
  const filtered = all.filter((d) => (!filterClient || d.clientId === filterClient) && (!filterStatus || d.status === filterStatus));

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Repositorio</div>
          <h1 className="heading text-3xl font-bold gradient-text">Entregables</h1>
          <p className="text-sm text-text-secondary mt-1">Banco global de entregables de todos los clientes</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Subir entregable</Button>
      </header>

      <div className="surface p-3 flex items-center gap-2 flex-wrap">
        <Select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} options={[{ value: '', label: 'Todos los clientes' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} className="min-w-[200px]" />
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} options={[{ value: '', label: 'Todos los estados' }, { value: 'pending', label: 'Pendiente' }, { value: 'delivered', label: 'Entregado' }, { value: 'approved', label: 'Aprobado' }, { value: 'rejected', label: 'Rechazado' }]} className="min-w-[200px]" />
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted border-b border-border-default bg-bg-elevated/40">
              <th className="py-2 pl-3 pr-3">Entregable</th>
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Fecha</th>
              <th className="py-2 pr-3 pr-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-text-muted">Sin entregables.</td></tr>
            ) : filtered.map((d) => {
              const c = clients.find((x) => x.id === d.clientId);
              return (
                <tr key={d.id} className="border-b border-border-subtle/30 hover:bg-bg-elevated/20">
                  <td className="py-2.5 pl-3 pr-3 text-text-primary">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-text-muted" /> {d.name}
                      {d.source?.type === 'ropre' && <Badge tone="accent">ROPRE</Badge>}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: c?.primaryColor }} />
                      {c?.name ?? '—'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-text-secondary">{DELIVERABLE_TYPE_LABEL[d.type]}</td>
                  <td className="py-2.5 pr-3"><Badge tone={DELIVERABLE_STATUS_TONE[d.status]}>{d.status}</Badge></td>
                  <td className="py-2.5 pr-3 text-xs">{format(parseISO(d.deliveryDate), 'd MMM yyyy', { locale: es })}</td>
                  <td className="py-2.5 pr-3 flex items-center gap-1">
                    {d.externalUrl && (
                      <a href={d.externalUrl} target="_blank" rel="noopener noreferrer" className="h-7 w-7 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated inline-flex items-center justify-center">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {!d.source && (
                      <button onClick={() => { remove(d.id); toast.success('Eliminado'); }} className="h-7 w-7 rounded-md text-text-muted hover:text-status-danger hover:bg-bg-elevated">
                        <Trash2 className="h-3.5 w-3.5 mx-auto" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && <DeliverableModal clients={clients} onClose={() => setOpen(false)} onSave={(d) => { add(d); toast.success('Entregable agregado'); setOpen(false); }} />}
    </div>
  );
}

function DeliverableModal({ clients, onClose, onSave }: { clients: ReturnType<typeof useClientStore.getState>['clients']; onClose: () => void; onSave: (d: DeliverableItem) => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [name, setName] = useState('');
  const [type, setType] = useState<DeliverableType>('document');
  const [status, setStatus] = useState<DeliverableStatus>('pending');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [externalUrl, setExternalUrl] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal open onClose={onClose} title="Subir entregable" footer={
      <>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => {
          if (!name.trim()) { toast.error('Nombre requerido'); return; }
          onSave({ id: `d_${Math.random().toString(36).slice(2, 7)}`, clientId, name, type, status, deliveryDate: new Date(deliveryDate).toISOString(), externalUrl: externalUrl || undefined, notes: notes || undefined, createdAt: new Date().toISOString() });
        }}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <Select label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clients.map((c) => ({ value: c.id, label: c.name }))} />
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-2">
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as DeliverableType)} options={(Object.keys(DELIVERABLE_TYPE_LABEL) as DeliverableType[]).map((t) => ({ value: t, label: DELIVERABLE_TYPE_LABEL[t] }))} />
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as DeliverableStatus)} options={[{ value: 'pending', label: 'Pendiente' }, { value: 'delivered', label: 'Entregado' }, { value: 'approved', label: 'Aprobado' }, { value: 'rejected', label: 'Rechazado' }]} />
        </div>
        <Input label="Fecha" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        <Input label="Link externo (Drive, Notion, Figma…)" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
        <Textarea label="Notas" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
