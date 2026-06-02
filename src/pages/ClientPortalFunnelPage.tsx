import { useParams } from 'react-router-dom';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { useClientStore } from '@/store/useClientStore';
import { FunnelRoadmap } from '@/components/dashboard/FunnelRoadmap';

/**
 * Vista pública para el cliente final.
 *
 * /client-portal/funnel/:funnelId
 *
 * Muestra el roadmap del embudo en modo SIMPLIFIED — sin responsables
 * internos ni acción de abrir tareas. Solo fases + % de avance.
 *
 * Sin auth por ahora (el funnelId es suficientemente único como token).
 * Más adelante se puede agregar token firmado por agencia.
 */
export function ClientPortalFunnelPage() {
  const { funnelId } = useParams();
  const funnel = useFunnelLaunchStore((s) => s.funnels.find((f) => f.id === funnelId));
  const client = useClientStore((s) => funnel ? s.clients.find((c) => c.id === funnel.clientId) : undefined);

  if (!funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="surface p-10 max-w-md text-center space-y-3">
          <h1 className="heading text-2xl font-bold">Embudo no encontrado</h1>
          <p className="text-sm text-text-secondary">
            El enlace puede haber expirado o el embudo fue eliminado.
            Contacta a tu agencia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="surface border-b border-border-subtle px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Portal cliente</div>
            <h1 className="heading text-lg font-bold">{client?.name ?? 'Cliente'}</h1>
          </div>
          <div className="text-[10px] text-text-muted">Sales Brain OS</div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6 lg:p-8">
        <FunnelRoadmap funnel={funnel} simplified />
      </main>
    </div>
  );
}
