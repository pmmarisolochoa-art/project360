/**
 * Plantillas canónicas de embudos de lanzamiento.
 *
 * Cada plantilla define fases + tareas con días-offset desde startDate.
 * Al "activar" una plantilla para un cliente se materializan:
 *  - 1 registro en funnels
 *  - N registros en funnel_phases
 *  - M registros en tasks (con funnelId + phaseId + dueDate calculado)
 *
 * Roles disponibles (slugs de team): strategist, media_buyer, copywriter,
 * designer, community, funnel_builder, editor, closer, onboarding.
 */

import type { FunnelTemplate } from '@/types/funnel';

const SEED_LEADMAGNET: FunnelTemplate = {
  key: 'seed_leadmagnet',
  emoji: '🚀',
  name: 'Lanzamiento Semilla + Lead Magnet',
  shortDescription: 'Estrategia orgánica con ADS de apoyo. 28-45 días. Ideal para audiencias desde cero o con comunidad pequeña.',
  fullDescription: 'Sistema de captación con Lead Magnet, calentamiento por WhatsApp + email, evento en vivo o webinar y cierre con urgencia.',
  estimatedDays: { min: 28, max: 45 },
  phases: [
    {
      name: 'FASE 1 — LEAD MAGNET Y CAPTACIÓN',
      color: '#6366F1',
      dayStart: 1,
      dayEnd: 18,
      tasks: [
        { title: 'Definir tema y promesa del Lead Magnet', responsibleRole: 'strategist', dayStart: 1, dayEnd: 1, input: 'briefing cliente', output: 'documento de propuesta', priority: 'P1' },
        { title: 'Crear Lead Magnet (ebook/checklist/guía)', responsibleRole: 'copywriter', dayStart: 1, dayEnd: 5, output: 'PDF entregable', priority: 'P1', isDeliverable: true },
        { title: 'Configurar página de captura Lead Magnet + video 1 min', responsibleRole: 'funnel_builder', dayStart: 3, dayEnd: 7, output: 'URL activa + pixel instalado', priority: 'P1' },
        { title: 'Crear secuencia de emails bienvenida (5 emails)', responsibleRole: 'copywriter', dayStart: 4, dayEnd: 8, output: 'secuencia activa en plataforma email', priority: 'P1', isDeliverable: true },
        { title: 'Configurar Grupo WhatsApp Lead Magnet + mensaje bienvenida', responsibleRole: 'community', dayStart: 5, dayEnd: 5, output: 'grupo activo + automatización' },
        { title: 'Grabar 10 anuncios tipo reels para captación', responsibleRole: 'editor', dayStart: 5, dayEnd: 10, output: '10 videos editados', priority: 'P1', isDeliverable: true },
        { title: 'Crear públicos en Meta Ads (frío, similar, remarketing)', responsibleRole: 'media_buyer', dayStart: 8, dayEnd: 8, output: 'audiencias configuradas' },
        { title: 'Lanzar campañas de captación Lead Magnet', responsibleRole: 'media_buyer', dayStart: 10, dayEnd: 10, output: 'campañas activas con presupuesto', priority: 'P1' },
        { title: 'Configurar encuesta post-registro', responsibleRole: 'funnel_builder', dayStart: 6, dayEnd: 6, output: 'formulario activo + respuestas llegando' },
        { title: 'Análisis de respuestas encuesta + ajuste de mensaje', responsibleRole: 'strategist', dayStart: 15, dayEnd: 15, input: '50+ respuestas', output: 'insights documentados' },
        { title: 'Crear contenido orgánico semanal (4 reels + 3 stories)', responsibleRole: 'community', dayStart: 1, dayEnd: 18, output: 'calendario de contenido activo', recurring: true },
      ],
    },
    {
      name: 'FASE 2 — CAPTACIÓN INMERSIVO / WEBINAR',
      color: '#8B5CF6',
      dayStart: 12,
      dayEnd: 28,
      tasks: [
        { title: 'Analizar métricas Fase 1 y validar ángulo de captación', responsibleRole: 'strategist', dayStart: 14, dayEnd: 14, output: 'informe de decisión', priority: 'P1' },
        { title: 'Crear página de captura Webinar/Evento + video 1 min', responsibleRole: 'funnel_builder', dayStart: 14, dayEnd: 18, output: 'URL activa', priority: 'P1' },
        { title: 'Crear Grupo WhatsApp Captación Webinar', responsibleRole: 'community', dayStart: 15, dayEnd: 15, output: 'grupo activo + secuencia' },
        { title: 'Configurar secuencia calentamiento WhatsApp (7 días)', responsibleRole: 'copywriter', dayStart: 15, dayEnd: 16, output: '7 mensajes programados', priority: 'P1', isDeliverable: true },
        { title: 'Crear secuencia correos electrónicos calentamiento (4 emails)', responsibleRole: 'copywriter', dayStart: 15, dayEnd: 16, output: 'secuencia activa', priority: 'P1', isDeliverable: true },
        { title: 'Lanzar campañas captación Webinar', responsibleRole: 'media_buyer', dayStart: 18, dayEnd: 18, output: 'campañas activas', priority: 'P1' },
        { title: 'Preparar EN VIVOS semanales de calentamiento (4 lives)', responsibleRole: 'community', dayStart: 18, dayEnd: 26, output: '4 lives ejecutados', recurring: true },
        { title: 'Crear material Ensayo/Webinar (presentación + guión)', responsibleRole: 'strategist', dayStart: 20, dayEnd: 25, output: 'deck aprobado', priority: 'P1', isDeliverable: true },
      ],
    },
    {
      name: 'FASE 3 — EVENTO: EN VIVOS / WEBINAR',
      color: '#EC4899',
      dayStart: 26,
      dayEnd: 35,
      tasks: [
        { title: 'Ejecutar Ensayo/Webinar con el cliente', responsibleRole: 'strategist', dayStart: 27, dayEnd: 27, output: 'grabación + feedback', priority: 'P1' },
        { title: 'Configurar sala VIP y oferta especial pre-webinar', responsibleRole: 'funnel_builder', dayStart: 26, dayEnd: 26, output: 'sala activa + checkout configurado' },
        { title: 'Ejecutar Webinar principal', responsibleRole: 'strategist', dayStart: 28, dayEnd: 30, output: 'grabación del webinar', priority: 'P1' },
        { title: 'Lanzar anuncios de ventas post-webinar (retargeting)', responsibleRole: 'media_buyer', dayStart: 30, dayEnd: 30, output: 'campañas ventas activas', priority: 'P1' },
        { title: 'Activar secuencias mensajes ventas WhatsApp (5 días)', responsibleRole: 'copywriter', dayStart: 30, dayEnd: 35, output: 'secuencias activas', priority: 'P1', isDeliverable: true },
        { title: 'Publicar Replay con CTA y fecha de cierre', responsibleRole: 'funnel_builder', dayStart: 31, dayEnd: 31, output: 'replay activo' },
      ],
    },
    {
      name: 'FASE 4 — CIERRE Y POST-VENTA',
      color: '#10B981',
      dayStart: 33,
      dayEnd: 45,
      tasks: [
        { title: 'Secuencia email urgencia + escasez (3 emails)', responsibleRole: 'copywriter', dayStart: 33, dayEnd: 37, output: '3 emails enviados', priority: 'P1', isDeliverable: true },
        { title: 'EN VIVO cierre de carrito con Q&A', responsibleRole: 'strategist', dayStart: 35, dayEnd: 37, output: 'live ejecutado', priority: 'P1' },
        { title: 'Contacto directo vía WhatsApp a leads calificados', responsibleRole: 'community', dayStart: 33, dayEnd: 38, output: 'conversaciones activas' },
        { title: 'Cerrar carrito + comunicar a lista', responsibleRole: 'community', dayStart: 38, dayEnd: 38, output: 'email + WA de cierre enviados', priority: 'P1' },
        { title: 'Proceso de onboarding compradores', responsibleRole: 'onboarding', dayStart: 38, dayEnd: 45, output: 'compradores en plataforma' },
        { title: 'Análisis de resultados del lanzamiento', responsibleRole: 'strategist', dayStart: 43, dayEnd: 43, output: 'informe de métricas completo' },
        { title: 'Reunión de cierre con cliente + ROPRE actualizado', responsibleRole: 'project_manager', dayStart: 45, dayEnd: 45, output: 'ROPRE actualizado + próximos pasos', priority: 'P1' },
      ],
    },
  ],
};

