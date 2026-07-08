import { useParams, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useClientStore } from '@/store/useClientStore';
import { BrainHeader } from '@/components/brain/BrainHeader';
import { BrainNav, BRAIN_MODULES, MEMBER_MODULE_SLUGS } from '@/components/brain/BrainNav';
import { memberAllowedSlugs } from '@/config/departments';
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
import { ProgramsModule } from '@/components/brain/modules/ProgramsModule';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { useClientMode } from '@/hooks/useClientMode';

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
  const hydrated = useClientStore((s) => s.hydrated);
  const setCurrentClient = useClientStore((s) => s.setCurrentClient);
  const { isMember, canEditTasks, hasAccessToClient, departamentos } = useClientMode(id);

  // Módulos que este miembro puede abrir, según sus departamentos (misma fuente
  // que el menú BrainNav). El primero permitido es su landing por defecto.
  const allowedSlugs = memberAllowedSlugs(departamentos, MEMBER_MODULE_SLUGS);
  const firstAllowed = BRAIN_MODULES.find((m) => allowedSlugs.has(m.slug))?.slug ?? 'profile';

  useEffect(() => {
    if (id) setCurrentClient(id);
    return () => setCurrentClient(null);
  }, [id, setCurrentClient]);

  // Redirige al primer módulo permitido si no hay módulo seleccionado.
  useEffect(() => {
    if (id && !module) {
      const dest = isMember ? firstAllowed : 'profile';
      navigate(`/client/${id}/${dest}`, { replace: true });
    }
  }, [id, module, isMember, firstAllowed, navigate, location.pathname]);

  // Blindaje: un miembro solo puede abrir clientes a los que tiene acceso.
  if (isMember && id && !hasAccessToClient) {
    return <Navigate to="/mi-espacio" replace />;
  }

  // Blindaje: un miembro solo abre los módulos de sus departamentos (el resto
  // es interno). Redirige a su primer módulo permitido (nunca a uno bloqueado).
  if (isMember && module && !allowedSlugs.has(module)) {
    return <Navigate to={`/client/${id}/${firstAllowed}`} replace />;
  }

  // Aún cargando datos (enlace directo desde un correo): esperar, no rebotar.
  // Antes de hidratar, `clients` es el seed → buscar un cliente real fallaría.
  if (!client && !hydrated) {
    return (
      <div className="min-h-full flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }

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
          <ProfileModule client={client} readOnly={isMember} />
        ) : module === 'tasks' ? (
          <TasksModule client={client} readOnly={!canEditTasks} />
        ) : module === 'ropre' ? (
          <RopreModule client={client} readOnly={isMember} />
        ) : module === 'metrics' ? (
          <MetricsModule client={client} readOnly={isMember} />
        ) : module === 'content' ? (
          <ContentModule client={client} readOnly={isMember} />
        ) : module === 'team' ? (
          <TeamModule client={client} readOnly={isMember} />
        ) : module === 'projections' ? (
          <ProjectionsModule client={client} readOnly={isMember} />
        ) : module === 'planning' ? (
          <PlanningModule client={client} readOnly={isMember} />
        ) : module === 'programs' ? (
          <ProgramsModule client={client} readOnly={isMember} />
        ) : module === 'meetings' ? (
          <MeetingsModule client={client} readOnly={isMember} />
        ) : (
          <PlaceholderModule
            title={`${moduleDef.index.toString().padStart(2, '0')} · ${moduleDef.fullLabel}`}
            description={MODULE_DESCRIPTIONS[moduleDef.slug]?.description ?? ''}
            features={MODULE_DESCRIPTIONS[moduleDef.slug]?.features ?? []}
            accent={client.primaryColor}
          />
        )}
      </div>

      {/* Agente PM — solo para el owner de la agencia (el cliente no lo usa). */}
      {!isMember && <AgentPanel client={client} />}
    </div>
  );
}
