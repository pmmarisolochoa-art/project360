import { useMemo, useState, type FormEvent } from 'react';
import { Link as LinkIcon, Package, FolderOpen, Plus, ExternalLink, Check, AlertTriangle, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/utils/cn';
import { useLinksStore } from '@/store/useLinksStore';
import { useClientStore } from '@/store/useClientStore';
import {
  TaskLinksRepo, TASK_LINK_ESTADO_LABEL, TASK_LINK_ESTADO_TONE,
  type TaskLink, type TaskLinkEstado, type TaskLinkTipo,
} from '@/services/taskLinks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/store/useToastStore';

/**
 * Links y Entregables — /links-entregables
 *
 * Fusiona los dos repositorios globales que antes vivían sueltos en el sidebar.
 *
 * TODO sale de `task_links`, la misma tabla donde el equipo sube sus entregables
 * desde la tarea. No se copian filas: un entregable subido en una tarea ES esta
 * misma fila, vista desde otro lado. Por eso la trazabilidad (qué tarea, qué
 * reunión, quién lo subió) está siempre completa y nunca se desincroniza.
 */
type Tab = 'links' | 'entregables' | 'drive';

const TABS: Array<{ id: Tab; label: string; icon: typeof LinkIcon }> = [
  { id: 'links', label: 'Links', icon: LinkIcon },
  { id: 'entregables', label: 'Entregables', icon: Package },
  { id: 'drive', label: 'Drive', icon: FolderOpen },
];

const TIPO_OPTIONS: Array<{ value: TaskLinkTipo; label: string }> = [
  { value: 'entregable', label: 'Entregable' },
  { value: 'referencia', label: 'Referencia' },
  { value: 'drive', label: 'Drive' },
  { value: 'notion', label: 'Notion' },
  { value: 'loom', label: 'Loom' },
  { value: 'web', label: 'Web' },
  { value: 'otro', label: 'Otro' },
];

export function LinksEntregablesPage() {
  const [tab, setTab] = useState<Tab>('links');
  const [fClient, setFClient] = useState('');
  const [creating, setCreating] = useState(false);

  const links = useLinksStore((s) => s.links);
  const clients = useClientStore((s) => s.clients);
  const tasks = useClientStore((s) => s.tasks);
  const meetings = useClientStore((s) => s.meetings);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const meetingById = useMemo(() => Object.fromEntries(meetings.map((m) => [m.id, m])), [meetings]);

  const visibles = useMemo(
    () => links.filter((l) => !fClient || l.clientId === fClient),
    [links, fClient],
  );
  const entregables = useMemo(
    () => visibles.filter((l) => l.tipo === 'entregable' && l.fuente === 'tarea'),
    [visibles],
  );

  const clientOptions = [
    { value: '', label: 'Todos los clientes' },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Repositorio global</div>
          <h1 className="heading text-3xl font-bold gradient-text">Links y Entregables</h1>
          <p className="text-sm text-text-secondary mt-1">
            Todo lo que produce el equipo, trazado hasta la tarea y la reunión que lo originó
          </p>
        </div>
        {tab === 'links' && (
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Agregar link manual
          </Button>
        )}
      </header>

      <nav className="flex items-center gap-1 border-b border-border-subtle" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm transition-all focus-ring rounded-t-[10px] -mb-px border-b-2',
              tab === id
                ? 'border-accent-primary text-text-primary font-medium'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === 'entregables' && entregables.length > 0 && (
              <span className="text-[10px] text-text-muted">({entregables.length})</span>
            )}
          </button>
        ))}
      </nav>

      {tab !== 'drive' && (
        <div className="surface p-3 flex items-center gap-2 flex-wrap">
          <Select
            value={fClient}
            onChange={(e) => setFClient(e.target.value)}
            className="min-w-[200px]"
            options={clientOptions}
          />
          <span className="text-xs text-text-muted">
            {(tab === 'links' ? visibles : entregables).length} registro
            {(tab === 'links' ? visibles : entregables).length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {tab === 'links' && (
        <TablaLinks
          links={visibles}
          clientById={clientById}
          taskById={taskById}
        />
      )}

      {tab === 'entregables' && (
        <TablaEntregables
          links={entregables}
          clientById={clientById}
          taskById={taskById}
          meetingById={meetingById}
        />
      )}

      {tab === 'drive' && (
        <div className="surface p-8 text-center">
          <FolderOpen className="h-8 w-8 mx-auto text-text-muted mb-3" />
          <h2 className="heading text-lg font-bold">Drive no conectado</h2>
          <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
            Cuando conectes Google Drive, aquí verás las carpetas de cada cliente y podrás abrir
            los entregables sin salir de la app.
          </p>
          <p className="text-xs text-text-muted mt-4">
            Mientras tanto, cada entregable se registra con su link de Drive desde la tarea —
            que es la fuente de verdad.
          </p>
        </div>
      )}

      {creating && (
        <ModalLinkManual
          clients={clientOptions.slice(1)}
          defaultClientId={fClient}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Tab Links ───────────────────────── */

function TablaLinks({ links, clientById, taskById }: {
  links: TaskLink[];
  clientById: Record<string, { name: string; primaryColor: string } | undefined>;
  taskById: Record<string, { title: string } | undefined>;
}) {
  const remove = useLinksStore((s) => s.remove);

  const borrar = async (l: TaskLink) => {
    if (!confirm(`¿Eliminar "${l.nombre}"?`)) return;
    await TaskLinksRepo.remove(l.id);
    remove(l.id);
    toast.success('Link eliminado');
  };

  if (links.length === 0) {
    return (
      <div className="surface p-8 text-center text-sm text-text-muted">
        Todavía no hay links. Los que suba el equipo en sus tareas aparecen aquí solos.
      </div>
    );
  }

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider border-b border-border-default [background:var(--table-header-bg)] [color:var(--table-header-text)]">
            <th className="py-2 pl-3 pr-3">Nombre</th>
            <th className="py-2 pr-3">Cliente</th>
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3">Origen</th>
            <th className="py-2 pr-3">Subido por</th>
            <th className="py-2 pr-3">Fecha</th>
            <th className="py-2 pr-3" />
          </tr>
        </thead>
        <tbody>
          {links.map((l) => {
            const c = clientById[l.clientId];
            const t = l.taskId ? taskById[l.taskId] : undefined;
            return (
              <tr key={l.id} className="border-b border-border-subtle/30 hover:[background:var(--table-row-hover)]">
                <td className="py-2.5 pl-3 pr-3">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-text-primary hover:text-accent-violet"
                  >
                    {l.nombre}
                    <ExternalLink className="h-3 w-3 shrink-0 text-text-muted" />
                  </a>
                </td>
                <td className="py-2.5 pr-3">
                  {c && (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.primaryColor }} />
                      {c.name}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-text-secondary capitalize">{l.tipo}</td>
                <td className="py-2.5 pr-3 text-xs text-text-secondary">
                  {l.fuente === 'tarea' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Badge tone="info">Del equipo</Badge>
                      <span className="truncate max-w-[200px]">{t?.title ?? '—'}</span>
                    </span>
                  ) : (
                    <span className="text-text-muted">Manual</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-text-secondary">
                  {l.createdByNombre ?? '—'}
                </td>
                <td className="py-2.5 pr-3 text-xs text-text-muted">
                  {format(parseISO(l.createdAt), 'd MMM yyyy', { locale: es })}
                </td>
                <td className="py-2.5 pr-3">
                  <button
                    onClick={() => borrar(l)}
                    className="text-text-muted hover:text-status-danger focus-ring rounded p-1"
                    aria-label="Eliminar link"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Tab Entregables ───────────────────────── */

function TablaEntregables({ links, clientById, taskById, meetingById }: {
  links: TaskLink[];
  clientById: Record<string, { name: string; primaryColor: string } | undefined>;
  taskById: Record<string, { title: string } | undefined>;
  meetingById: Record<string, { title: string } | undefined>;
}) {
  const setEstadoLocal = useLinksStore((s) => s.setEstado);
  const [guardando, setGuardando] = useState<string | null>(null);

  const revisar = async (l: TaskLink, estado: TaskLinkEstado) => {
    setGuardando(l.id);
    try {
      await TaskLinksRepo.setEstado(l.id, estado);
      setEstadoLocal(l.id, estado);
      toast.success(estado === 'aprobado' ? 'Entregable aprobado ✓' : 'Marcado con correcciones');
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as Error).message}`);
    } finally {
      setGuardando(null);
    }
  };

  if (links.length === 0) {
    return (
      <div className="surface p-8 text-center text-sm text-text-muted">
        Sin entregables del equipo todavía. Aparecen aquí cuando alguien sube uno desde su tarea.
      </div>
    );
  }

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider border-b border-border-default [background:var(--table-header-bg)] [color:var(--table-header-text)]">
            <th className="py-2 pl-3 pr-3">Tarea</th>
            <th className="py-2 pr-3">Cliente</th>
            <th className="py-2 pr-3">Reunión origen</th>
            <th className="py-2 pr-3">Responsable</th>
            <th className="py-2 pr-3">Link</th>
            <th className="py-2 pr-3">Fecha</th>
            <th className="py-2 pr-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => {
            const c = clientById[l.clientId];
            const t = l.taskId ? taskById[l.taskId] : undefined;
            const m = l.meetingId ? meetingById[l.meetingId] : undefined;
            const esNuevo = l.estado === 'pendiente';
            return (
              <tr key={l.id} className="border-b border-border-subtle/30 hover:[background:var(--table-row-hover)]">
                <td className="py-2.5 pl-3 pr-3 text-text-primary">
                  <span className="inline-flex items-center gap-1.5">
                    {esNuevo && <Badge tone="warning">Nuevo</Badge>}
                    <span className="truncate max-w-[240px]">{t?.title ?? l.nombre}</span>
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  {c && (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.primaryColor }} />
                      {c.name}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-text-secondary truncate max-w-[180px]">
                  {m?.title ?? '—'}
                </td>
                <td className="py-2.5 pr-3 text-xs text-text-secondary">
                  {l.createdByNombre ?? '—'}
                </td>
                <td className="py-2.5 pr-3">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent-violet hover:underline"
                  >
                    Abrir <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
                <td className="py-2.5 pr-3 text-xs text-text-muted">
                  {format(parseISO(l.createdAt), 'd MMM', { locale: es })}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={TASK_LINK_ESTADO_TONE[l.estado]}>{TASK_LINK_ESTADO_LABEL[l.estado]}</Badge>
                    {l.estado !== 'aprobado' && (
                      <button
                        disabled={guardando === l.id}
                        onClick={() => revisar(l, 'aprobado')}
                        title="Aprobar entregable"
                        className="rounded p-1 text-text-muted hover:text-status-success focus-ring disabled:opacity-40"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {l.estado !== 'correcciones' && (
                      <button
                        disabled={guardando === l.id}
                        onClick={() => revisar(l, 'correcciones')}
                        title="Solicitar corrección"
                        className="rounded p-1 text-text-muted hover:text-status-warning focus-ring disabled:opacity-40"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Alta manual ───────────────────────── */

function ModalLinkManual({ clients, defaultClientId, onClose }: {
  clients: Array<{ value: string; label: string }>;
  defaultClientId: string;
  onClose: () => void;
}) {
  const addLink = useLinksStore((s) => s.add);
  const [nombre, setNombre] = useState('');
  const [url, setUrl] = useState('');
  const [clientId, setClientId] = useState(defaultClientId || clients[0]?.value || '');
  const [tipo, setTipo] = useState<TaskLinkTipo>('referencia');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !url.trim() || !clientId) return;
    setSaving(true);
    try {
      // taskId null + fuente 'manual': no nace de una tarea del equipo.
      const creado = await TaskLinksRepo.create({
        taskId: null,
        clientId,
        nombre: nombre.trim(),
        url: url.trim(),
        tipo,
        fuente: 'manual',
        notas: notas.trim() || undefined,
      });
      if (creado) addLink(creado);
      toast.success('Link agregado');
      onClose();
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Agregar link manual</span>}>
      <form onSubmit={submit} className="space-y-3">
        <Input label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input label="URL" required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        <Select
          label="Cliente"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          options={clients}
        />
        <Select
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TaskLinkTipo)}
          options={TIPO_OPTIONS}
        />
        <Textarea label="Notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}
