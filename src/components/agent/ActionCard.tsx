import { useState } from 'react';
import { ClipboardList, Target, CalendarPlus, Check, Pencil, X } from 'lucide-react';
import { toast } from '@/store/useToastStore';
import { useClientStore } from '@/store/useClientStore';
import { withAlpha } from '@/utils/colorGenerator';
import {
  actionTitle,
  executeAction,
  type AgentAction,
  type ActionTipo,
} from '@/services/agentActions';

const ICON: Record<ActionTipo, typeof ClipboardList> = {
  crear_tarea: ClipboardList,
  actualizar_ropre: Target,
  crear_reunion: CalendarPlus,
};

/** Campos editables por tipo de acción: [key, label, kind]. */
const FIELDS: Record<ActionTipo, Array<{ key: string; label: string; kind: 'text' | 'number' | 'textarea' | 'select'; options?: string[] }>> = {
  crear_tarea: [
    { key: 'titulo', label: 'Título', kind: 'text' },
    { key: 'rol', label: 'Rol responsable', kind: 'text' },
    { key: 'prioridad', label: 'Prioridad', kind: 'select', options: ['P1', 'P2', 'P3'] },
    { key: 'vence_en_dias', label: 'Vence en (días)', kind: 'number' },
    { key: 'descripcion', label: 'Descripción', kind: 'textarea' },
  ],
  actualizar_ropre: [
    { key: 'tipo', label: 'Tipo', kind: 'select', options: ['result', 'objective', 'premise', 'risk', 'deliverable'] },
    { key: 'titulo', label: 'Título', kind: 'text' },
    { key: 'meta', label: 'Meta / valor', kind: 'text' },
    { key: 'nivel_riesgo', label: 'Nivel de riesgo', kind: 'select', options: ['low', 'medium', 'high'] },
    { key: 'descripcion', label: 'Descripción', kind: 'textarea' },
  ],
  crear_reunion: [
    { key: 'titulo', label: 'Título', kind: 'text' },
    { key: 'tipo', label: 'Tipo', kind: 'text' },
    { key: 'en_dias', label: 'En (días)', kind: 'number' },
    { key: 'notas', label: 'Notas', kind: 'textarea' },
  ],
};

interface ActionCardProps {
  action: AgentAction;
  clientId: string;
  onDone: (message: string) => void;
}

export function ActionCard({ action, clientId, onDone }: ActionCardProps) {
  const accent = useClientStore((s) => s.clients.find((c) => c.id === clientId)?.primaryColor) ?? '#8B5CF6';
  const [editing, setEditing] = useState(false);
  const [datos, setDatos] = useState<Record<string, unknown>>({ ...action.datos });
  const [done, setDone] = useState<string | null>(null);

  const Icon = ICON[action.tipo];
  const fields = FIELDS[action.tipo];

  function setField(key: string, value: string, kind: string) {
    setDatos((prev) => ({ ...prev, [key]: kind === 'number' ? Number(value) : value }));
  }

  function confirm() {
    const result = executeAction({ tipo: action.tipo, datos }, clientId);
    if (result.ok) {
      setDone(result.message);
      toast.success(result.message);
      onDone(result.message);
    } else {
      toast.error(result.message);
    }
  }

  const summary = (() => {
    const t = (datos.titulo as string) || '(sin título)';
    if (action.tipo === 'crear_tarea') {
      return `"${t}" · Rol: ${(datos.rol as string) || 'PM'} · Vence: ${(datos.vence_en_dias as number) ?? 3} días`;
    }
    if (action.tipo === 'actualizar_ropre') {
      return `${(datos.tipo as string) || 'result'}: "${t}"`;
    }
    return `"${t}" · en ${(datos.en_dias as number) ?? 7} días`;
  })();

  return (
    <div
      className="mt-2 rounded-xl border p-3 text-sm"
      style={{ borderColor: withAlpha(accent, 0.35), background: withAlpha(accent, 0.06) }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="h-6 w-6 rounded-md flex items-center justify-center"
          style={{ background: withAlpha(accent, 0.18), color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="font-medium text-text-primary">Propuesta: {actionTitle(action.tipo)}</span>
      </div>

      {done ? (
        <div className="flex items-center gap-1.5 text-status-success text-sm pl-0.5">
          <Check className="h-4 w-4" /> {done}
        </div>
      ) : editing ? (
        <div className="space-y-2 mt-2">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-text-muted text-xs">{f.label}</span>
              {f.kind === 'textarea' ? (
                <textarea
                  value={(datos[f.key] as string) ?? ''}
                  onChange={(e) => setField(f.key, e.target.value, f.kind)}
                  rows={2}
                  className="mt-0.5 w-full rounded-md bg-bg-base border border-border-subtle px-2 py-1 text-text-primary text-sm outline-none focus:border-border-default resize-none"
                />
              ) : f.kind === 'select' ? (
                <select
                  value={(datos[f.key] as string) ?? ''}
                  onChange={(e) => setField(f.key, e.target.value, f.kind)}
                  className="mt-0.5 w-full rounded-md bg-bg-base border border-border-subtle px-2 py-1 text-text-primary text-sm outline-none focus:border-border-default"
                >
                  <option value="">—</option>
                  {f.options!.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.kind === 'number' ? 'number' : 'text'}
                  value={(datos[f.key] as string | number) ?? ''}
                  onChange={(e) => setField(f.key, e.target.value, f.kind)}
                  className="mt-0.5 w-full rounded-md bg-bg-base border border-border-subtle px-2 py-1 text-text-primary text-sm outline-none focus:border-border-default"
                />
              )}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-text-secondary pl-0.5">{summary}</p>
      )}

      {!done && (
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={() => setEditing((e) => !e)}
            className="inline-flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
            {editing ? 'Cerrar' : 'Editar'}
          </button>
          <button
            onClick={confirm}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: accent }}
          >
            <Check className="h-3 w-3" /> Confirmar y crear
          </button>
        </div>
      )}
    </div>
  );
}
