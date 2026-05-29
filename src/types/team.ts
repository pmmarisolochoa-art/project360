export type TeamRoleSlug =
  | 'strategist'
  | 'media_buyer'
  | 'copywriter'
  | 'designer'
  | 'community'
  | 'funnel_builder';

export type KpiDirection = 'higher_better' | 'lower_better';

export interface KpiDef {
  key: string;
  label: string;
  unit?: string;
  target: number;
  direction: KpiDirection;
  // Umbrales relativos al target: rojo si peor que red, amarillo si entre red y yellow, verde si ≥ target.
  redThreshold?: number;
  yellowThreshold?: number;
  hint?: string;
}

export interface RoleDef {
  slug: TeamRoleSlug;
  title: string;
  fullTitle: string;
  functions: string[];
  kpis: KpiDef[];
}

export interface RoleAssignment {
  clientId: string;
  roleSlug: TeamRoleSlug;
  memberName: string;
  bottleneck: string;
  weeklyAchievements: string;
  kpiValues: Record<string, number>; // override de valores actuales si se ingresan a mano
}

/* ─────────────── Definición canónica de roles ─────────────── */

export const ROLE_DEFS: RoleDef[] = [
  {
    slug: 'strategist',
    title: 'Estratega Digital',
    fullTitle: 'Estratega Digital / Account Strategist',
    functions: [
      'Definir y documentar la estrategia omnicanal del cliente',
      'Supervisar el cumplimiento del ROPRE',
      'Liderar reuniones semanales de performance',
      'Identificar oportunidades de upsell y nuevos ángulos estratégicos',
      'Aprobar creatividades antes de pasar a producción',
      'Analizar benchmarks del sector y actualizarlos mensualmente',
    ],
    kpis: [
      { key: 'ropre_compliance', label: 'Cumplimiento ROPRE', unit: '%', target: 90, direction: 'higher_better', redThreshold: 70, yellowThreshold: 85 },
      { key: 'client_nps', label: 'NPS cliente', unit: '/10', target: 8, direction: 'higher_better', redThreshold: 6, yellowThreshold: 7 },
      { key: 'forecast_real', label: 'Proyección vs Real', unit: '%', target: 100, direction: 'higher_better', redThreshold: 70, yellowThreshold: 90 },
      { key: 'insights_count', label: 'Insights documentados/mes', target: 6, direction: 'higher_better', redThreshold: 2, yellowThreshold: 4 },
      { key: 'response_time', label: 'Tiempo respuesta', unit: 'h', target: 4, direction: 'lower_better', redThreshold: 12, yellowThreshold: 6 },
      { key: 'meeting_rate', label: 'Reuniones cumplidas', unit: '%', target: 100, direction: 'higher_better', redThreshold: 80, yellowThreshold: 95 },
    ],
  },
  {
    slug: 'media_buyer',
    title: 'Media Buyer',
    fullTitle: 'Media Buyer / Paid Media Specialist',
    functions: [
      'Crear, optimizar y escalar campañas en Meta, Google, TikTok',
      'Gestión diaria de presupuesto y ajuste de pujas',
      'A/B testing de creatividades y audiencias',
      'Reportes semanales de performance',
      'Investigación de audiencias y nuevos segmentos',
      'Análisis de competencia en pauta (AdLibrary, SimilarWeb)',
    ],
    kpis: [
      { key: 'roas', label: 'ROAS', unit: 'x', target: 3, direction: 'higher_better', redThreshold: 2, yellowThreshold: 2.5 },
      { key: 'cpl', label: 'CPL', unit: '$', target: 5, direction: 'lower_better', redThreshold: 12, yellowThreshold: 8 },
      { key: 'ctr', label: 'CTR promedio', unit: '%', target: 2.5, direction: 'higher_better', redThreshold: 1, yellowThreshold: 1.8 },
      { key: 'cpc', label: 'CPC promedio', unit: '$', target: 0.8, direction: 'lower_better', redThreshold: 2, yellowThreshold: 1.5 },
      { key: 'budget_exec', label: 'Presupuesto ejecutado', unit: '%', target: 100, direction: 'higher_better', redThreshold: 80, yellowThreshold: 95 },
      { key: 'ab_tests', label: 'A/B tests activos', target: 4, direction: 'higher_better', redThreshold: 1, yellowThreshold: 2 },
      { key: 'ad_frequency', label: 'Frecuencia Meta', target: 2.5, direction: 'lower_better', redThreshold: 4, yellowThreshold: 3.5 },
      { key: 'quality_score', label: 'Quality / Relevancia', unit: '/10', target: 8, direction: 'higher_better', redThreshold: 5, yellowThreshold: 7 },
    ],
  },
  {
    slug: 'copywriter',
    title: 'Copywriter',
    fullTitle: 'Copywriter / Content Strategist',
    functions: [
      'Redactar copies para ADS (headlines, body, CTA)',
      'Crear scripts para videos y reels',
      'Redactar emails y secuencias de nurturing',
      'Desarrollar ángulos por buyer persona',
      'Mantener banco de copies aprobados y rechazados',
      'Investigación de keywords y lenguaje del mercado',
    ],
    kpis: [
      { key: 'ad_ctr', label: 'CTR copies en ADS', unit: '%', target: 2.5, direction: 'higher_better', redThreshold: 1, yellowThreshold: 1.8 },
      { key: 'email_open', label: 'Tasa de apertura email', unit: '%', target: 25, direction: 'higher_better', redThreshold: 15, yellowThreshold: 22 },
      { key: 'email_click', label: 'Tasa de clic email', unit: '%', target: 3, direction: 'higher_better', redThreshold: 1, yellowThreshold: 2 },
      { key: 'copies_delivered', label: 'Copies entregados/sem', target: 12, direction: 'higher_better', redThreshold: 5, yellowThreshold: 9 },
      { key: 'first_approval', label: 'Aprobados en 1ª revisión', unit: '%', target: 70, direction: 'higher_better', redThreshold: 40, yellowThreshold: 60 },
      { key: 'delivery_time', label: 'Tiempo entrega desde brief', unit: 'h', target: 48, direction: 'lower_better', redThreshold: 96, yellowThreshold: 72 },
      { key: 'variants_active', label: 'Variantes en prueba', target: 6, direction: 'higher_better', redThreshold: 2, yellowThreshold: 4 },
    ],
  },
  {
    slug: 'designer',
    title: 'Diseñador',
    fullTitle: 'Diseñador / Creative Director',
    functions: [
      'Crear creatividades para ADS (estáticas, carruseles, motion)',
      'Diseñar contenido orgánico según calendario',
      'Mantener coherencia con manual de marca',
      'Crear templates reutilizables',
      'Edición básica de video para reels y stories',
      'Revisión y feedback de assets de terceros',
    ],
    kpis: [
      { key: 'creatives_delivered', label: 'Creatividades/sem', target: 10, direction: 'higher_better', redThreshold: 4, yellowThreshold: 7 },
      { key: 'first_approval', label: 'Aprobados en 1ª revisión', unit: '%', target: 75, direction: 'higher_better', redThreshold: 50, yellowThreshold: 65 },
      { key: 'creative_ctr', label: 'CTR creatividades ADS', unit: '%', target: 2.2, direction: 'higher_better', redThreshold: 1, yellowThreshold: 1.6 },
      { key: 'delivery_static', label: 'Entrega estática', unit: 'h', target: 72, direction: 'lower_better', redThreshold: 120, yellowThreshold: 96 },
      { key: 'delivery_video', label: 'Entrega video', unit: 'd', target: 5, direction: 'lower_better', redThreshold: 10, yellowThreshold: 7 },
      { key: 'active_templates', label: 'Templates en uso', target: 8, direction: 'higher_better', redThreshold: 3, yellowThreshold: 6 },
      { key: 'calendar_compliance', label: 'Cumplimiento calendario', unit: '%', target: 95, direction: 'higher_better', redThreshold: 75, yellowThreshold: 88 },
    ],
  },
  {
    slug: 'community',
    title: 'Community Manager',
    fullTitle: 'Community Manager / Social Media Manager',
    functions: [
      'Publicar y programar contenido en todas las plataformas',
      'Gestión diaria de comentarios, DMs y menciones',
      'Monitoreo de reputación online',
      'Reportes semanales de métricas orgánicas',
      'Estrategia de engagement con seguidores',
      'Investigación de tendencias y hashtags',
      'Coordinación con diseñador y copy',
    ],
    kpis: [
      { key: 'engagement_rate', label: 'Engagement rate', unit: '%', target: 4, direction: 'higher_better', redThreshold: 1.5, yellowThreshold: 2.8 },
      { key: 'follower_growth', label: 'Crecimiento seguidores', unit: '%/mes', target: 6, direction: 'higher_better', redThreshold: 1, yellowThreshold: 3 },
      { key: 'response_time', label: 'Tiempo respuesta DMs', unit: 'h', target: 2, direction: 'lower_better', redThreshold: 8, yellowThreshold: 4 },
      { key: 'posts_compliance', label: 'Posts publicados', unit: '%', target: 100, direction: 'higher_better', redThreshold: 80, yellowThreshold: 95 },
      { key: 'monthly_reach', label: 'Alcance orgánico/mes', unit: 'k', target: 80, direction: 'higher_better', redThreshold: 30, yellowThreshold: 60 },
      { key: 'avg_interactions', label: 'Interacciones/pieza', target: 350, direction: 'higher_better', redThreshold: 100, yellowThreshold: 250 },
      { key: 'bio_ctr', label: 'CTR link en bio', unit: '%', target: 5, direction: 'higher_better', redThreshold: 2, yellowThreshold: 3.5 },
    ],
  },
  {
    slug: 'funnel_builder',
    title: 'Funnel Builder',
    fullTitle: 'Funnel Builder / Marketing Automation',
    functions: [
      'Construir y mantener landing pages',
      'Configurar secuencias de email y automatizaciones',
      'Integrar herramientas (CRM, email, ADS, analytics)',
      'Testing y optimización de conversión (CRO)',
      'Tracking: píxeles, eventos, UTMs, GA4',
      'Documentación técnica del stack',
    ],
    kpis: [
      { key: 'lp_conv', label: 'Conversión LP', unit: '%', target: 4, direction: 'higher_better', redThreshold: 1.5, yellowThreshold: 2.5 },
      { key: 'opt_in', label: 'Opt-in formularios', unit: '%', target: 35, direction: 'higher_better', redThreshold: 18, yellowThreshold: 28 },
      { key: 'uptime', label: 'Uptime', unit: '%', target: 99.9, direction: 'higher_better', redThreshold: 98, yellowThreshold: 99 },
      { key: 'lp_speed', label: 'Velocidad LP mobile', unit: 's', target: 3, direction: 'lower_better', redThreshold: 6, yellowThreshold: 4 },
      { key: 'active_automations', label: 'Automatizaciones activas', target: 8, direction: 'higher_better', redThreshold: 2, yellowThreshold: 5 },
      { key: 'email_delivery', label: 'Entrega email', unit: '%', target: 98, direction: 'higher_better', redThreshold: 92, yellowThreshold: 96 },
      { key: 'sequence_open', label: 'Apertura secuencias', unit: '%', target: 30, direction: 'higher_better', redThreshold: 15, yellowThreshold: 25 },
    ],
  },
];

export type KpiHealth = 'green' | 'yellow' | 'red';

export function evaluateKpi(value: number, def: KpiDef): KpiHealth {
  const { target, direction, redThreshold, yellowThreshold } = def;
  if (direction === 'higher_better') {
    if (value >= target) return 'green';
    if (yellowThreshold !== undefined && value >= yellowThreshold) return 'yellow';
    if (redThreshold !== undefined && value >= redThreshold) return 'yellow';
    return 'red';
  }
  // lower_better
  if (value <= target) return 'green';
  if (yellowThreshold !== undefined && value <= yellowThreshold) return 'yellow';
  if (redThreshold !== undefined && value <= redThreshold) return 'yellow';
  return 'red';
}

export function progressToTarget(value: number, def: KpiDef): number {
  if (def.direction === 'higher_better') {
    return Math.min(100, Math.round((value / def.target) * 100));
  }
  // lower_better: 100% si value <= target; decae cuanto más alto
  if (def.target === 0) return value === 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((def.target / value) * 100)));
}