const PAID_WORKSHOP: FunnelTemplate = {
  key: 'paid_workshop',
  emoji: '💰',
  name: 'Lanzamiento Pago (Workshop/Webinar)',
  shortDescription: 'Inversión en pauta desde el día 1. 30-60 días. Mayor velocidad de resultados con presupuesto ADS.',
  fullDescription: 'Setup técnico + creativos + ADS desde el día 1. Taller de valor seguido de oferta y downsell.',
  estimatedDays: { min: 30, max: 60 },
  phases: [
    {
      name: 'FASE 1 — SETUP ADS + CONTENIDO ORGÁNICO',
      color: '#F59E0B',
      dayStart: 1,
      dayEnd: 15,
      tasks: [
        { title: 'Configurar pixel Meta + eventos de conversión', responsibleRole: 'media_buyer', dayStart: 1, dayEnd: 3, output: 'pixel verificado', priority: 'P1' },
        { title: 'Crear automatización ManyChat "comenta palabra X"', responsibleRole: 'funnel_builder', dayStart: 2, dayEnd: 5, output: 'automatización activa' },
        { title: 'Grabar reels/posts/carruseles/historias para orgánico (10 piezas)', responsibleRole: 'editor', dayStart: 3, dayEnd: 12, output: '10 piezas publicadas', priority: 'P1', isDeliverable: true },
        { title: 'Crear 5 anuncios de venta tipo video VSL corto', responsibleRole: 'editor', dayStart: 5, dayEnd: 12, output: '5 videos aprobados', priority: 'P1', isDeliverable: true },
        { title: 'Configurar página de ventas + VSL', responsibleRole: 'funnel_builder', dayStart: 7, dayEnd: 14, output: 'URL activa', priority: 'P1' },
        { title: 'Configurar Order Bumps y Upsell en checkout', responsibleRole: 'funnel_builder', dayStart: 10, dayEnd: 14, output: 'checkout con bumps activo' },
        { title: 'Crear Downsell configurado', responsibleRole: 'funnel_builder', dayStart: 12, dayEnd: 15, output: 'downsell activo' },
        { title: 'Crear públicos Meta Ads (frío, similar, remarketing)', responsibleRole: 'media_buyer', dayStart: 5, dayEnd: 10, output: 'audiencias listas' },
      ],
    },
    {
      name: 'FASE 2 — LANZAMIENTO CON ADS',
      color: '#EF4444',
      dayStart: 15,
      dayEnd: 35,
      tasks: [
        { title: 'Lanzar anuncios de venta + inversión $1/día Follow Me', responsibleRole: 'media_buyer', dayStart: 15, dayEnd: 15, output: 'campañas activas', priority: 'P1' },
        { title: 'Monitoreo diario de ADS y optimización', responsibleRole: 'media_buyer', dayStart: 15, dayEnd: 35, output: 'reporte diario de métricas', recurring: true },
        { title: 'Escalar campañas ganadoras (ROAS > objetivo)', responsibleRole: 'media_buyer', dayStart: 20, dayEnd: 20, output: 'campañas escaladas' },
        { title: 'Configurar Grupo WhatsApp VIP compradores', responsibleRole: 'community', dayStart: 15, dayEnd: 15, output: 'grupo activo' },
        { title: 'Crear secuencia bienvenida + expectativa (11 mensajes WhatsApp)', responsibleRole: 'copywriter', dayStart: 14, dayEnd: 15, output: 'secuencia programada', priority: 'P1', isDeliverable: true },
        { title: 'Ejecutar Taller/Workshop de Valor', responsibleRole: 'strategist', dayStart: 25, dayEnd: 30, output: 'taller grabado', priority: 'P1' },
        { title: 'Activar secuencia mensajes venta (5 días post-taller)', responsibleRole: 'copywriter', dayStart: 30, dayEnd: 35, output: 'mensajes enviados', priority: 'P1', isDeliverable: true },
      ],
    },
    {
      name: 'FASE 3 — OFERTA 1:1 + DOWNSELL',
      color: '#8B5CF6',
      dayStart: 33,
      dayEnd: 45,
      tasks: [
        { title: 'Lanzar oferta Acompañamiento 1:1 a compradores', responsibleRole: 'closer', dayStart: 33, dayEnd: 38, output: 'propuestas enviadas', priority: 'P1' },
        { title: 'Activar automatizaciones post-compra', responsibleRole: 'funnel_builder', dayStart: 35, dayEnd: 35, output: 'flujos automáticos activos' },
        { title: 'Ofrecer Downsell a quienes no compraron taller', responsibleRole: 'copywriter', dayStart: 38, dayEnd: 43, output: 'downsell enviado' },
        { title: 'Análisis de resultados + optimización para próxima ronda', responsibleRole: 'strategist', dayStart: 45, dayEnd: 45, output: 'documento de aprendizajes', priority: 'P1' },
      ],
    },
  ],
};

