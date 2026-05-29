import type { AIBrainData } from '@/types/client';
import type { OnboardingData } from '@/onboarding/schema';

/**
 * Servicio de integración con Claude API (claude-sonnet-4-20250514).
 *
 * En esta primera entrega devuelve un análisis sintetizado a partir
 * del propio formulario (sin llamada real). Se reemplaza por la llamada
 * Anthropic SDK cuando el backend tenga la API key configurada.
 */

export async function generateBrainFromOnboarding(
  data: OnboardingData,
): Promise<AIBrainData> {
  // Simula latencia para que la pantalla "cerebro activando" se sienta real
  await new Promise((r) => setTimeout(r, 2200));

  const business = data.step1.businessName;
  const industry = data.step1.industry;
  const founder = data.step1.founderName;
  const ticket = data.step2.averageTicket;
  const currency = data.step2.currency;
  const idealClient = data.step4.idealClientDescription;
  const goal3m = data.step5.revenue3m;
  const diff = data.step6.differentiator;

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary: `${business} es un negocio de ${industry} liderado por ${founder}. Su ticket promedio es de ${currency} ${ticket}. Su diferenciador clave: "${diff.slice(0, 120)}...". Meta a 3 meses: ${currency} ${goal3m.toLocaleString()}.`,
    buyerPersonas: [
      {
        name: 'Avatar Principal',
        description: idealClient.slice(0, 180),
        pains: data.step4.topPains.split(/[,;]\s*|\n/).filter(Boolean).slice(0, 3),
        desires: data.step4.topDesires.split(/[,;]\s*|\n/).filter(Boolean).slice(0, 3),
      },
      {
        name: 'Avatar Secundario',
        description: 'Variante del avatar principal con mayor poder adquisitivo y menor objeción al precio.',
        pains: ['Falta de tiempo', 'Decisión rápida con poca investigación'],
        desires: ['Resultados premium', 'Atención personalizada'],
      },
      {
        name: 'Avatar Aspiracional',
        description: 'Cliente que aún no compra pero consume todo el contenido orgánico — futuro buyer en 30-90 días.',
        pains: ['Inseguridad sobre el producto', 'Necesita validación social'],
        desires: ['Pertenecer al grupo de clientes', 'Resultados visibles'],
      },
    ],
    irresistibleOffer: `Sistema integral para ${data.step4.idealClientDescription.split(' ').slice(0, 8).join(' ')}... que ${data.step6.differentiator.split(' ').slice(0, 10).join(' ')}... con garantía de resultados medibles.`,
    gapAnalysis: `Situación actual: ${data.step3.monthlyRevenue}. Meta: ${currency} ${goal3m.toLocaleString()}/mes en 3 meses. Brecha identificada en ${data.step3.acquisitionChannels.length < 3 ? 'diversificación de canales' : 'optimización de conversión'} y ${data.step3.hasFunnel !== 'yes' ? 'arquitectura de embudo' : 'optimización del embudo existente'}.`,
    recommendedSystem: inferSystem(data),
    initialDeliverables: [
      { title: 'Auditoría completa de canales y embudo actual', dueInDays: 5, responsibleRole: 'estratega' },
      { title: 'Definición de oferta irresistible v1', dueInDays: 7, responsibleRole: 'estratega' },
      { title: 'Setup de tracking + píxeles', dueInDays: 10, responsibleRole: 'media_buyer' },
      { title: 'Primera ronda de creativos (6 piezas)', dueInDays: 14, responsibleRole: 'copywriter' },
      { title: 'Lanzamiento de campañas de prospección', dueInDays: 18, responsibleRole: 'media_buyer' },
    ],
  };
}

/**
 * Genera una agenda estructurada para una reunión, adaptada al tipo y al
 * estado del cliente. Mock con latencia ~1.2s; en backend real llama a
 * Claude con el contexto del cliente (tareas pendientes, métricas, ROPRE).
 */
