import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Rocket, Trash2, Play, Pause } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Client } from '@/types/client';
import type { FunnelTemplate } from '@/types/funnel';
import { FUNNEL_TEMPLATES } from '@/data/funnelTemplates';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { FunnelRoadmap } from '@/components/dashboard/FunnelRoadmap';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/useToastStore';
import { format } from 'date-fns';

/**
 * Panel principal del sistema de Embudos en el módulo Planeación.
 *
 * Estados:
 *  - Sin embudos → muestra TemplateSelector con las 4 plantillas
 *  - Con embudos → tabs por embudo + roadmap del activo
 */
export function FunnelLaunchPanel({ client }: { client: Client }) {
  const navigate = useNavigate();
  const funnels = useFunnelLaunchStore((s) => s.byClient(client.id));
  const activateFromTemplate = useFunnelLaunchStore((s) => s.activateFromTemplate);
  const setStatus = useFunnelLaunchStore((s) => s.setStatus);
  const remove = useFunnelLaunchStore((s) => s.remove);

  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(funnels[0]?.id ?? null);
  const [creating, setCreating] = useState<FunnelTemplate | null>(null);

  const selectedFunnel = funnels.find((f) => f.id === selectedFunnelId) ?? funnels[0] ?? null;

  if (funnels.length === 0) {
    return (
      <TemplateGallery
        accent={client.primaryColor}
        onSelect={(template) => setCreating(template)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab nav embudos */}
      <div className="surface p-3 flex items-center gap-2 flex-wrap">
        {funnels.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFunnelId(f.id)}
            className={`text-xs px-3 py-1.5 rounded-md transition ${selectedFunnelId === f.id || (selectedFunnelId === null && f.id === funnels[0].id) ? 'bg-accent-violet/15 text-accent-violet font-semibold' : 'text-text-secondary hover:bg-bg-elevated'}`}
          >
            🚀 {f.name}
          </button>
        ))}
        <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setSelectedFunnelId('__new__')}>
          Nuevo embudo
        </Button>
      </div>

      {/* Si tab "__new__", muestra galería */}
      {selectedFunnelId === '__new__' ? (
        <TemplateGallery
          accent={client.primaryColor}
          onSelect={(template) => setCreating(template)}
        />
      ) : selectedFunnel ? (
        <>
          <FunnelRoadmap
            funnel={selectedFunnel}
            onOpenTask={(taskId) => navigate(`/client/${client.id}/tasks?task=${taskId}`)}
          />

          {/* Controles del embudo */}
          <div className="surface p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>Estado:</span>
              <Badge tone={selectedFunnel.status === 'active' ? 'success' : 'warning'}>{selectedFunnel.status}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {selectedFunnel.status !== 'active' && (
                <Button size="sm" variant="secondary" leftIcon={<Play className="h-3.5 w-3.5" />} onClick={() => { setStatus(selectedFunnel.id, 'active'); toast.success('Embudo activado'); }}>
                  Activar
                </Button>
              )}
              {selectedFunnel.status === 'active' && (
                <Button size="sm" variant="secondary" leftIcon={<Pause className="h-3.5 w-3.5" />} onClick={() => { setStatus(selectedFunnel.id, 'paused'); toast.info('Embudo pausado'); }}>
                  Pausar
                </Button>
              )}
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => {
                if (confirm(`¿Eliminar el embudo "${selectedFunnel.name}"? Las tareas se conservan pero pierden vínculo al embudo.`)) {
                  remove(selectedFunnel.id);
                  setSelectedFunnelId(null);
                  toast.success('Embudo eliminado');
                }
              }}>Eliminar</Button>
            </div>
          </div>
        </>
      ) : null}

      {/* Modal de creación */}
      {creating && (
        <CreateFunnelModal
          template={creating}
          onCancel={() => setCreating(null)}
          onConfirm={(startDate, customName) => {
            const funnel = activateFromTemplate(client.id, creating.key, startDate, customName);
            if (funnel) {
              toast.success(`Embudo activado · ${creating.phases.reduce((acc, p) => acc + p.tasks.length, 0)} tareas creadas`);
              setSelectedFunnelId(funnel.id);
            }
            setCreating(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateGallery({
  accent, onSelect,
}: { accent: string; onSelect: (t: FunnelTemplate) => void }) {
  return (
    <div className="surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4" style={{ color: accent }} />
        <h3 className="heading text-base font-bold">Elige una plantilla de embudo</h3>
      </div>
      <p className="text-xs text-text-muted">
        Cada plantilla materializa fases y tareas automáticamente con fechas calculadas desde el día 1 que elijas.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FUNNEL_TEMPLATES.map((t) => (
          <motion.button
            key={t.key}
            onClick={() => onSelect(t)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01 }}
            className="text-left rounded-[10px] border border-border-default bg-bg-base/30 hover:border-accent-violet/60 hover:bg-accent-violet/5 p-4 transition"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{t.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-bold text-text-primary">{t.name}</div>
                <div className="text-[11px] text-text-muted mt-0.5">{t.estimatedDays.min}-{t.estimatedDays.max} días · {t.phases.length} fases · {t.phases.reduce((acc, p) => acc + p.tasks.length, 0)} tareas</div>
              </div>
            </div>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">{t.shortDescription}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function CreateFunnelModal({
  template, onCancel, onConfirm,
}: {
  template: FunnelTemplate;
  onCancel: () => void;
  onConfirm: (startDate: Date, customName: string) => void;
}) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [name, setName] = useState(template.name);
  const totalTasks = template.phases.reduce((acc, p) => acc + p.tasks.length, 0);

  return (
    <Modal open onClose={onCancel} title={<span className="flex items-center gap-2">{template.emoji} {template.name}</span>}>
      <div className="space-y-4">
        <p className="text-xs text-text-secondary leading-relaxed">{template.fullDescription}</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Nombre del embudo</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={template.name} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Fecha de inicio (día 1)</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
        </div>

        <div className="rounded-md border border-border-subtle bg-bg-base/40 p-3">
          <div className="text-[11px] text-text-muted mb-2">Se crearán automáticamente:</div>
          <ul className="text-xs text-text-secondary space-y-1">
            <li>· <strong>{template.phases.length} fases</strong> con días de inicio/fin calculados</li>
            <li>· <strong>{totalTasks} tareas</strong> con responsable sugerido, fecha límite y prioridad</li>
            <li>· Las tareas aparecen en el módulo Tareas con tag <code>funnel</code></li>
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm(new Date(`${startDate}T00:00:00`), name.trim() || template.name)}>
            Crear {totalTasks} tareas y activar embudo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
