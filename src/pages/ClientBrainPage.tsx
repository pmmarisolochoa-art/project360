import { useParams, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useClientStore } from '@/store/useClientStore';
import { BrainHeader } from '@/components/brain/BrainHeader';
import { BrainNav, BRAIN_MODULES } from '@/components/brain/BrainNav';
import { ProfileModule } from '@/components/brain/modules/ProfileModule';
import { PlaceholderModule } from '@/components/brain/modules/PlaceholderModule';
import { MeetingsModule } from '@/components/brain/modules/MeetingsModule';
import { TasksModule } from '@/components/brain/modules/TasksModule';
import { RopreModule } from '@/components/brain/modules/RopreModule';
import { MetricsModule } from '@/components/brain/modules/MetricsModule';
import { ContentModule } from '@/components/brain/modules/ContentModule';
import { TeamModule } from '@/components/brain/modules/TeamModule';
import { ProjectionsModule } from '@/components/brain/modules/ProjectionsModule';
import { PlanningModule } from '@/components/brain/modules/PlanningModule';

const MODULE_DESCRIPTIONS: Record<string, { description: string; features: string[] }> = {
  planning: {
    description:
      'Planeación operativa del proyecto: scope, fases, dependencias, riesgos y plan de comunicación con el cliente.',
    features: [
      'Vista de scope del proyecto y entregables comprometidos',
      'Calendario maestro de hitos y dependencias',
      'Matriz de stakeholders y plan de comunicación',
      'Documento de propuesta exportable',
    ],
  },
  ropre: {
    description:
      'Sistema ROPRE: Resultado esperado, Objetivos secundarios, Premisas estratégicas, Riesgos identificados y Entregables comprometidos.',
    features: [
      'Vista Kanban de entregables por estado',
      'Línea de tiempo Gantt simplificada',
      'Riesgos con nivel y plan de mitigación',
      'OKR principal con seguimiento',
    ],
  },
  projections: {
    description:
      'Simulador interactivo de funnel de conversión: alcance → CTR → leads → SQLs → ventas → facturación. Comparativo proyectado vs real.',
    features: [
      'Sliders interactivos por etapa del funnel',
      'Meta de facturación y ROAS objetivo',
      'Proyección comparada vs métricas reales',
      'Recálculo automático en tiempo real',
    ],
  },
  metrics: {
    description:
      'Dashboard unificado de Meta Ads, Google Ads, TikTok Ads y GA4. Insights con IA basados en benchmarks del sector.',
    features: [
      'Conexión a Meta / Google / TikTok / GA4',
      'Métricas clave: Spend, CTR, CPC, CPL, ROAS',
      'Gráficas de tendencia 7/14/30 días',
      'Alertas automáticas y análisis con Claude',
    ],
  },
  tasks: {
    description:
      'Kanban de tareas + sistema de recordación automática vía WhatsApp y email. Vencimientos y alertas preventivas.',
    features: [
      'Estados: Pendiente, En Progreso, Revisión, Completado, Bloqueado',
      'Prioridad P1/P2/P3, subtareas y comentarios',
      'Notificación 24h antes del vencimiento',
      'Filtros por responsable, fecha y módulo',
    ],
  },
  team: {
    description:
      'KPIs por rol del equipo (estratega, media buyer, copywriter, diseñador, community, dev). Mapa de cuellos de botella.',
    features: [
      'KPIs target vs current por rol',
      'Tasa de cumplimiento a 30 días',
      'Cuellos de botella activos visibles',
      'Indicadores diarios en tarjetas compactas',
    ],
  },
  content: {
    description:
      'Pipeline de contenido + calendario mensual. Copy generado con Claude usando contexto del cliente.',
    features: [
      'Kanban: Copy → Grabación → Edición → Revisión → Programado → Publicado',
      'Métricas por red: IG / TikTok / YT / LinkedIn / FB',
      'Aprobación/rechazo con comentarios del cliente',
      'Webhook listo para Buffer / Meta Business Suite',
    ],
  },
  meetings: {
    description:
      'Agenda con tipos de reunión predefinidos, transcripción vía Whisper, extracción automática de tareas con Claude.',
    features: [
      'Agenda auto-generada por IA según el tipo y el estado',
      'Upload + transcripción de grabaciones',
      'Extracción de tareas estructuradas desde la transcripción',
      'Seguimiento de compromisos de reuniones anteriores',
    ],
  },
};

export function ClientBrainPage() {
  const { id, module } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const client = useClientStore((s) => s.clients.find((c) => c.id === id));
  const setCurrentClient = useClientStore((s) => s.setCurrentClient);

  useEffect(() => {
    if (id) setCurrentClient(id);
    return () => setCurrentClient(null);
  }, [id, setCurrentClient]);

  // Redirige a /profile si no hay módulo seleccionado.
  useEffect(() => {
    if (id && !module) {
      navigate(`/client/${id}/profile`, { replace: true });
    }
  }, [id, module, navigate, location.pathname]);

  if (!client) {
    return <Navigate to="/" replace />;
  }

  const moduleDef = BRAIN_MODULES.find((m) => m.slug === module) ?? BRAIN_MODULES[0];

  return (
    <div className="min-h-full">
      <BrainHeader client={client} />
      <BrainNav accent={client.primaryColor} />

      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-6">
        {module === 'profile' || !module ? (
          <ProfileModule client={client} />
        ) : module === 'tasks' ? (
          <TasksModule client={client} />
        ) : module === 'ropre' ? (
          <RopreModule client={client} />
        ) : module === 'metrics' ? (
          <MetricsModule client={client} />
        ) : module === 'content' ? (
          <ContentModule client={client} />
        ) : module === 'team' ? (
          <TeamModule client={client} />
        ) : module === 'projections' ? (
          <ProjectionsModule client={client} />
        ) : module === 'planning' ? (
          <PlanningModule client={client} />
        ) : module === 'meetings' ? (
          <MeetingsModule client={client} />
        ) : (
          <PlaceholderModule
            title={`${moduleDef.index.toString().padStart(2, '0')} · ${moduleDef.fullLabel}`}
            description={MODULE_DESCRIPTIONS[moduleDef.slug]?.description ?? ''}
            features={MODULE_DESCRIPTIONS[moduleDef.slug]?.features ?? []}
            accent={client.primaryColor}
          />
        )}
      </div>
    </div>
  );
}
