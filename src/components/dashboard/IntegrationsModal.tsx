import { Calendar, Video, Users as UsersIcon, Link as LinkIcon, AppWindow } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useIntegrationsStore, type IntegrationKey } from '@/store/useIntegrationsStore';
import { toast } from '@/store/useToastStore';

const INTEGRATIONS: Array<{ key: IntegrationKey; name: string; icon: typeof Calendar; description: string }> = [
  { key: 'googleCalendar', name: 'Google Calendar', icon: Calendar, description: 'Sincroniza reuniones bidireccional' },
  { key: 'calendly',       name: 'Calendly',        icon: LinkIcon, description: 'Importa reuniones agendadas automáticamente' },
  { key: 'zoom',           name: 'Zoom',            icon: Video,    description: 'Agrega links de Zoom automáticamente' },
  { key: 'googleMeet',     name: 'Google Meet',     icon: Video,    description: 'Genera links de Meet para cada reunión' },
  { key: 'teams',          name: 'Microsoft Teams', icon: UsersIcon,description: 'Para equipos que usan ecosistema Microsoft' },
];

export function IntegrationsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useIntegrationsStore();

  return (
    <Modal open={open} onClose={onClose} title={
      <span className="flex items-center gap-2"><AppWindow className="h-4 w-4" /> Configurar integraciones de agenda</span>
    }>
      <p className="text-sm text-text-secondary mb-4">
        Conecta servicios externos para sincronizar reuniones, videollamadas y eventos.
      </p>

      <div className="space-y-2">
        {INTEGRATIONS.map((it) => {
          const data = state[it.key];
          const connected = data.connected;
          return (
            <div key={it.key} className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-bg-elevated border border-border-default flex items-center justify-center text-text-secondary shrink-0">
                  <it.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-text-primary">{it.name}</div>
                    {connected && <Badge tone="success">Conectado ✓</Badge>}
                  </div>
                  <div className="text-[11px] text-text-muted">{it.description}</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled
                  title="Integración real en desarrollo"
                  onClick={() => toast.info(`${it.name} — Próximamente`)}
                >
                  Próximamente
                </Button>
              </div>
              {it.key === 'calendly' && data.connected && 'url' in data && (
                <Input
                  className="mt-2"
                  placeholder="URL de tu Calendly (https://calendly.com/...)"
                  value={state.calendly.url}
                  onChange={(e) => state.setCalendlyUrl(e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-md border border-border-subtle bg-bg-base/30 p-3 text-[11px] text-text-muted leading-relaxed">
        <strong>En desarrollo:</strong> las integraciones OAuth reales con Google Calendar, Calendly, Zoom, Meet y Teams se habilitarán en una fase posterior. La infraestructura está lista (endpoint <code>/api/google/*</code> y tablas de tokens), falta la implementación final del flujo OAuth.
      </div>
    </Modal>
  );
}
