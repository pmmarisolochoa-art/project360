import { useState } from 'react';
import { Plus, Search, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { useRepositoryStore } from '@/store/useRepositoryStore';
import { useClientStore } from '@/store/useClientStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { LINK_CATEGORY_META, type LinkCategory, type LinkItem } from '@/types/repository';
import { toast } from '@/store/useToastStore';

export function LinksRepoPage() {
  const clients = useClientStore((s) => s.clients);
  const links = useRepositoryStore((s) => s.links);
  const add = useRepositoryStore((s) => s.addLink);
  const remove = useRepositoryStore((s) => s.removeLink);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = links.filter((l) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return l.name.toLowerCase().includes(needle) || l.url.toLowerCase().includes(needle) || (l.notes ?? '').toLowerCase().includes(needle);
  });

  const grouped = filtered.reduce<Record<string, LinkItem[]>>((acc, l) => {
    (acc[l.category] ??= []).push(l);
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Repositorio</div>
          <h1 className="heading text-3xl font-bold gradient-text">Links</h1>
          <p className="text-sm text-text-secondary mt-1">Banco organizado por cliente y categoría</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Agregar link</Button>
      </header>

      <div className="surface p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, URL o notas…"
            className="w-full h-10 pl-10 pr-3 rounded-[10px] bg-bg-surface border border-border-subtle text-sm text-text-primary outline-none"
          />
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="surface p-10 text-center text-sm text-text-muted">Sin links.</div>
      ) : (
        (Object.keys(grouped) as LinkCategory[]).map((cat) => (
          <section key={cat} className="surface p-5">
            <header className="flex items-center gap-2 mb-3">
              <span className="text-lg">{LINK_CATEGORY_META[cat].icon}</span>
              <h2 className="heading text-base font-bold">{LINK_CATEGORY_META[cat].label}</h2>
              <span className="text-[10px] text-text-muted font-mono">{grouped[cat].length}</span>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {grouped[cat].map((l) => {
                const c = clients.find((x) => x.id === l.clientId);
                let host = ''; try { host = new URL(l.url).hostname; } catch { host = l.url; }
                return (
                  <div key={l.id} className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-text-primary truncate">{l.name}</div>
                        <div className="text-[11px] text-text-muted truncate">{host}</div>
                      </div>
                      {c && (
                        <Badge tone="neutral">
                          <span className="h-1.5 w-1.5 rounded-full inline-block mr-1" style={{ background: c.primaryColor }} /> {c.name}
                        </Badge>
                      )}
                    </div>
                    {l.notes && <p className="text-[11px] text-text-secondary leading-snug mb-2">{l.notes}</p>}
                    <div className="flex items-center gap-1">
                      <button onClick={() => { navigator.clipboard.writeText(l.url); toast.success('Link copiado'); }} className="text-[10px] text-text-muted hover:text-text-primary inline-flex items-center gap-1">
                        <Copy className="h-3 w-3" /> Copiar
                      </button>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[10px] text-text-muted hover:text-text-primary inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Abrir
                      </a>
                      <button onClick={() => { remove(l.id); toast.success('Eliminado'); }} className="ml-auto text-text-muted hover:text-status-danger">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {open && (
        <LinkModal clients={clients} onClose={() => setOpen(false)} onSave={(l) => { add(l); toast.success('Link agregado'); setOpen(false); }} />
      )}
    </div>
  );
}

function LinkModal({ clients, onClose, onSave }: { clients: ReturnType<typeof useClientStore.getState>['clients']; onClose: () => void; onSave: (l: LinkItem) => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [category, setCategory] = useState<LinkCategory>('landing');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <Modal open onClose={onClose} title="Agregar link" size="sm" footer={
      <>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={() => {
          if (!name.trim() || !url.trim()) { toast.error('Nombre y URL requeridos'); return; }
          onSave({ id: `l_${Math.random().toString(36).slice(2, 7)}`, clientId, category, name, url, notes: notes || undefined, createdAt: new Date().toISOString() });
        }}>Guardar</Button>
      </>
    }>
      <div className="space-y-3">
        <Select label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clients.map((c) => ({ value: c.id, label: c.name }))} />
        <Select label="Categoría" value={category} onChange={(e) => setCategory(e.target.value as LinkCategory)} options={(Object.keys(LINK_CATEGORY_META) as LinkCategory[]).map((k) => ({ value: k, label: `${LINK_CATEGORY_META[k].icon} ${LINK_CATEGORY_META[k].label}` }))} />
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required />
        <Textarea label="Notas" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
