import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { useClientStore } from '@/store/useClientStore';
import { FunnelLaunchRepo } from '@/services/repositories';
import { FunnelRoadmap } from '@/components/dashboard/FunnelRoadmap';
import type { Funnel } from '@/types/funnel';
import type { Task } from '@/types/task';

/**
 * Vista pública para el cliente final.
 *
 * /client-portal/funnel/:token
 *
 * El token es un UUID generado al crear el embudo (columna share_token).
 * Llamamos a la RPC SECURITY DEFINER `get_funnel_by_share_token` que devuelve
 * funnel + phases + tasks + client; hidratamos los stores con solo esos datos
 * para que <FunnelRoadmap simplified /> renderice sin tocar el resto del backend.
 */
export function ClientPortalFunnelPage() {
  const { token } = useParams();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'not_found' }
    | { status: 'ok'; funnel: Funnel; clientName: string; clientColor: string }
  >({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'not_found' });
      return;
    }
    let alive = true;
    void (async () => {
      const data = await FunnelLaunchRepo.getByShareToken(token);
      if (!alive) return;
      if (!data) {
        setState({ status: 'not_found' });
        return;
      }
      // Hidratamos los stores solo con este embudo para que FunnelRoadmap
      // (que lee de los stores) renderice sin más dependencias.
      useFunnelLaunchStore.setState({
        funnels: [data.funnel],
        phases: data.phases,
      });
      // Convertimos las tareas públicas al shape mínimo que FunnelRoadmap usa.
      const tasks: Task[] = data.tasks.map((t) => ({
        id: t.id,
        clientId: data.client.id,
        title: t.title,
        status: t.status as Task['status'],
        priority: t.priority as Task['priority'],
        assignedTo: '',
        dueDate: t.dueDate,
        startDate: t.startDate,
        isDelayed: false,
        delayDays: 0,
        moduleTag: 'funnel',
        tag: 'strategy',
        funnelId: t.funnelId,
        phaseId: t.phaseId,
        createdAt: t.dueDate,
      }));
      useClientStore.setState({ tasks });
      setState({
        status: 'ok',
        funnel: data.funnel,
        clientName: data.client.name,
        clientColor: data.client.primaryColor,
      });
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-sm text-text-muted">Cargando embudo…</div>
      </div>
    );
  }

  if (state.status === 'not_found') {
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
            <h1 className="heading text-lg font-bold">{state.clientName}</h1>
          </div>
          <div className="text-[10px] text-text-muted">Sales Brain OS</div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6 lg:p-8">
        <FunnelRoadmap funnel={state.funnel} simplified accent={state.clientColor} />
      </main>
    </div>
  );
}
