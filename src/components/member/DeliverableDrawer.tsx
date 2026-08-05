import { useState } from 'react';
import { Plus, Trash2, FolderOpen, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useClientStore } from '@/store/useClientStore';
import { TaskLinksRepo } from '@/services/taskLinks';
import { useLinksStore } from '@/store/useLinksStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';

type ExtraLink = { nombre: string; url: string; tipo: 'referencia' | 'drive' | 'notion' | 'loom' | 'web' | 'otro' };

/**
 * Drawer para que un miembro suba el entregable de una tarea:
 *  - Link principal de Drive → se guarda en tasks.drive_link (lo ve el PM en la card)
 *    y en task_links (registro persistente con autor).
 *  - Links adicionales opcionales → task_links.
 */
export function DeliverableDrawer({
  task,
  onClose,
  onSaved,
}: {
  // `meetingId` viaja para heredarlo al entregable (trazabilidad 7D).
  task: { id: string; clientId: string; title: string; driveLink?: string; meetingId?: string };
  onClose: () => void;
  onSaved?: () => void;
}) {
  const updateTask = useClientStore((s) => s.updateTask);

  const [driveUrl, setDriveUrl] = useState(task.driveLink ?? '');
  const [nombre, setNombre] = useState('');
  const [notas, setNotas] = useState('');
  const [extras, setExtras] = useState<ExtraLink[]>([]);
  const [saving, setSaving] = useState(false);
  // Propagación: el link entra al store global y aparece al instante en
  // /links-entregables y en el buscador, sin recargar.
  const addLink = useLinksStore((s) => s.add);
  // Nombre visible de quien sube: se copia a la fila para que /links-entregables
  // pueda mostrar "Subido por" sin un join contra auth.users.
  const miNombre = useAuthStore((s) =>
    s.clientAccesses.find((a) => a.clientId === task.clientId)?.nombre
    ?? (s.user?.email ?? '').split('@')[0]
    ?? undefined,
  );

  const addExtra = () => setExtras((e) => [...e, { nombre: '', url: '', tipo: 'referencia' }]);
  const patchExtra = (i: number, patch: Partial<ExtraLink>) =>
    setExtras((e) => e.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeExtra = (i: number) => setExtras((e) => e.filter((_, idx) => idx !== i));

  const canSave = driveUrl.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // 1. Registro persistente del entregable (created_by lo pone el servidor).
      //    La reunión se HEREDA de la tarea: así se puede preguntar después
      //    "dame los entregables de la reunión del 15 de junio" (trazabilidad 7D).
      const creado = await TaskLinksRepo.create({
        taskId: task.id,
        clientId: task.clientId,
        nombre: nombre.trim() || task.title,
        url: driveUrl.trim(),
        tipo: 'entregable',
        meetingId: task.meetingId ?? null,
        createdByNombre: miNombre,
      });
      if (creado) addLink(creado);

      // 2. Links adicionales.
      for (const ex of extras) {
        if (!ex.url.trim()) continue;
        const extra = await TaskLinksRepo.create({
          taskId: task.id,
          clientId: task.clientId,
          nombre: ex.nombre.trim() || ex.url.trim(),
          url: ex.url.trim(),
          tipo: ex.tipo,
          meetingId: task.meetingId ?? null,
          createdByNombre: miNombre,
        });
        if (extra) addLink(extra);
      }

      // 3. El link de Drive queda en la tarea (visible para el PM en el Kanban).
      updateTask(task.id, { driveLink: driveUrl.trim() });

      toast.success('✅ Entregable guardado');
      onSaved?.();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      console.warn('[deliverable.save]', e);
      toast.error(`No se pudo guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={<span className="truncate">Entregable — {task.title}</span>}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Guardando…' : 'Guardar entregable'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Input
            label="Link de la carpeta o archivo en Drive"
            type="url"
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
          />
          <div className="mt-1 flex items-center gap-3 text-[10px] text-text-muted">
            <span>Pega el link de Google Drive donde subiste el archivo.</span>
            {task.driveLink && (
              <a href={task.driveLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-violet hover:underline">
                <FolderOpen className="h-3 w-3" /> Abrir el actual
              </a>
            )}
          </div>
        </div>

        <Input
          label="Nombre del entregable"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Guión VSL 60 seg v1"
        />

        <Textarea
          label="Notas (opcional)"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej. Incluye versión en español e inglés"
        />

        <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Links relacionados (opcional)</span>
            <button onClick={addExtra} className="text-[11px] text-accent-violet hover:underline inline-flex items-center gap-1">
              <Plus className="h-3 w-3" /> Agregar otro link
            </button>
          </div>
          {extras.length === 0 ? (
            <div className="text-[11px] text-text-muted italic">Referencias, Notion, Loom, etc.</div>
          ) : (
            extras.map((ex, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_120px_28px] gap-2 items-center">
                <input
                  value={ex.nombre}
                  onChange={(e) => patchExtra(i, { nombre: e.target.value })}
                  placeholder="Nombre"
                  className="bg-bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-violet/60"
                />
                <input
                  value={ex.url}
                  onChange={(e) => patchExtra(i, { url: e.target.value })}
                  placeholder="https://…"
                  className="bg-bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-violet/60"
                />
                <Select
                  value={ex.tipo}
                  onChange={(e) => patchExtra(i, { tipo: e.target.value as ExtraLink['tipo'] })}
                  options={[
                    { value: 'referencia', label: 'Referencia' },
                    { value: 'drive', label: 'Drive' },
                    { value: 'notion', label: 'Notion' },
                    { value: 'loom', label: 'Loom' },
                    { value: 'web', label: 'Web' },
                    { value: 'otro', label: 'Otro' },
                  ]}
                />
                <button onClick={() => removeExtra(i)} className="text-text-muted hover:text-status-danger transition inline-flex items-center justify-center" aria-label="Quitar link">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {driveUrl.trim() && (
          <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-cyan hover:underline">
            <ExternalLink className="h-3 w-3" /> Previsualizar link
          </a>
        )}
      </div>
    </Modal>
  );
}
