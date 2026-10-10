import { useState } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import type { Meeting } from '@/types/meeting';
import { useClientStore } from '@/store/useClientStore';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { genId } from '@/utils/id';
import { toast } from '@/store/useToastStore';
import type { Task } from '@/types/task';

interface Compromiso {
  id: string;
  titulo: string;
  responsable: string;
  fecha: string; // yyyy-MM-dd
}

function nuevoCompromiso(defaultDate: string): Compromiso {
  return { id: genId(), titulo: '', responsable: '', fecha: defaultDate };
}

/**
 * Cierre de la reunión: lo acordado se escribe aquí y, al confirmar, se
 * convierte en tareas REALES del sistema — mismo mecanismo que usa hoy la
 * extracción por IA en el drawer (`origen:'reunion'` + referencia a esta
 * reunión). Nada queda solo en una diapositiva: si no se crea la tarea, no
 * existe en ningún otro lado de la app.
 */
export function ClosingSlide({ meeting, accent }: { meeting: Meeting; accent: string }) {
  const addTask = useClientStore((s) => s.addTask);
  const members = useTeamMembersStore((s) => s.members.filter((m) => m.clientId === meeting.clientId));
  const defaultDate = format(addDays(new Date(), 3), 'yyyy-MM-dd');

  const [compromisos, setCompromisos] = useState<Compromiso[]>([nuevoCompromiso(defaultDate)]);
  const [creadoIds, setCreadoIds] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);

  const update = (id: string, patch: Partial<Compromiso>) =>
    setCompromisos((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const remove = (id: string) => setCompromisos((prev) => prev.filter((c) => c.id !== id));

  const pendientes = compromisos.filter((c) => c.titulo.trim().length > 0 && !creadoIds.has(c.id));

  const crearTareas = async () => {
    if (pendientes.length === 0) return;
    setCreando(true);
    let ok = 0;
    for (const c of pendientes) {
      const task: Task = {
        id: genId(),
        clientId: meeting.clientId,
        title: c.titulo.trim(),
        status: 'pending',
        priority: 'P2',
        assignedTo: c.responsable || 'Sin asignar',
        dueDate: new Date(c.fecha).toISOString(),
        isDelayed: false,
        delayDays: 0,
        tag: 'meeting',
        origen: 'reunion',
        meetingId: meeting.id,
        meetingNombre: meeting.title?.trim() || 'Reunión',
        meetingFecha: meeting.scheduledAt,
        createdAt: new Date().toISOString(),
      };
      const saved = await addTask(task);
      if (saved) {
        ok++;
        setCreadoIds((prev) => new Set(prev).add(c.id));
      }
    }
    setCreando(false);
    if (ok > 0) toast.success(`${ok} tarea${ok === 1 ? '' : 's'} creada${ok === 1 ? '' : 's'} ✓`);
  };

  return (
    <div className="space-y-4">
      {compromisos.map((c) => {
        const creado = creadoIds.has(c.id);
        return (
          <div
            key={c.id}
            className="flex items-start gap-2.5 rounded-[14px] border border-border-default p-4"
            style={{ background: 'var(--bg-surface)', opacity: creado ? 0.6 : 1 }}
          >
            <div className="flex-1 grid grid-cols-[1fr_auto_auto] gap-2.5">
              <Input
                placeholder="¿Qué se comprometió?"
                value={c.titulo}
                disabled={creado}
                onChange={(e) => update(c.id, { titulo: e.target.value })}
              />
              <Select
                className="min-w-[160px]"
                value={c.responsable}
                disabled={creado}
                onChange={(e) => update(c.id, { responsable: e.target.value })}
                placeholder="Responsable"
                options={members.map((m) => ({ value: m.nombre, label: m.nombre }))}
              />
              <Input
                type="date"
                className="min-w-[150px]"
                value={c.fecha}
                disabled={creado}
                onChange={(e) => update(c.id, { fecha: e.target.value })}
              />
            </div>
            {creado ? (
              <CheckCircle2 className="h-5 w-5 mt-2.5 flex-shrink-0" style={{ color: accent }} />
            ) : (
              <button
                onClick={() => remove(c.id)}
                className="h-9 w-9 mt-0.5 flex-shrink-0 inline-flex items-center justify-center rounded-md text-text-muted hover:text-status-danger hover:bg-status-danger/10"
                aria-label="Quitar compromiso"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}

      <button
        onClick={() => setCompromisos((prev) => [...prev, nuevoCompromiso(defaultDate)])}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        <Plus className="h-4 w-4" /> Agregar compromiso
      </button>

      <div className="pt-2">
        <Button onClick={crearTareas} disabled={pendientes.length === 0 || creando} loading={creando} style={{ background: accent }}>
          Crear {pendientes.length > 0 ? pendientes.length : ''} tarea{pendientes.length === 1 ? '' : 's'} real{pendientes.length === 1 ? '' : 'es'}
        </Button>
      </div>
    </div>
  );
}
