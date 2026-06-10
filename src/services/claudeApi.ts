import type { AIBrainData } from '@/types/client';
import type { OnboardingData } from '@/onboarding/schema';
import type { TaskPriority, TaskTag } from '@/types/task';
import type { TeamRoleSlug } from '@/types/team';
import { toast } from '@/store/useToastStore';
import {
  ACTION_VERBS,
  BULLET_REGEXES,
  URGENCY_RULES,
  ROLE_KEYWORDS,
  TAG_KEYWORDS,
  PRIORITY_KEYWORDS,
  EXTRACTION_CONFIG,
} from '@/data/taskExtractionKeywords';

/**
 * Cliente del backend Anthropic (Vercel serverless function en /api/claude).
 *
 * En desarrollo local con `npm run dev` (sin vercel dev) NO existe `/api/claude`.
 * En ese caso caemos al fallback heurístico para que la app siga siendo navegable.
 *
 * En producción y en `vercel dev` el endpoint sí existe y usa ANTHROPIC_API_KEY.
 */

const ENDPOINT = '/api/claude';

async function callBackend<T>(feature: string, context: unknown): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature, context }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Claude backend error ${res.status}: ${errText.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/* ─────────────── BRAIN desde onboarding ─────────────── */

export async function generateBrainFromOnboarding(data: OnboardingData): Promise<AIBrainData> {
  try {
    const { brain } = await callBackend<{ brain: AIBrainData }>('brain_from_onboarding', { onboarding: data });
    return brain;
  } catch (e) {
    console.warn('[claudeApi] brain_from_onboarding falló, usando fallback heurístico.', e);
    return brainFallback(data);
  }
}

/* ─────────────── Meeting Agenda ─────────────── */

export async function generateMeetingAgenda(args: {
  clientName: string;
  industry: string;
  meetingType: string;
  pendingTasksCount: number;
  hasAdsData: boolean;
  notes?: string;
  brainSummary?: string;
  brainOffer?: string;
  brainPersonas?: string;
  recentMeetings?: Array<{
    type: string;
    scheduledAt: string;
    summary?: string;
    notes?: string;
  }>;
  pendingTasks?: Array<{
    title: string;
    priority: string;
    assignedTo: string;
    dueInDays: number;
  }>;
  adsMetrics?: {
    roas?: number;
    cpa?: number;
    ctr?: number;
    spend7d?: number;
    notes?: string;
  };
}): Promise<string> {
  try {
    const { text } = await callBackend<{ text: string }>('meeting_agenda', args);
    return text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[claudeApi] meeting_agenda falló, usando fallback.', e);
    toast.warning(`IA no disponible — usando plantilla. (${msg.slice(0, 80)})`);
    return meetingAgendaFallback(args);
  }
}

/* ─────────────── Extract Tasks ─────────────── */

export interface ExtractedTask {
  title: string;
  responsibleRole: string;
  dueInDays: number;
  priority?: TaskPriority;
  tag?: TaskTag;
}

export async function extractTasksFromNotes(args: {
  clientName: string;
  industry: string;
  meetingType: string;
  notes: string;
  agenda?: string;
  availableRoles: string[];
}): Promise<ExtractedTask[]> {
  try {
    const { tasks } = await callBackend<{ tasks: ExtractedTask[] }>('extract_tasks', args);
    return tasks;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[claudeApi] extract_tasks falló, usando fallback heurístico.', e);
    toast.warning(`IA no disponible — usando heurístico. (${msg.slice(0, 80)})`);
    return extractTasksFallback(args);
  }
}

/* ─────────────── ROPRE from transcription ─────────────── */

export interface ExtractedRopre {
  results: Array<{ title: string; description?: string }>;
  objectives: Array<{ title: string; targetValue?: string }>;
  premises: Array<{ title: string; description?: string }>;
  risks: Array<{ title: string; riskLevel?: 'low' | 'medium' | 'high'; mitigation?: string }>;
  deliverables: Array<{ title: string; responsible?: string; dueInDays?: number }>;
}

export async function generateRopreFromTranscription(args: {
  clientName: string;
  industry: string;
  meetingType: string;
  transcription: string;
  availableRoles: string[];
}): Promise<ExtractedRopre> {
  try {
    const { ropre } = await callBackend<{ ropre: ExtractedRopre }>('ropre_from_transcription', args);
    return ropre;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[claudeApi] ropre_from_transcription falló', e);
    toast.warning(`IA no disponible para ROPRE. (${msg.slice(0, 80)})`);
    return { results: [], objectives: [], premises: [], risks: [], deliverables: [] };
  }
}

/* ─────────────── Content Copy IA ─────────────── */

export interface GeneratedContent {
  script: string;
  caption: string;
}

export async function generateContentCopy(args: {
  clientName: string;
  industry: string;
  platform: string;
  format: string;
  title: string;
  hasLeadMagnet: boolean;
  ctaType?: string;
  irresistibleOffer?: string;
  brandMission?: string;
  brandVoiceTone?: string;
  brandDos?: string[];
  brandDonts?: string[];
  brandValues?: string[];
  brandPillars?: Array<{ name: string; description: string }>;
  personas?: Array<{ name: string; description: string; pains: string[]; desires: string[] }>;
}): Promise<GeneratedContent> {
  try {
    const { copy } = await callBackend<{ copy: GeneratedContent }>('generate_content_copy', args);
    return copy;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[claudeApi] generate_content_copy falló', e);
    toast.warning(`IA no disponible — usando heurístico. (${msg.slice(0, 80)})`);
    return contentCopyFallback(args);
  }
}

function contentCopyFallback(args: { title: string; hasLeadMagnet: boolean }): GeneratedContent {
  const cta = args.hasLeadMagnet ? 'Link en bio para descargar gratis ↓' : 'Comenta INFO y te paso detalles ↓';
  return {
    script: `Ángulo: el avatar siente esto y nadie lo nombra. Estructura: 1) Hook con dolor concreto. 2) Validación corta. 3) Insight contraintuitivo. 4) CTA.`,
    caption: `${args.title}\n\n¿Te suena familiar? La mayoría siente lo mismo.\n\nLa diferencia entre quienes lo logran y quienes no es UNA decisión.\n\n${cta}`,
  };
}

/* ─────────────── Ad Variants IA ─────────────── */

export interface AdVariant {
  angle: string;
  angleLabel: string;
  headline: string;
  primaryText: string;
  description?: string;
  ctaButton: string;
}

export async function generateAdVariants(args: {
  clientName: string;
  industry: string;
  platform: string;
  objective: string;
  productOrOffer: string;
  landingUrl?: string;
  budget?: string;
  irresistibleOffer?: string;
  brandMission?: string;
  brandVoiceTone?: string;
  brandDos?: string[];
  brandDonts?: string[];
  personas?: Array<{ name: string; description: string; pains: string[]; desires: string[] }>;
}): Promise<AdVariant[]> {
  try {
    const { variants } = await callBackend<{ variants: AdVariant[] }>('generate_ad_variants', args);
    return variants;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[claudeApi] generate_ad_variants falló', e);
    toast.warning(`IA no disponible — usando ejemplo. (${msg.slice(0, 80)})`);
    return adVariantsFallback(args);
  }
}

function adVariantsFallback(args: { productOrOffer: string }): AdVariant[] {
  const base = args.productOrOffer.slice(0, 60) || 'tu oferta';
  return [
    { angle: 'pain', angleLabel: 'Dolor', headline: `¿Cansado de no avanzar?`, primaryText: `Sabemos lo que sientes. La mayoría sigue intentando solo. Por eso creamos ${base}.`, ctaButton: 'Más información' },
    { angle: 'desire', angleLabel: 'Deseo', headline: `Imagina llegar a la meta`, primaryText: `${base} te lleva al resultado en menos tiempo del que crees.`, ctaButton: 'Quiero saber más' },
    { angle: 'objection', angleLabel: 'Objeción', headline: `No, no es para "más adelante"`, primaryText: `Cada semana que pasa es revenue que dejas en la mesa. ${base} arranca hoy.`, ctaButton: 'Empezar ahora' },
    { angle: 'social_proof', angleLabel: 'Prueba social', headline: `+200 clientes ya lo aplicaron`, primaryText: `Resultados reales, números reales. Mira cómo ${base} cambió sus números.`, ctaButton: 'Ver casos' },
    { angle: 'curiosity', angleLabel: 'Curiosidad', headline: `El error #1 que nadie te dice`, primaryText: `Si haces esto, todo lo demás falla. ${base} parte de ahí.`, ctaButton: 'Descubrir' },
  ];
}

/* ─────────────── Three Options ─────────────── */

export interface AIOption {
  id: string;
  title: string;
  content: string;
}

export async function generateThreeOptions(args: {
  section: 'market' | 'offer' | 'narrative' | 'personas' | 'brand_architecture';
  client: { businessName: string; industry: string; founderName?: string };
  signal?: string;
}): Promise<AIOption[]> {
  try {
    const { options } = await callBackend<{ options: AIOption[] }>('three_options', args);
    return options;
  } catch (e) {
    console.warn('[claudeApi] three_options falló, usando fallback.', e);
    return threeOptionsFallback(args);
  }
}

/* ─────────────── Regenerate Section ─────────────── */

export async function regenerateBrainSection(args: {
  section: 'market' | 'offer' | 'narrative' | 'personas' | 'brand_architecture';
  current: AIBrainData;
  identity?: { businessName?: string; industry?: string; founderName?: string };
}): Promise<Partial<AIBrainData>> {
  try {
    const { patch } = await callBackend<{ patch: Partial<AIBrainData> }>('regenerate_section', args);
    return patch;
  } catch (e) {
    console.warn('[claudeApi] regenerate_section falló, usando fallback.', e);
    return regenerateFallback(args);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FALLBACKS heurísticos (cuando el endpoint no existe o falla)
   ═══════════════════════════════════════════════════════════════════════════ */

function brainFallback(data: OnboardingData): AIBrainData {
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
    gapAnalysis: `Situación actual: ${data.step3.monthlyRevenue}. Meta: ${currency} ${goal3m.toLocaleString()}/mes en 3 meses. Brecha en ${data.step3.acquisitionChannels.length < 3 ? 'diversificación de canales' : 'optimización de conversión'}.`,
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

function meetingAgendaFallback(args: {
  clientName: string;
  industry: string;
  meetingType: string;
  pendingTasksCount: number;
  hasAdsData: boolean;
}): string {
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
      'Presentación del equipo y alcance del proyecto',
      `Revisión del cerebro de ${clientName}`,
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
    ropre_strategy: [
      'Revisión de resultados desde última sesión (10 min)',
      'Actualización del Resultado principal (R) (10 min)',
      'Revisión de Objetivos y métricas (O) (15 min)',
      'Validación de Premisas estratégicas (P) (10 min)',
      'Análisis de Riesgos actuales (R) (10 min)',
      'Definición de Entregables del próximo período (E) (15 min)',
      'Conversión de entregables en tareas asignadas (10 min)',
    ],
  };
  // weekly_planning tiene formato distinto (por días) — fallback genérico semanal.
  if (meetingType === 'weekly_planning') {
    return [
      `LUNES: arranque de la semana — alinear con el equipo las prioridades. Revisar las ${pendingTasksCount} tareas pendientes.`,
      'MARTES: ejecución de tareas de alta prioridad (P1). Bloques de trabajo enfocado.',
      'MIÉRCOLES: punto medio — revisión de avance y desbloqueo de tareas atascadas.',
      'JUEVES: cierre de entregables de la semana. Aprobaciones pendientes.',
      'VIERNES: revisión de cumplimiento de la semana + planificación del siguiente lunes.',
    ].join('\n');
  }
  const items = sections[meetingType] ?? sections.weekly_metrics;
  return items.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

function extractTasksFallback(args: {
  notes: string;
  agenda?: string;
  availableRoles: string[];
}): ExtractedTask[] {
  const text = `${args.agenda ?? ''}\n${args.notes}`;
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  // Construye regex de verbos a partir del repositorio
  const verbsAlt = ACTION_VERBS
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const actionVerbsRE = new RegExp(`^(?:${verbsAlt})\\b`, 'i');

  const candidates: string[] = [];
  for (const line of lines) {
    let bulletMatch: string | null = null;
    for (const re of BULLET_REGEXES) {
      const m = line.match(re);
      if (m) { bulletMatch = m[1].trim(); break; }
    }
    if (bulletMatch) {
      candidates.push(bulletMatch);
    } else if (
      actionVerbsRE.test(line) &&
      line.length >= EXTRACTION_CONFIG.minLineLength &&
      line.length <= EXTRACTION_CONFIG.maxLineLength
    ) {
      candidates.push(line);
    }
  }

  const fallbackRole: TeamRoleSlug = (args.availableRoles[0] as TeamRoleSlug) ?? 'strategist';
  const tasks: ExtractedTask[] = [];

  for (const raw of candidates.slice(0, EXTRACTION_CONFIG.maxTasks)) {
    // Urgencia + prioridad implícita
    let dueInDays = EXTRACTION_CONFIG.defaultDueInDays;
    let priority: TaskPriority = EXTRACTION_CONFIG.defaultPriority;
    for (const rule of URGENCY_RULES) {
      if (rule.pattern.test(raw)) {
        dueInDays = rule.dueInDays;
        if (rule.priority) priority = rule.priority;
        break;
      }
    }

    // Prioridad explícita (sobreescribe la implícita)
    for (const rule of PRIORITY_KEYWORDS) {
      if (rule.pattern.test(raw)) { priority = rule.priority; break; }
    }

    // Rol
    let role: TeamRoleSlug = fallbackRole;
    for (const rule of ROLE_KEYWORDS) {
      if (rule.pattern.test(raw)) {
        // Verifica que el rol esté disponible (o úsalo de todos modos como sugerencia)
        role = args.availableRoles.includes(rule.role) ? rule.role : rule.role;
        break;
      }
    }

    // Tag
    let tag: TaskTag = EXTRACTION_CONFIG.defaultTag;
    for (const rule of TAG_KEYWORDS) {
      if (rule.pattern.test(raw)) { tag = rule.tag; break; }
    }

    tasks.push({ title: raw, responsibleRole: role, dueInDays, priority, tag });
  }

  return tasks;
}

function threeOptionsFallback(args: {
  section: 'market' | 'offer' | 'narrative' | 'personas' | 'brand_architecture';
  client: { businessName: string; industry: string; founderName?: string };
  signal?: string;
}): AIOption[] {
  const { section, client, signal } = args;
  const ext = signal ? ` Complemento: "${signal}".` : '';

  if (section === 'market') {
    return [
      { id: 'mk_data', title: 'Lectura por datos', content: `${client.businessName} (${client.industry}) muestra tendencia +18% YoY en búsquedas digitales. Oportunidad por contenido educativo de cola larga + paid social.${ext}` },
      { id: 'mk_emotion', title: 'Lectura emocional', content: `${client.businessName} entra a un mercado saturado de promesas vacías. Oportunidad real: construir confianza con narrativa cercana y prueba social fuerte.${ext}` },
      { id: 'mk_competitive', title: 'Lectura competitiva', content: `${client.businessName} compite contra jugadores con presupuesto mayor pero mensaje genérico. Diferenciación: voz personal + sistema premium + nicho específico.${ext}` },
    ];
  }
  if (section === 'offer') {
    return [
      { id: 'of_outcome', title: 'Orientada a resultado', content: `Sistema integral para que ${client.founderName ?? 'el founder'} de ${client.businessName} convierta su autoridad en un flujo predecible de clientes — instalado en 30 días con garantía de resultados.${ext}` },
      { id: 'of_process', title: 'Orientada a proceso', content: `Acompañamiento estratégico semanal para ${client.businessName}: implementación de embudo, optimización continua y reporting ejecutivo — mes a mes.${ext}` },
      { id: 'of_transform', title: 'Transformacional', content: `Más que campañas: transformación completa del sistema de adquisición de ${client.businessName} en 12 semanas, con playbook propio para escalar después.${ext}` },
    ];
  }
  if (section === 'narrative') {
    return [
      { id: 'na_empathic', title: 'Voz empática', content: `Tono: empático, cercano, conversacional. Lenguaje del cliente: "me siento atascada", "necesito algo que funcione". Temas: experiencia personal, casos transformados, ciencia accesible.${ext}` },
      { id: 'na_authority', title: 'Voz experta', content: `Tono: profesional, claro, con datos. Lenguaje: "evidencia muestra que…", "el método consiste en…". Temas: investigación, casos clínicos, frameworks propios.${ext}` },
      { id: 'na_inspirational', title: 'Voz inspiracional', content: `Tono: motivacional, aspiracional. Lenguaje: "imagina si…", "vas a poder…". Temas: transformaciones, historias de éxito, visión de futuro.${ext}` },
    ];
  }
  return [
    { id: 'pe_pro', title: 'Profesional saturada (29-38)', content: 'Mujer profesional, 29-38, ingreso medio-alto. Dolor: estrés crónico, agotamiento. Deseo: recuperar energía sin abandonar carrera. Objeción: "no tengo tiempo".' },
    { id: 'pe_mom', title: 'Madre regulada (32-45)', content: 'Madre 32-45, busca regulación nerviosa para mejor crianza. Dolor: reactividad emocional, culpa. Deseo: ser ancla calmada para familia. Objeción: "ya probé muchas cosas".' },
    { id: 'pe_seek', title: 'Buscadora consciente (24-32)', content: 'Joven adulta interesada en bienestar holístico. Dolor: ansiedad social, presión por tenerlo todo resuelto. Deseo: paz interior real. Objeción: "es caro".' },
  ];
}

function regenerateFallback(args: {
  section: 'market' | 'offer' | 'narrative' | 'personas' | 'brand_architecture';
  current: AIBrainData;
  identity?: { businessName?: string; industry?: string; founderName?: string };
}): Partial<AIBrainData> {
  const { section, current, identity } = args;
  const name = identity?.businessName ?? 'la marca';
  const industry = identity?.industry ?? 'su industria';

  switch (section) {
    case 'market':
      return {
        executiveSummary: `${name} opera en ${industry}. Análisis regenerado: la marca muestra señales de tracción orgánica con margen para escalar mediante paid media. Recomendamos validar oferta con A/B durante 14 días antes de duplicar inversión.`,
        gapAnalysis: `Brecha actualizada: diferencial vs competencia más claro pero falta consistencia en frecuencia de publicación. Oportunidad de capturar SEO con contenido educativo de cola larga.`,
      };
    case 'offer':
      return {
        irresistibleOffer: `Sistema integral para que ${identity?.founderName?.split(' ')[0] ?? 'el founder'} de ${name} convierta su autoridad en un flujo de clientes predecible — instalado en 30 días con garantía de leads.`,
      };
    case 'narrative':
      return { ...current };
    case 'personas':
      return {
        buyerPersonas: (current.buyerPersonas ?? []).map((p, i) => ({
          ...p,
          description: `[Regenerado] ${p.description}`,
          pains: i === 0 ? ['Nuevo dolor primario detectado', ...p.pains.slice(0, 2)] : p.pains,
        })),
      };
    case 'brand_architecture':
      return {
        brandArchitecture: {
          mission: `${name} existe para servir su industria de ${industry} con soluciones diferenciadas.`,
          vision: `Convertir a ${name} en referente de ${industry} en los próximos 3 años.`,
          values: ['Claridad', 'Resultados', 'Cercanía', 'Honestidad'],
          pillars: [
            { name: 'Autoridad', description: 'Demostrar expertise con casos y métricas concretas.' },
            { name: 'Conexión', description: 'Hablar con el avatar como persona, no como número.' },
            { name: 'Educación', description: 'Enseñar el "cómo" para construir confianza.' },
          ],
          voiceTone: 'Cercana, directa y profesional. Evita corporativismos y promesas vacías. Usa verbos en presente y frases cortas.',
          dos: ['Hablar en primera persona', 'Citar casos reales', 'Reconocer dudas del lector'],
          donts: ['Frases hechas', 'Tecnicismos sin explicar', 'Comparativas agresivas con competencia'],
        },
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
