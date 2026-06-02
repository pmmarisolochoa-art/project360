import { useMemo, useState } from 'react';
import { Plus, Trash2, ListChecks } from 'lucide-react';
import type { RopreItem, RiskLevel } from '@/types/ropre';
import type { Task } from '@/types/task';
import { useRopreStore } from '@/store/useRopreStore';
import { useClientStore } from '@/store/useClientStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/useToastStore';
import { genId } from '@/utils/id';

/**
 * Panel inline para editar ROPRE desde el MeetingDrawer cuando
 * meeting.type === 'ropre_strategy'. Permite al PM trabajar el
 * marco estratégico sin salir del drawer y, al final, convertir
 * entregables en tareas en un solo click.
 *
 * Persiste vía useRopreStore (fire-and-forget a Supabase) y marca
 * cada item con lastEditedInMeetingId para trazabilidad.
 */
export function RopreInlineEditor({
  clientId, meetingId, accent,
}: { clientId: string; meetingId: string; accent: string }) {
  const allItems = useRopreStore((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.clientId === clientId), [allItems, clientId]);
  const addItem = useRopreStore((s) => s.add);
  const updateItem = useRopreStore((s) => s.update);
  const removeItem = useRopreStore((s) => s.remove);
  const addTask = useClientStore((s) => s.addTask);

  const grouped = useMemo(() => ({
    result: items.filter((i) => i.type === 'result'),
    objective: items.filter((i) => i.type === 'objective'),
    premise: items.filter((i) => i.type === 'premise'),
    risk: items.filter((i) => i.type === 'risk'),
    deliverable: items.filter((i) => i.type === 'deliverable'),
  }), [items]);

  const stamp = (patch: Partial<RopreItem> = {}): Partial<RopreItem> => ({
    ...patch,
    lastEditedInMeetingId: meetingId,
    lastEditedAt: new Date().toISOString(),
  });

  const create = (data: Omit<RopreItem, 'id' | 'createdAt' | 'clientId' | 'lastEditedInMeetingId' | 'lastEditedAt'>) => {
    const item: RopreItem = {
      id: genId(),
      clientId,
      createdAt: new Date().toISOString(),
      lastEditedInMeetingId: meetingId,
      lastEditedAt: new Date().toISOString(),
      ...data,
    };
    addItem(item);
  };

  const convertDeliverablesToTasks = () => {
    const candidates = grouped.deliverable.filter((d) => !d.linkedTaskId);
    if (candidates.length === 0) {
      toast.info('No hay entregables sin tarea vinculada.');
      return;
    }
    let count = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const d of candidates) {
      const task: Task = {
        id: genId(),
        clientId,
        title: d.title,
        description: d.description,
        status: 'pending',
        priority: 'P2',
        assignedTo: d.responsible || 'Sin asignar',
        dueDate: d.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        isDelayed: false,
        delayDays: 0,
        moduleTag: 'ropre',
        tag: 'deliverable',
        input: `Entregable definido en sesión ROPRE del ${today}`,
        output: d.description,
        createdAt: new Date().toISOString(),
      };
      addTask(task);
      updateItem(d.id, stamp({ linkedTaskId: task.id }));
      count++;
    }
    toast.success(`${count} entregable${count === 1 ? '' : 's'} convertido${count === 1 ? '' : 's'} en tarea${count === 1 ? '' : 's'} ✓`);
  };

  return (
    <div className="space-y-4">
      <SectionTitle text="🎯 ROPRE del cliente" accent={accent} />
      <p className="text-[11px] text-text-muted -mt-3">
        Los cambios se guardan automáticamente en el módulo ROPRE. Edita aquí sin salir de la reunión.
      </p>

      {/* R — Resultado principal */}
      <RopreSection title="R — Resultado esperado" accent={accent}>
        {grouped.result.length === 0 ? (
          <QuickAdd placeholder="Resultado principal acordado…" onAdd={(text) => create({ type: 'result', title: text })} multiline />
        ) : (
          grouped.result.map((item) => (
            <EditableRow
              key={item.id}
              value={item.title}
              onChange={(v) => updateItem(item.id, stamp({ title: v }))}
              onRemove={() => removeItem(item.id)}
              multiline
            />
          ))
        )}
      </RopreSection>

      {/* O — Objetivos */}
      <RopreSection title="O — Objetivos secundarios" accent={accent}>
        {grouped.objective.map((item) => (
          <EditableRow
            key={item.id}
            value={item.title}
            onChange={(v) => updateItem(item.id, stamp({ title: v }))}
            onRemove={() => removeItem(item.id)}
          />
        ))}
        <QuickAdd placeholder="Nuevo objetivo…" onAdd={(text) => create({ type: 'objective', title: text })} />
      </RopreSection>

      {/* P — Premisas */}
      <RopreSection title="P — Premisas estratégicas" accent={accent}>
        {grouped.premise.map((item) => (
          <EditableRow
            key={item.id}
            value={item.title}
            onChange={(v) => updateItem(item.id, stamp({ title: v }))}
            onRemove={() => removeItem(item.id)}
          />
        ))}
        <QuickAdd placeholder="Nueva premisa…" onAdd={(text) => create({ type: 'premise', title: text })} />
      </RopreSection>

      {/* R — Riesgos */}
      <RopreSection title="R — Riesgos identificados" accent={accent}>
        {grouped.risk.map((item) => (
          <div key={item.id} className="rounded-md border border-border-subtle bg-bg-base/40 p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                value={item.title}
                onChange={(e) => updateItem(item.id, stamp({ title: e.target.value }))}
                placeholder="Descripción del riesgo"
                className="flex-1"
              />
              <Select
                value={item.riskLevel ?? 'medium'}
                onChange={(e) => updateItem(item.id, stamp({ riskLevel: e.target.value as RiskLevel }))}
                options={[
                  { value: 'high', label: 'Alto' },
                  { value: 'medium', label: 'Medio' },
                  { value: 'low', label: 'Bajo' },
                ]}
              />
              <button onClick={() => removeItem(item.id)} className="text-text-muted hover:text-status-danger" aria-label="Eliminar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        <QuickAdd
          placeholder="Nuevo riesgo identificado…"
          onAdd={(text) => create({ type: 'risk', title: text, riskLevel: 'medium' })}
        />
      </RopreSection>

      {/* E — Entregables */}
      <RopreSection title="E — Entregables del próximo período" accent={accent}>
        {grouped.deliverable.map((item) => (
          <div key={item.id} className="rounded-md border border-border-subtle bg-bg-base/40 p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                value={item.title}
                onChange={(e) => updateItem(item.id, stamp({ title: e.target.value }))}
                placeholder="Nombre del entregable"
                className="flex-1"
              />
              <button onClick={() => removeItem(item.id)} className="text-text-muted hover:text-status-danger" aria-label="Eliminar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={item.responsible ?? ''}
                onChange={(e) => updateItem(item.id, stamp({ responsible: e.target.value }))}
                placeholder="Responsable"
              />
              <Input
                type="date"
                value={item.dueDate ? item.dueDate.slice(0, 10) : ''}
                onChange={(e) => updateItem(item.id, stamp({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
              />
            </div>
            {item.linkedTaskId && (
              <Badge tone="success">→ Tarea creada ✓</Badge>
            )}
          </div>
        ))}
        <QuickAdd
          placeholder="Nuevo entregable…"
          onAdd={(text) => create({ type: 'deliverable', title: text, status: 'todo' })}
        />
      </RopreSection>

      {/* Convertir entregables en tareas */}
      {grouped.deliverable.some((d) => !d.linkedTaskId) && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <Button size="sm" leftIcon={<ListChecks className="h-3.5 w-3.5" />} onClick={convertDeliverablesToTasks}>
            Convertir {grouped.deliverable.filter((d) => !d.linkedTaskId).length} entregable{grouped.deliverable.filter((d) => !d.linkedTaskId).length === 1 ? '' : 's'} en tarea{grouped.deliverable.filter((d) => !d.linkedTaskId).length === 1 ? '' : 's'}
          </Button>
          <div className="text-[10px] text-text-muted mt-1">
            Crea tareas en el módulo Tareas con la fecha y responsable de cada entregable.
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ text, accent }: { text: string; accent: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
      {text}
    </div>
  );
}

function RopreSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/20 p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: accent }}>{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function EditableRow({
  value, onChange, onRemove, multiline,
}: { value: string; onChange: (v: string) => void; onRemove: () => void; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="flex-1" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      )}
      <button onClick={onRemove} className="text-text-muted hover:text-status-danger mt-2" aria-label="Eliminar">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function QuickAdd({ placeholder, onAdd, multiline }: { placeholder: string; onAdd: (text: string) => void; multiline?: boolean }) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
  };
  return (
    <div className="flex gap-2">
      {multiline ? (
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} rows={2} className="flex-1" />
      ) : (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          className="flex-1"
        />
      )}
      <Button size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={submit} disabled={!value.trim()}>
        Agregar
      </Button>
    </div>
  );
}