const INTERNAL_LAUNCH: FunnelTemplate = {
  key: 'internal_launch',
  emoji: '🌱',
  name: 'Lanzamiento Interno (Solo orgánico)',
  shortDescription: 'Sin pauta. Usando solo audiencia existente. Redes sociales + WhatsApp + comunidad.',
  fullDescription: 'Activación 100% orgánica con audiencia propia. 30-45 días. Cero inversión publicitaria.',
  estimatedDays: { min: 30, max: 45 },
  phases: [
    {
      name: 'FASE 1 — ACTIVACIÓN DE AUDIENCIA',
      color: '#06B6D4',
      dayStart: 1,
      dayEnd: 15,
      tasks: [
        { title: 'Auditoría de audiencia actual (seguidores, lista email, WA)', responsibleRole: 'strategist', dayStart: 1, dayEnd: 3, output: 'mapa de audiencias disponibles', priority: 'P1' },
        { title: 'Plan de contenido de activación (3 semanas)', responsibleRole: 'strategist', dayStart: 1, dayEnd: 5, output: 'calendario aprobado', priority: 'P1', isDeliverable: true },
        { title: 'Crear 12 reels de valor + educación (3 por semana)', responsibleRole: 'editor', dayStart: 5, dayEnd: 26, output: 'reels publicados', recurring: true, priority: 'P1', isDeliverable: true },
        { title: 'Activar lives semanales de calentamiento', responsibleRole: 'community', dayStart: 7, dayEnd: 28, output: '3-4 lives ejecutados', recurring: true },
        { title: 'Configurar grupo WhatsApp de comunidad', responsibleRole: 'community', dayStart: 3, dayEnd: 3, output: 'grupo activo' },
      ],
    },
    {
      name: 'FASE 2 — CAPTACIÓN GRATUITA',
      color: '#10B981',
      dayStart: 10,
      dayEnd: 25,
      tasks: [
        { title: 'Crear Lead Magnet para captar emails/WA', responsibleRole: 'copywriter', dayStart: 5, dayEnd: 10, output: 'lead magnet listo', priority: 'P1', isDeliverable: true },
        { title: 'Configurar página de captura (sin ADS, solo bio+stories)', responsibleRole: 'funnel_builder', dayStart: 8, dayEnd: 12, output: 'URL activa en bio' },
        { title: 'Stories diarias con CTA al lead magnet (15 días)', responsibleRole: 'community', dayStart: 10, dayEnd: 25, output: 'stories publicadas', recurring: true },
        { title: 'Crear secuencia email calentamiento (5 emails)', responsibleRole: 'copywriter', dayStart: 10, dayEnd: 12, output: 'secuencia activa', priority: 'P1', isDeliverable: true },
      ],
    },
    {
      name: 'FASE 3 — EVENTO Y CIERRE',
      color: '#EC4899',
      dayStart: 25,
      dayEnd: 45,
      tasks: [
        { title: 'Ejecutar Webinar/Live de oferta', responsibleRole: 'strategist', dayStart: 28, dayEnd: 30, output: 'live grabado', priority: 'P1' },
        { title: 'Secuencia WhatsApp post-evento (5 días)', responsibleRole: 'copywriter', dayStart: 30, dayEnd: 35, output: 'mensajes enviados', priority: 'P1', isDeliverable: true },
        { title: 'Contacto 1:1 a leads más comprometidos', responsibleRole: 'closer', dayStart: 30, dayEnd: 38, output: 'conversaciones de venta', priority: 'P1' },
        { title: 'Cierre y onboarding compradores', responsibleRole: 'onboarding', dayStart: 38, dayEnd: 45, output: 'compradores activos' },
      ],
    },
  ],
};