export async function generateMeetingAgenda(args: {
  clientName: string;
  industry: string;
  meetingType: string;
  pendingTasksCount: number;
  hasAdsData: boolean;
}): Promise<string> {
  await new Promise((r) => setTimeout(r, 1200));
  const { clientName, industry, meetingType, pendingTasksCount, hasAdsData } = args;

  const sections: Record<string, string[]> = {
    weekly_metrics: [
      `Revisión de métricas de la semana — ${clientName}`,
      hasAdsData ? 'Performance de campañas activas (ROAS, CPL, CTR)' : 'Setup pendiente de plataformas de ADS',
      `Estado de las ${pendingTasksCount} tareas pendientes`,
      'Ajustes de presupuesto y optimización',
      'Compromisos para la próxima semana',
    ],
    kickoff: [
      `Presentación del equipo y alcance del proyecto`,
      `Revisión del cerebro ya activado de ${clientName}`,
      'Acceso a plataformas (Meta, Google, GA4)',
      'Definición de canales prioritarios y audiencias',
      'Próximos pasos para los primeros 14 días',
    ],
    content_strategy: [
      'Performance del último ciclo de contenido',
      `Ángulos clave para ${industry}`,
      'Calendario de las próximas 4 semanas',
      'Aprobaciones pendientes',
      'Asignaciones de producción',
    ],
    ads_review: [
      'Snapshot del último periodo',
      'Análisis de creatividades ganadoras / perdedoras',
      'Plan de testing A/B siguiente',
      'Decisión de escala / pausa',
      'Acciones inmediatas',
    ],
    monthly_closing: [
      'Resumen ejecutivo del mes',
      'Cumplimiento de meta de facturación',
      'Lecciones y aprendizajes',
      'Plan del próximo mes',
      'Decisiones estratégicas que necesitan validación',
    ],
    crisis: [
      'Diagnóstico de la situación',
      'Causa raíz identificada',
      'Plan de mitigación inmediato',
      'Asignación de responsables y deadline',
      'Próxima revisión',
    ],
  };

  const items = sections[meetingType] ?? sections.weekly_metrics;
  return items.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

/**
 * Genera 3 opciones diferenciadas para una sección del cerebro.
 * En backend real, llama a Claude con un prompt que pide tres ángulos distintos.
 */
export interface AIOption {
  id: string;
  title: string;
  content: string;
}

export async function generateThreeOptions(args: {
  section: 'market' | 'offer' | 'narrative' | 'personas';
  client: { businessName: string; industry: string; founderName?: string };
  signal?: string; // dirección adicional opcional (para Complementar)
}): Promise<AIOption[]> {
  await new Promise((r) => setTimeout(r, 1200));
  const { section, client, signal } = args;
  const ext = signal ? ` Complemento solicitado: "${signal}".` : '';

  if (section === 'market') {
    return [
      { id: 'mk_data', title: 'Lectura de mercado por datos', content: `${client.businessName} opera en ${client.industry}. Análisis basado en datos: el sector muestra tendencia +18% YoY en búsquedas digitales. Oportunidad de capturar share por contenido educativo de cola larga + paid social.${ext}` },
      { id: 'mk_emotion', title: 'Lectura por dolor emocional', content: `${client.businessName} entra a un mercado donde el cliente está saturado de promesas vacías. La oportunidad real es construir confianza con narrativa cercana y prueba social fuerte.${ext}` },
      { id: 'mk_competitive', title: 'Lectura competitiva', content: `${client.businessName} compite contra jugadores con presupuesto mayor pero mensaje genérico. Ventana de diferenciación: voz personal + sistema premium + nicho específico.${ext}` },
    ];
  }
  if (section === 'offer') {
    return [
      { id: 'of_outcome', title: 'Oferta orientada a resultado', content: `Sistema integral para que ${client.founderName ?? 'el founder'} de ${client.businessName} convierta su autoridad en un flujo predecible de clientes — instalado en 30 días con garantía de resultados o continúa sin costo.${ext}` },
      { id: 'of_process', title: 'Oferta orientada a proceso', content: `Acompañamiento estratégico semanal para ${client.businessName}: implementación de embudo, optimización continua y reporting ejecutivo — sin contratos largos, mes a mes.${ext}` },
      { id: 'of_transform', title: 'Oferta transformacional', content: `Más que campañas: una transformación completa del sistema de adquisición de ${client.businessName} en 12 semanas, con playbook propio para escalar después.${ext}` },
    ];
  }
  if (section === 'narrative') {
    return [
      { id: 'na_empathic', title: 'Voz empática y cercana', content: `Tono: empático, cercano, conversacional. Lenguaje del cliente: "me siento atascada", "necesito algo que funcione de verdad". Temas con autoridad: experiencia personal, casos transformados, ciencia accesible.${ext}` },
      { id: 'na_authority', title: 'Voz experta y autoritaria', content: `Tono: profesional, claro, con datos. Lenguaje: "evidencia muestra que…", "el método consiste en…". Temas: investigación, casos clínicos, frameworks propios.${ext}` },
      { id: 'na_inspirational', title: 'Voz inspiracional', content: `Tono: motivacional, aspiracional, visual. Lenguaje: "imagina si…", "vas a poder…". Temas: transformaciones, historias de éxito, visión de futuro.${ext}` },
    ];
  }
  // personas
  return [
    { id: 'pe_pro', title: 'Profesional saturada (29-38)', content: 'Mujer profesional, 29-38, ingreso medio-alto. Dolor principal: estrés crónico, agotamiento, falta de tiempo para sí misma. Deseo: recuperar energía sin abandonar carrera. Objeción: "no tengo tiempo para más cosas".' },
    { id: 'pe_mom',  title: 'Madre regulada (32-45)', content: 'Madre 32-45, busca regulación nerviosa para mejorar su crianza y relaciones. Dolor: reactividad emocional, culpa. Deseo: ser un ancla calmada para su familia. Objeción: "ya probé muchas cosas".' },
    { id: 'pe_seek', title: 'Buscadora consciente (24-32)', content: 'Joven adulta interesada en bienestar holístico. Dolor: ansiedad social, presión por "tenerlo todo resuelto". Deseo: paz interior real, no estética. Objeción: "es caro".' },
  ];
}

/**
 * Regenera una sección específica del cerebro a partir del estado actual del cliente.
 * En backend real, debería llamar a Claude con un prompt acotado a la sección.
 */
export async function regenerateBrainSection(args: {
  section: 'market' | 'offer' | 'narrative' | 'personas';
  current: AIBrainData;
  identity?: { businessName?: string; industry?: string; founderName?: string };
}): Promise<Partial<AIBrainData>> {
  await new Promise((r) => setTimeout(r, 1100));
  const { section, current, identity } = args;
  const name = identity?.businessName ?? 'la marca';
  const industry = identity?.industry ?? 'su industria';

  switch (section) {
    case 'market':
      return {
        executiveSummary: `${name} opera en ${industry}. Análisis regenerado: la marca muestra señales de tracción orgánica con margen para escalar mediante paid media. Recomendamos validar oferta con prueba A/B durante 14 días antes de duplicar inversión.`,
        gapAnalysis: `Brecha actualizada: diferencial vs competencia más claro pero falta consistencia en frecuencia de publicación. Oportunidad de capturar SEO con contenido educativo de cola larga.`,
      };
    case 'offer':
      return {
        irresistibleOffer: `Sistema integral para que ${identity?.founderName?.split(' ')[0] ?? 'el founder'} de ${name} convierta su autoridad en un flujo de clientes predecible — instalado en 30 días con garantía de leads o seguimos sin costo.`,
      };
    case 'narrative':
      return {
        // La narrativa vive principalmente en onboardingData.content; aquí podríamos
        // ampliar buyerPersonas o agregar campos nuevos. Mantenemos current y notificamos.
        ...current,
      };
    case 'personas':
      return {
        buyerPersonas: (current.buyerPersonas ?? []).map((p, i) => ({
          ...p,
          description: `[Regenerado v${Math.floor(Math.random() * 90) + 10}] ${p.description}`,
          pains: i === 0 ? ['Nuevo dolor primario detectado', ...p.pains.slice(0, 2)] : p.pains,
        })),
      };
  }
}

function inferSystem(data: OnboardingData): AIBrainData['recommendedSystem'] {
  const bt = data.step2.businessType.toLowerCase();
  if (bt.includes('ecommerce')) return 'ecommerce';
  if (bt.includes('curso') || bt.includes('infoproducto')) return 'launch';
  if (bt.includes('coaching') || bt.includes('marca')) return 'personal_brand';
  return 'evergreen';
}
