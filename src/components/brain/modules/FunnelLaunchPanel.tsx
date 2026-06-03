import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Rocket, Trash2, Play, Pause, Share2, Archive, ChevronDown } from 'lucide-react';
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
  // IMPORTANTE: el selector debe devolver una referencia estable. Filtrar
  // dentro del selector crea un array nuevo en cada render y dispara
  // "Maximum update depth exceeded" en Zustand + StrictMode.
  const allFunnels = useFunnelLaunchStore((s) => s.funnels);
  const funnels = useMemo(() => allFunnels.filter((f) => f.clientId === client.id), [allFunnels, client.id]);
  const activateFromTemplate = useFunnelLaunchStore((s) => s.activateFromTemplate);
  const setStatus = useFunnelLaunchStore((s) => s.setStatus);
  const remove = useFunnelLaunchStore((s) => s.remove);

  // Persistimos el funnel activo por cliente en localStorage para que sobreviva
  // el refresh. Cuando configuremos active_funnel_id en Supabase migramos a eso.
  const persistKey = `p360.activeFunnel.${client.id}`;
  const [selectedFunnelId, setSelectedFunnelIdRaw] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(persistKey);
  });
  const setSelectedFunnelId = (id: string | null) => {
    setSelectedFunnelIdRaw(id);
    try {
      if (id) localStorage.setItem(persistKey, id);
      else localStorage.removeItem(persistKey);
    } catch { /* quota lleno o storage bloqueado — silencioso */ }
  };
  const [creating, setCreating] = useState<FunnelTemplate | null>(null);

  // Separamos activos (visibles como tabs) de archivados (historial colapsable).
  const activeFunnels = useMemo(() => funnels.filter((f) => f.status !== 'completed' && f.status !== 'cancelled'), [funnels]);
  const archivedFunnels = useMemo(() => funnels.filter((f) => f.status === 'completed' || f.status === 'cancelled'), [funnels]);

  const [showHistory, setShowHistory] = useState(false);

  // Selección efectiva: usa lo persistido, si no, primero activo.
  const selectedFunnel = funnels.find((f) => f.id === selectedFunnelId) ?? activeFunnels[0] ?? funnels[0] ?? null;

  // Modal de creación se rendera SIEMPRE al final — evita que el early
  // return del empty state nos haga perder el modal cuando aún no hay
  // embudos.
  const createModal = creating ? (
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
  ) : null;

  if (funnels.length === 0) {
    return (
      <>
        <TemplateGallery
          accent={client.primaryColor}
          onSelect={(template) => setCreating(template)}
        />
        {createModal}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab nav embudos activos */}
      <div className="surface p-3 flex items-center gap-2 flex-wrap">
        {activeFunnels.map((f) => {
          const statusDot = f.status === 'active' ? 'bg-status-success' : f.status === 'paused' ? 'bg-status-warning' : 'bg-text-muted';
          const isActive = selectedFunnelId === f.id || (!selectedFunnelId && f.id === activeFunnels[0]?.id);
          return (
            <button
              key={f.id}
              onClick={() => setSelectedFunnelId(f.id)}
              className={`text-xs px-3 py-1.5 rounded-md transition inline-flex items-center gap-1.5 ${isActive ? 'bg-accent-violet/15 text-accent-violet font-semibold' : 'text-text-secondary hover:bg-bg-elevated'}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              🚀 {f.name}
            </button>
          );
        })}
        <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setSelectedFunnelId('__new__')}>
          Nuevo embudo
        </Button>
        {archivedFunnels.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs px-3 py-1.5 rounded-md transition inline-flex items-center gap-1 text-text-muted hover:bg-bg-elevated ml-auto"
          >
            <Archive className="h-3 w-3" />
            Historial ({archivedFunnels.length})
            <ChevronDown className={`h-3 w-3 transition ${showHistory ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Historial colapsable */}
      {showHistory && archivedFunnels.length > 0 && (
        <div className="surface p-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Embudos archivados</div>
          {archivedFunnels.map((f) => (
            <button
              key={f.id}
              onClick={() => { setSelectedFunnelId(f.id); setShowHistory(false); }}
              className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-bg-elevated flex items-center gap-2 opacity-70 hover:opacity-100"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
              📦 {f.name}
              <Badge tone="neutral" className="ml-auto">{f.status}</Badge>
            </button>
          ))}
        </div>
      )}

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
            accent={client.primaryColor}
            onOpenTask={(taskId) => navigate(`/client/${client.id}/tasks?task=${taskId}`)}
          />

          {/* Controles del embudo */}
          <div className="surface p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>Estado:</span>
              <Badge tone={selectedFunnel.status === 'active' ? 'success' : 'warning'}>{selectedFunnel.status}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Share2 className="h-3.5 w-3.5" />}
                onClick={() => {
                  const url = `${window.location.origin}/client-portal/funnel/${selectedFunnel.id}`;
                  void navigator.clipboard.writeText(url);
                  toast.success('Link del portal cliente copiado al portapapeles');
                }}
              >
                Compartir con cliente
              </Button>
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
              {selectedFunnel.status !== 'completed' && selectedFunnel.status !== 'cancelled' && (
                <Button size="sm" variant="secondary" leftIcon={<Archive className="h-3.5 w-3.5" />} onClick={() => {
                  setStatus(selectedFunnel.id, 'completed');
                  toast.success('Embudo archivado · visible en Historial');
                }}>
                  Archivar
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

      {createModal}
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
