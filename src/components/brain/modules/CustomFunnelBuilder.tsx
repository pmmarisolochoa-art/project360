import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import type { FunnelTemplate, TemplatePhase, TemplateTask, FunnelTemplateKey } from '@/types/funnel';
import { ROLE_DEFS } from '@/types/team';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/store/useToastStore';

const DEFAULT_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#14B8A6'];

interface DraftTask {
  id: string;
  title: string;
  responsibleRole: string;
  dayStart: number;
  dayEnd: number;
  priority: 'P1' | 'P2' | 'P3';
  input: string;
  output: string;
}

interface DraftPhase {
  id: string;
  name: string;
  color: string;
  dayStart: number;
  dayEnd: number;
  tasks: DraftTask[];
  expanded: boolean;
}

/**
 * Builder visual de embudos personalizados. Permite al PM armar fases
 * y tareas a mano para casos donde las 4 plantillas predefinidas no
 * encajan. El resultado se materializa con activateFromCustom.
 */
export function CustomFunnelBuilder({
  onCancel, onCreate, initialTemplate,
}: {
  onCancel: () => void;
  onCreate: (template: FunnelTemplate, startDate: Date, name: string) => void;
  initialTemplate?: FunnelTemplate;
}) {
  const [name, setName] = useState(initialTemplate?.name ?? 'Embudo personalizado');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [estimatedDays, setEstimatedDays] = useState(initialTemplate?.estimatedDays.max ?? 45);
  const [phases, setPhases] = useState<DraftPhase[]>(
    initialTemplate
      ? initialTemplate.phases.map((p) => ({
          id: crypto.randomUUID(),
          name: p.name,
          color: p.color,
          dayStart: p.dayStart,
          dayEnd: p.dayEnd,
          expanded: true,
          tasks: p.tasks.map((t) => ({
            id: crypto.randomUUID(),
            title: t.title,
            responsibleRole: t.responsibleRole,
            dayStart: t.dayStart,
            dayEnd: t.dayEnd,
            priority: t.priority ?? 'P2',
            input: t.input ?? '',
            output: t.output ?? '',
          })),
        }))
      : [
          {
            id: crypto.randomUUID(),
            name: 'FASE 1 — NOMBRE DE LA FASE',
            color: DEFAULT_COLORS[0],
            dayStart: 1,
            dayEnd: 15,
            tasks: [],
            expanded: true,
          },
        ],
  );

  const addPhase = () => {
    const nextIdx = phases.length;
    const lastEnd = phases[phases.length - 1]?.dayEnd ?? 0;
    setPhases([
      ...phases,
      {
        id: crypto.randomUUID(),
        name: `FASE ${nextIdx + 1} — NOMBRE DE LA FASE`,
        color: DEFAULT_COLORS[nextIdx % DEFAULT_COLORS.length],
        dayStart: lastEnd + 1,
        dayEnd: lastEnd + 15,
        tasks: [],
        expanded: true,
      },
    ]);
  };

  const updatePhase = (id: string, patch: Partial<DraftPhase>) => {
    setPhases(phases.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removePhase = (id: string) => {
    if (!confirm('¿Eliminar esta fase y todas sus tareas?')) return;
    setPhases(phases.filter((p) => p.id !== id));
  };

  const addTask = (phaseId: string) => {
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const newTask: DraftTask = {
      id: crypto.randomUUID(),
      title: '',
      responsibleRole: ROLE_DEFS[0].slug,
      dayStart: phase.dayStart,
      dayEnd: Math.round((phase.dayStart + phase.dayEnd) / 2),
      priority: 'P2',
      input: '',
      output: '',
    };
    updatePhase(phaseId, { tasks: [...phase.tasks, newTask] });
  };

  const updateTask = (phaseId: string, taskId: string, patch: Partial<DraftTask>) => {
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;
    updatePhase(phaseId, {
      tasks: phase.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    });
  };

  const removeTask = (phaseId: string, taskId: string) => {
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;
    updatePhase(phaseId, { tasks: phase.tasks.filter((t) => t.id !== taskId) });
  };

  const totalTasks = phases.reduce((acc, p) => acc + p.tasks.length, 0);

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Ponle un nombre al embudo');
      return;
    }
    if (phases.length === 0) {
      toast.error('Agrega al menos una fase');
      return;
    }
    if (totalTasks === 0) {
      toast.error('Agrega al menos una tarea');
      return;
    }
    // Construye el FunnelTemplate
    const template: FunnelTemplate = {
      key: ('custom_' + Date.now()) as FunnelTemplateKey, // satisface el tipo
      emoji: '🛠️',
      name: name.trim(),
      shortDescription: 'Embudo armado a mano',
      fullDescription: 'Embudo personalizado creado desde el builder.',
      estimatedDays: { min: estimatedDays, max: estimatedDays },
      phases: phases.map((p): TemplatePhase => ({
        name: p.name,
        color: p.color,
        dayStart: p.dayStart,
        dayEnd: p.dayEnd,
        tasks: p.tasks.map((t): TemplateTask => ({
          title: t.title || 'Sin título',
          responsibleRole: t.responsibleRole,
          dayStart: t.dayStart,
          dayEnd: t.dayEnd,
          priority: t.priority,
          input: t.input || undefined,
          output: t.output || undefined,
        })),
      })),
    };
    onCreate(template, new Date(`${startDate}T00:00:00`), name.trim());
  };

  return (
    <Modal open onClose={onCancel} size="lg" title={<span className="flex items-center gap-2">🛠️ Plantilla personalizada</span>}>
      <div className="space-y-4">
        {/* Header form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Nombre del embudo</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Lanzamiento Q4 Cliente X" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Fecha de inicio</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Días estimados</span>
            <Input type="number" min={1} max={365} value={estimatedDays} onChange={(e) => setEstimatedDays(parseInt(e.target.value, 10) || 45)} />
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="heading text-sm font-bold">Fases ({phases.length}) · {totalTasks} tareas total</h3>
            <Button size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addPhase}>
              Agregar fase
            </Button>
          </div>

          {phases.map((phase) => (
            <div
              key={phase.id}
              className="rounded-[10px] border-2 bg-bg-base/30"
              style={{ borderColor: phase.color }}
            >
              {/* Phase header */}
              <div className="flex items-center gap-2 p-3" style={{ background: `${phase.color}10` }}>
                <button onClick={() => updatePhase(phase.id, { expanded: !phase.expanded })} className="text-text-muted hover:text-text-primary">
                  {phase.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <GripVertical className="h-4 w-4 text-text-muted" />
                <Input
                  value={phase.name}
                  onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                  className="flex-1 font-semibold"
                />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text-muted">Días</span>
                  <Input
                    type="number"
                    min={1}
                    value={phase.dayStart}
                    onChange={(e) => updatePhase(phase.id, { dayStart: parseInt(e.target.value, 10) || 1 })}
                    className="w-16"
                  />
                  <span className="text-[10px] text-text-muted">–</span>
                  <Input
                    type="number"
                    min={1}
                    value={phase.dayEnd}
                    onChange={(e) => updatePhase(phase.id, { dayEnd: parseInt(e.target.value, 10) || 1 })}
                    className="w-16"
                  />
                </div>
                <input
                  type="color"
                  value={phase.color}
                  onChange={(e) => updatePhase(phase.id, { color: e.target.value })}
                  className="h-7 w-10 rounded cursor-pointer"
                  title="Color de la fase"
                />
                <button onClick={() => removePhase(phase.id)} className="text-text-muted hover:text-status-danger p-1" aria-label="Eliminar fase">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Phase tasks */}
              {phase.expanded && (
                <div className="p-3 space-y-2 border-t border-border-subtle">
                  {phase.tasks.length === 0 && (
                    <div className="text-xs text-text-muted text-center py-2 italic">Sin tareas. Agrega la primera abajo.</div>
                  )}
                  {phase.tasks.map((task, tIdx) => (
                    <TaskEditor
                      key={task.id}
                      task={task}
                      phaseDayRange={[phase.dayStart, phase.dayEnd]}
                      onChange={(patch) => updateTask(phase.id, task.id, patch)}
                      onRemove={() => removeTask(phase.id, task.id)}
                      index={tIdx + 1}
                    />
                  ))}
                  <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3 w-3" />} onClick={() => addTask(phase.id)} className="w-full">
                    Agregar tarea
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-2 pt-3 border-t border-border-subtle">
          <div className="text-[11px] text-text-muted self-center">
            Crea {phases.length} fase{phases.length === 1 ? '' : 's'} con {totalTasks} tarea{totalTasks === 1 ? '' : 's'}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={totalTasks === 0}>Crear embudo personalizado</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TaskEditor({
  task, phaseDayRange, onChange, onRemove, index,
}: {
  task: DraftTask;
  phaseDayRange: [number, number];
  onChange: (patch: Partial<DraftTask>) => void;
  onRemove: () => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface p-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted w-5">{String(index).padStart(2, '0')}</span>
        <Input
          value={task.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Título de la tarea"
          className="flex-1"
        />
        <Select
          value={task.priority}
          onChange={(e) => onChange({ priority: e.target.value as 'P1' | 'P2' | 'P3' })}
          options={[
            { value: 'P1', label: 'P1' },
            { value: 'P2', label: 'P2' },
            { value: 'P3', label: 'P3' },
          ]}
          className="w-20"
        />
        <Select
          value={task.responsibleRole}
          onChange={(e) => onChange({ responsibleRole: e.target.value })}
          options={ROLE_DEFS.map((r) => ({ value: r.slug, label: r.title }))}
          className="min-w-[140px]"
        />
        <button onClick={() => setExpanded(!expanded)} className="text-text-muted hover:text-text-primary px-1">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <button onClick={onRemove} className="text-text-muted hover:text-status-danger" aria-label="Eliminar tarea">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 pl-7">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Día inicio</span>
              <Input
                type="number"
                min={phaseDayRange[0]}
                max={phaseDayRange[1]}
                value={task.dayStart}
                onChange={(e) => onChange({ dayStart: parseInt(e.target.value, 10) || phaseDayRange[0] })}
              />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Día fin</span>
              <Input
                type="number"
                min={phaseDayRange[0]}
                max={phaseDayRange[1]}
                value={task.dayEnd}
                onChange={(e) => onChange({ dayEnd: parseInt(e.target.value, 10) || phaseDayRange[1] })}
              />
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Input (qué necesita)</span>
            <Textarea
              rows={2}
              value={task.input}
              onChange={(e) => onChange({ input: e.target.value })}
              placeholder="Recursos, accesos, archivos previos…"
            />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Output (qué entrega)</span>
            <Textarea
              rows={2}
              value={task.output}
              onChange={(e) => onChange({ output: e.target.value })}
              placeholder="Entregable concreto: URL, archivo, reporte…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
