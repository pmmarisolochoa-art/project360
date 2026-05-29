/**
 * Agente de investigación de mercado.
 * Mock por ahora; en backend real llamaría a Claude con el system prompt
 * documentado por el usuario y devolvería JSON estructurado.
 */

export type ResearchTopic =
  | 'competition' | 'benchmarks' | 'trends' | 'audiences' | 'content' | 'ads_practices';

export interface ResearchInsight {
  id: string;
  category: ResearchTopic;
  title: string;
  content: string;
  source: 'benchmark' | 'trend';
}

export interface ResearchResult {
  benchmarks: ResearchInsight[];
  tendencias: ResearchInsight[];
  estrategias_competencia: ResearchInsight[];
  angulos_comunicacion: ResearchInsight[];
  stack_recomendado: ResearchInsight[];
  insights_clave: ResearchInsight[];
  fuentes_referenciadas: string[];
}

export async function runMarketResearch(args: {
  industry: string;
  country?: string;
  topics: ResearchTopic[];
}): Promise<ResearchResult> {
  await new Promise((r) => setTimeout(r, 2200));
  const { industry, country = 'LATAM', topics } = args;
  const id = () => `r_${Math.random().toString(36).slice(2, 7)}`;

  const benchmarks: ResearchInsight[] = topics.includes('benchmarks') ? [
    { id: id(), category: 'benchmarks', title: 'CTR Meta Ads', content: `Promedio del sector ${industry}: 1.4–1.8% en ${country}. Top performers >2.5%.`, source: 'benchmark' },
    { id: id(), category: 'benchmarks', title: 'CPL promedio', content: `${industry}: $8–$15 USD. Sectores top: $4–$8.`, source: 'benchmark' },
    { id: id(), category: 'benchmarks', title: 'ROAS realista', content: `ROAS sustentable 2.5–3.5x para ${industry}; >4x es excelente.`, source: 'benchmark' },
  ] : [];

  const tendencias: ResearchInsight[] = topics.includes('trends') ? [
    { id: id(), category: 'trends', title: 'UGC y creadores se imponen', content: 'Las creatividades estáticas pierden contra UGC en CTR un 35% en 2025-2026.', source: 'trend' },
    { id: id(), category: 'trends', title: 'Carruseles con datos', content: 'Carruseles con frameworks y datos tienen 2x más guardados que motivacionales.', source: 'trend' },
    { id: id(), category: 'trends', title: 'Vertical-first', content: 'Reels y Shorts dominan; 70% del tiempo de IG ya es video vertical.', source: 'trend' },
  ] : [];

  const estrategias: ResearchInsight[] = topics.includes('competition') ? [
    { id: id(), category: 'competition', title: 'Estrategia content-first', content: `Líderes de ${industry} priorizan orgánico 60% del esfuerzo + pauta 40%.`, source: 'trend' },
    { id: id(), category: 'competition', title: 'Funnels en 2 capas', content: 'Top de funnel masivo + middle de funnel con webinars/quizzes — separados.', source: 'trend' },
  ] : [];

  const angulos: ResearchInsight[] = topics.includes('audiences') ? [
    { id: id(), category: 'audiences', title: 'Ángulo "validación científica"', content: 'Audiencias 30+ responden a citas y estudios. Reduce escepticismo.', source: 'trend' },
    { id: id(), category: 'audiences', title: 'Ángulo "antes y después"', content: 'Storytelling personal del founder funciona en bienestar/coaching.', source: 'trend' },
    { id: id(), category: 'audiences', title: 'Ángulo "miedo silencioso"', content: 'Nombrar el miedo no dicho del avatar dispara guardados.', source: 'trend' },
  ] : [];

  const stack: ResearchInsight[] = [
    { id: id(), category: 'content', title: 'Stack recomendado', content: 'Hotjar (heatmaps), ConvertKit (email), CapCut/Premiere (video), Notion (ops), Stripe/Hotmart (pagos).', source: 'benchmark' },
  ];

  const insightsClave: ResearchInsight[] = [
    { id: id(), category: 'trends', title: 'El mercado se está educando', content: `${industry} en ${country} vive una segunda ola de profesionalización de la oferta — diferenciador es más importante que precio.`, source: 'trend' },
    { id: id(), category: 'trends', title: 'Tiempo de decisión bajó', content: 'Decisión de compra se redujo de 7 a 4 días con contenido educativo intensivo.', source: 'trend' },
    { id: id(), category: 'benchmarks', title: 'Frecuencia de publicación', content: '3–4 piezas/semana es el mínimo viable para tener tracción orgánica.', source: 'benchmark' },
    { id: id(), category: 'audiences', title: 'WhatsApp como cierre', content: 'En LATAM, mover el lead a WhatsApp aumenta tasa de cierre 1.6–2.2x.', source: 'trend' },
    { id: id(), category: 'ads_practices', title: 'Creativos cortos rinden más', content: 'Hooks <3s son críticos; videos 9-15s superan a 30s+ en CTR.', source: 'benchmark' },
  ];

  return {
    benchmarks,
    tendencias,
    estrategias_competencia: estrategias,
    angulos_comunicacion: angulos,
    stack_recomendado: stack,
    insights_clave: insightsClave,
    fuentes_referenciadas: [
      'WordStream Search Marketing Benchmarks 2025',
      'HubSpot State of Marketing 2026',
      'Statista Digital Advertising LATAM',
      'Meta Business Insights',
      'Google Think with Google',
    ],
  };
}

export const TOPIC_META: Record<ResearchTopic, { label: string }> = {
  competition:   { label: 'Análisis de competencia' },
  benchmarks:    { label: 'Benchmarks de la industria' },
  trends:        { label: 'Tendencias del mercado' },
  audiences:     { label: 'Análisis de audiencias' },
  content:       { label: 'Estrategias de contenido' },
  ads_practices: { label: 'Mejores prácticas de ADS' },
};