const EVERGREEN_SOCIAL: FunnelTemplate = {
  key: 'evergreen_social',
  emoji: '♾️',
  name: 'Evergreen / Social Funnel',
  shortDescription: 'Sistema de ventas siempre activo. Operación mensual. Combina ADS + contenido orgánico + automatizaciones.',
  fullDescription: 'Sistema 24/7 con ROAS estable. Setup inicial de 3 semanas + operación mensual recurrente.',
  estimatedDays: { min: 21, max: 30 },
  phases: [
    {
      name: 'FASE 1 — SETUP INICIAL',
      color: '#6366F1',
      dayStart: 1,
      dayEnd: 21,
      tasks: [
        { title: 'Instalar y verificar pixel Meta + Google Ads', responsibleRole: 'media_buyer', dayStart: 1, dayEnd: 3, output: 'tracking activo', priority: 'P1' },
        { title: 'Crear landing de ventas con VSL o video de ventas', responsibleRole: 'funnel_builder', dayStart: 3, dayEnd: 14, output: 'URL activa', priority: 'P1' },
        { title: 'Configurar secuencia email nurturing (5 pasos)', responsibleRole: 'copywriter', dayStart: 7, dayEnd: 14, output: 'secuencia activa', priority: 'P1', isDeliverable: true },
        { title: 'Configurar automatización CRM/WhatsApp Business', responsibleRole: 'funnel_builder', dayStart: 10, dayEnd: 18, output: 'flujos automáticos' },
        { title: 'Crear públicos Meta Ads + Google (frío, similar, remarketing)', responsibleRole: 'media_buyer', dayStart: 10, dayEnd: 14, output: 'audiencias listas' },
        { title: 'Lanzar campañas ADS iniciales (fase de aprendizaje)', responsibleRole: 'media_buyer', dayStart: 18, dayEnd: 18, output: 'campañas activas', priority: 'P1' },
        { title: 'Configurar flujo: Ad → Página → Lead → CRM → Email + WA', responsibleRole: 'funnel_builder', dayStart: 15, dayEnd: 21, output: 'flujo end-to-end probado' },
      ],
    },
    {
      name: 'FASE 2 — OPERACIÓN MENSUAL (recurrente)',
      color: '#10B981',
      dayStart: 22,
      dayEnd: 60,
      tasks: [
        { title: 'Crear 12 reels de contenido (3 por semana)', responsibleRole: 'community', dayStart: 22, dayEnd: 60, output: 'reels publicados', recurring: true },
        { title: 'Publicar 1 email semanal a la lista', responsibleRole: 'copywriter', dayStart: 22, dayEnd: 60, output: 'emails enviados', recurring: true },
        { title: 'Revisión y optimización de ADS cada 3 días', responsibleRole: 'media_buyer', dayStart: 22, dayEnd: 60, output: 'campañas optimizadas', recurring: true },
        { title: 'Seguimiento a leads calificados por WhatsApp', responsibleRole: 'community', dayStart: 22, dayEnd: 60, output: 'leads contactados', recurring: true },
        { title: 'Reporte mensual de métricas y ajuste de estrategia', responsibleRole: 'strategist', dayStart: 30, dayEnd: 30, output: 'reporte completo', priority: 'P1' },
        { title: 'A/B test de nuevas creatividades (2 variantes/mes)', responsibleRole: 'designer', dayStart: 22, dayEnd: 60, output: 'tests activos', recurring: true },
        { title: 'Revisión de landing y copy según métricas de conversión', responsibleRole: 'funnel_builder', dayStart: 30, dayEnd: 30, output: 'optimizaciones aplicadas' },
      ],
    },
  ],
};

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  SEED_LEADMAGNET,
  PAID_WORKSHOP,
  INTERNAL_LAUNCH,
  EVERGREEN_SOCIAL,
];

export function getTemplate(key: string): FunnelTemplate | undefined {
  return FUNNEL_TEMPLATES.find((t) => t.key === key);
}
