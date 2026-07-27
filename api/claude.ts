/**
 * Vercel Edge Function — Anthropic API proxy.
 *
 * Usa fetch directo a la API HTTP de Anthropic (no SDK)
 * para mantener compatibilidad con runtime Edge.
 *
 * La API key vive solo aquí (ANTHROPIC_API_KEY env var en Vercel),
 * nunca llega al browser.
 */

export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-6';
// Modelo más rápido y económico para resúmenes ejecutivos (reporte semanal).
const FAST_MODEL = 'claude-haiku-4-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface MeetingAgendaCtx {
  clientName: string;
  industry: string;
  meetingType: string;
  pendingTasksCount: number;
  hasAdsData: boolean;
  // ─── Contexto extendido (todos opcionales para retro-compatibilidad) ───
  notes?: string;                          // Pre-brief que el usuario escribió
  brainSummary?: string;                   // executiveSummary del cerebro IA
  brainOffer?: string;                     // irresistibleOffer del cerebro IA
  brainPersonas?: string;                  // resumen corto de buyer personas
  recentMeetings?: Array<{                 // últimas 3 reuniones (cronológicas)
    type: string;
    scheduledAt: string;
    summary?: string;                      // si tiene summary lo usamos, si no notes
    notes?: string;
  }>;
  pendingTasks?: Array<{                   // top 10 tareas pendientes con detalle
    title: string;
    priority: string;
    assignedTo: string;
    dueInDays: number;                     // negativo = vencida
  }>;
  adsMetrics?: {                           // métricas agregadas últimos 7d si ADS conectado
    roas?: number;
    cpa?: number;
    ctr?: number;
    spend7d?: number;
    notes?: string;                        // ej "ROAS cayendo de 4.1 → 2.8 esta semana"
  };
}

interface ThreeOptionsCtx {
  section: 'market' | 'offer' | 'narrative' | 'personas';
  client: { businessName: string; industry: string; founderName?: string };
  signal?: string;
}

interface RegenerateCtx {
  section: 'market' | 'offer' | 'narrative' | 'personas' | 'brand_architecture';
  current: Record<string, unknown>;
  identity?: { businessName?: string; industry?: string; founderName?: string };
}

interface BrainCtx {
  onboarding: Record<string, unknown>;
}

interface ExtractTasksCtx {
  clientName: string;
  industry: string;
  meetingType: string;
  notes: string;
  agenda?: string;
  availableRoles: string[];
  /** Títulos de tareas YA existentes y pendientes del cliente (para no duplicar). */
  existingTasks?: string[];
  /** Equipo real del cliente (para asignar a la PERSONA por nombre). */
  teamMembers?: Array<{ nombre: string; rol: string }>;
}

interface RopreFromTranscriptionCtx {
  clientName: string;
  industry: string;
  meetingType: string;
  transcription: string;
  availableRoles: string[];
}

interface GenerateAdVariantsCtx {
  clientName: string;
  industry: string;
  platform: string;            // meta | google | tiktok | youtube
  objective: string;           // conversiones | trafico | leads | mensajes | reconocimiento
  productOrOffer: string;      // qué se anuncia
  landingUrl?: string;
  budget?: string;
  // Contexto de marca y avatar
  irresistibleOffer?: string;
  brandMission?: string;
  brandVoiceTone?: string;
  brandDos?: string[];
  brandDonts?: string[];
  personas?: Array<{ name: string; description: string; pains: string[]; desires: string[] }>;
}

interface WeeklyReportCtx {
  clientName: string;
  weekStart: string;             // ISO date del lunes
  weekEnd: string;               // ISO date del domingo
  tasksCompleted: number;
  tasksPending: number;
  compliancePct: number;         // 0-100
  daysToNextEvent: number | null;
  pendingTasksSample: Array<{    // hasta 10 para alimentar el "foco próxima semana"
    title: string;
    priority: string;
    role: string;
    dueInDays: number;
  }>;
}

interface RopreWeeklyCtx {
  clientName: string;
  resultadoEsperado: string;
  objetivos: string[];
  premisas: string[];
  riesgos: string[];
  entregablesPendientes: number;
  tareasCompletadas: string[];
  tareasVencidas: string[];
  cumplimientoPct: number;
}

interface GenerateContentCopyCtx {
  clientName: string;
  industry: string;
  platform: string;            // instagram | tiktok | youtube | linkedin | facebook
  format: string;              // reel | post | story | video | carousel | short
  title: string;               // idea / título del pieza
  hasLeadMagnet: boolean;
  ctaType?: string;            // ej: 'lead_magnet' | 'buy_now' | 'comment_info' | ...
  // Contexto de marca (lo que la diferencia de un copy genérico)
  irresistibleOffer?: string;
  brandMission?: string;
  brandVoiceTone?: string;
  brandDos?: string[];
  brandDonts?: string[];
  brandValues?: string[];
  brandPillars?: Array<{ name: string; description: string }>;
  personas?: Array<{ name: string; description: string; pains: string[]; desires: string[] }>;
}

interface AgentChatCtx {
  system: string;                                         // system prompt + contexto del cliente ya armado
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;                                         // de agent_prompts.modelo
}

interface MeetingReportCtx {
  clientName: string;
  industry: string;
  meetingType: string;
  meetingTitle: string;
  date: string;                                           // fecha legible
  agenda?: string;
  notes?: string;
  summary?: string;
  commitments?: Array<{ title: string; responsible: string; dueInDays: number }>;
}

type RequestBody =
  | { feature: 'meeting_agenda'; context: MeetingAgendaCtx }
  | { feature: 'agent_chat'; context: AgentChatCtx }
  | { feature: 'three_options'; context: ThreeOptionsCtx }
  | { feature: 'regenerate_section'; context: RegenerateCtx }
  | { feature: 'brain_from_onboarding'; context: BrainCtx }
  | { feature: 'extract_tasks'; context: ExtractTasksCtx }
  | { feature: 'ropre_from_transcription'; context: RopreFromTranscriptionCtx }
  | { feature: 'generate_content_copy'; context: GenerateContentCopyCtx }
  | { feature: 'generate_ad_variants'; context: GenerateAdVariantsCtx }
  | { feature: 'weekly_report'; context: WeeklyReportCtx }
  | { feature: 'meeting_report'; context: MeetingReportCtx }
  | { feature: 'ropre_weekly'; context: RopreWeeklyCtx };

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY no configurado en Vercel' }, 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'Body JSON inválido' }, 400);
  }

  try {
    switch (body.feature) {
      case 'meeting_agenda':
        return json({ text: await meetingAgenda(apiKey, body.context) });
      case 'agent_chat':
        return await agentChatStream(apiKey, body.context);
      case 'three_options':
        return json({ options: await threeOptions(apiKey, body.context) });
      case 'regenerate_section':
        return json({ patch: await regenerateSection(apiKey, body.context) });
      case 'brain_from_onboarding':
        return json({ brain: await brainFromOnboarding(apiKey, body.context) });
      case 'extract_tasks':
        return json({ tasks: await extractTasks(apiKey, body.context) });
      case 'ropre_from_transcription':
        return json({ ropre: await ropreFromTranscription(apiKey, body.context) });
      case 'generate_content_copy':
        return json({ copy: await generateContentCopy(apiKey, body.context) });
      case 'generate_ad_variants':
        return json({ variants: await generateAdVariants(apiKey, body.context) });
      case 'weekly_report':
        return json(await weeklyReport(apiKey, body.context));
      case 'meeting_report':
        return json({ report: await meetingReport(apiKey, body.context) });
      case 'ropre_weekly':
        return json(await ropreWeekly(apiKey, body.context));
      default:
        return json({ error: 'Feature desconocida' }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[claude api]', msg);
    return json({ error: msg }, 500);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function callAnthropic(apiKey: string, system: string, user: string, maxTokens = 1024, model: string = MODEL): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const block = data.content?.find((b) => b.type === 'text');
  if (!block?.text) throw new Error('Respuesta sin contenido de texto');
  return block.text.trim();
}

/**
 * Variante multi-turno: recibe un array de mensajes (user/assistant) en vez de
 * un único prompt. Usada por el chat del Agente PM para mantener conversación.
 */
/**
 * Chat del Agente PM en STREAMING.
 *
 * Antes se esperaba a que Anthropic generara TODA la respuesta y luego se
 * devolvía como JSON — con contexto grande + hasta 1500 tokens de salida,
 * eso superaba el límite de tiempo del Edge Function → 504
 * FUNCTION_INVOCATION_TIMEOUT. Con streaming los primeros bytes salen en
 * segundos y la conexión se mantiene viva, así que ya no hay timeout.
 *
 * Devuelve `text/plain`: solo los fragmentos de texto (deltas), que el
 * frontend va acumulando. Los errores se devuelven como JSON.
 */
async function agentChatStream(apiKey: string, ctx: AgentChatCtx): Promise<Response> {
  const messages = (ctx.messages ?? [])
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
  if (messages.length === 0) return json({ error: 'Sin mensajes para el agente' }, 400);
  const model = ctx.model && ctx.model.startsWith('claude-') ? ctx.model : MODEL;

  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 1500, system: ctx.system, messages, stream: true }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    return json({ error: `Anthropic API ${upstream.status}: ${errText.slice(0, 300)}` }, 502);
  }

  // Transforma el SSE de Anthropic → texto plano (solo los text_delta).
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // la última puede estar incompleta
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
            controller.enqueue(encoder.encode(evt.delta.text));
          }
        } catch {
          /* línea parcial o no-JSON — se ignora */
        }
      }
    },
  });

  return new Response(upstream.body.pipeThrough(transform), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
  });
}

async function meetingAgenda(apiKey: string, ctx: MeetingAgendaCtx): Promise<string> {
  // Foco específico por tipo de reunión — guía a la IA hacia el formato esperado.
  const TYPE_FOCUS: Record<string, string> = {
    kickoff: 'KICKOFF: enfoque en objetivos del proyecto, expectativas, alcance, accesos pendientes, definición de éxito y compromisos para los primeros 14 días. Evita métricas — todavía no hay.',
    weekly_metrics: 'REVISIÓN SEMANAL: enfoque en métricas de la semana (ROAS, CPL, CPA, CTR si hay datos), avance de las tareas pendientes (especialmente las vencidas), decisiones de ajuste, prioridades de la próxima semana.',
    content_strategy: 'SESIÓN DE CONTENIDO: enfoque en pipeline de piezas (en producción, en revisión, próximas a publicar), aprobaciones pendientes, ángulos y formatos, calendario de las próximas 2-4 semanas.',
    ads_review: 'REVISIÓN ADS: enfoque en ROAS por canal/campaña, hooks ganadores vs perdedores, A/B tests activos, decisiones de escala/pausa, optimizaciones inmediatas (presupuesto, audiencias, creativos).',
    monthly_closing: 'CIERRE MENSUAL: enfoque en resultados vs proyecciones, cumplimiento de meta de facturación, lecciones del mes, decisiones estratégicas que necesitan validación, plan del próximo mes.',
    crisis: 'CRISIS: enfoque en diagnóstico, causa raíz, plan de mitigación inmediato, responsables y deadline, próxima revisión.',
    weekly_planning: `PLANEACIÓN SEMANAL: este tipo requiere un FORMATO DISTINTO al estándar. Genera una agenda estructurada POR DÍAS de la semana (Lunes a Viernes), distribuyendo prioridades del equipo. Para cada día:
- 2-3 prioridades del día, máximo 5 líneas por día
- Menciona responsables específicos cuando aparezcan en las tareas pendientes
- Considera distribución de carga de trabajo
- En VIERNES incluye revisión de la semana
Formato EXACTO:
LUNES: [prioridades]
MARTES: [prioridades]
MIÉRCOLES: [prioridades]
JUEVES: [prioridades]
VIERNES: [prioridades + revisión semana]
Ignora la regla de "5 puntos numerados" — usa el formato por días.`,
    ropre_strategy: `ESTRATEGIA ROPRE & ENTREGABLES: agenda estructurada para sesión estratégica del marco ROPRE (Resultado, Objetivos, Premisas, Riesgos, Entregables). Genera EXACTAMENTE 7 puntos en este orden:
1. Revisión de resultados desde última sesión (10 min)
2. Actualización del Resultado principal (R) (10 min)
3. Revisión de Objetivos y métricas (O) (15 min)
4. Validación de Premisas estratégicas (P) (10 min)
5. Análisis de Riesgos actuales (R) (10 min)
6. Definición de Entregables del próximo período (E) (15 min)
7. Conversión de entregables en tareas asignadas (10 min)
En cada punto sé específico al cliente y su momento actual. Ignora la regla de "5 puntos" — usa exactamente 7.`,
    weekly_closing: `SPRINT DE CIERRE DE SEMANA: reunión de PM para cerrar la semana con seguimiento riguroso. Genera EXACTAMENTE 6 puntos en este orden:
1. Resumen de la semana — qué se completó vs qué quedó pendiente (menciona tareas concretas del contexto) (10 min)
2. Revisión de tareas NO completadas — causa de cada una: bloqueo, falta de tiempo o mala estimación (10 min)
3. Cumplimiento por responsable — reconocer lo entregado y aclarar lo atrasado, sin señalar culpables (5 min)
4. Decisiones sobre pendientes — reprogramar, reasignar o cancelar cada tarea abierta (10 min)
5. Aprendizajes de la semana — qué repetir y qué cambiar en el proceso (5 min)
6. Compromisos para la próxima semana — responsable y fecha por cada uno (5 min)
En cada punto sé específico: usa las tareas pendientes y vencidas del contexto con nombres y responsables. Ignora la regla de "5 puntos" — usa exactamente 6.`,
    general: 'REUNIÓN GENERAL: reunión esporádica y sin tema fijo. Agenda ligera y flexible: repaso rápido de novedades, temas varios que traiga el equipo, puntos pendientes de reuniones anteriores, alineación puntual de prioridades, dudas abiertas y acuerdos. No fuerces métricas ni una estructura rígida — mantenla breve y práctica.',
    management: 'REUNIÓN DE GERENCIA: enfoque de dirección de la agencia (no de un cliente puntual). Cubre: estado del sistema y procesos internos (SOPs), objetivos y KPIs generales de la agencia, decisiones estratégicas importantes que hay que tomar, prioridades transversales del equipo y asignación de responsables con próximos hitos. Tono ejecutivo y orientado a decisiones.',
  };
  const focus = TYPE_FOCUS[ctx.meetingType] ?? 'Enfoque adaptado al tipo de reunión.';

  const system = `Eres una estratega senior de marketing digital. Generas agendas de reunión claras, accionables y específicas al cliente — no genéricas. Usas TODO el contexto disponible (cerebro estratégico, notas del pre-brief, reuniones previas, tareas pendientes y métricas de ADS).

${focus}

Devuelve SOLO una lista numerada de 5 puntos, sin introducción ni cierre. Cada punto:
- Debe ser específico al cliente — menciona nombres, métricas, tareas concretas que viste en el contexto.
- Termina con una acción clara o pregunta a resolver.
- Evita frases vacías como "Revisar performance" o "Discutir próximos pasos".`;

  // Construimos el prompt en bloques opcionales — solo añadimos lo que vino
  const parts: string[] = [
    `Cliente: ${ctx.clientName} (${ctx.industry})`,
    `Tipo de reunión: ${ctx.meetingType}`,
    `Tareas pendientes: ${ctx.pendingTasksCount}`,
    `Datos de ADS conectados: ${ctx.hasAdsData ? 'sí' : 'no'}`,
  ];

  if (ctx.brainSummary) {
    parts.push('', '— CEREBRO ESTRATÉGICO DEL CLIENTE —');
    parts.push(`Resumen: ${ctx.brainSummary.slice(0, 600)}`);
    if (ctx.brainOffer) parts.push(`Oferta irresistible: ${ctx.brainOffer.slice(0, 300)}`);
    if (ctx.brainPersonas) parts.push(`Buyer personas: ${ctx.brainPersonas.slice(0, 500)}`);
  }

  if (ctx.notes && ctx.notes.trim().length > 0) {
    parts.push('', '— PRE-BRIEF / NOTAS QUE YA TENGO PARA ESTA REUNIÓN —');
    parts.push(ctx.notes.slice(0, 2000));
  }

  if (ctx.recentMeetings && ctx.recentMeetings.length > 0) {
    parts.push('', '— REUNIONES PREVIAS RECIENTES (más nueva primero) —');
    ctx.recentMeetings.slice(0, 3).forEach((m, i) => {
      const body = (m.summary || m.notes || '').slice(0, 400);
      if (body) parts.push(`[${i + 1}] ${m.type} (${m.scheduledAt.slice(0, 10)}): ${body}`);
    });
  }

  if (ctx.pendingTasks && ctx.pendingTasks.length > 0) {
    parts.push('', '— TAREAS PENDIENTES DEL CLIENTE (top 10) —');
    ctx.pendingTasks.slice(0, 10).forEach((t) => {
      const dueLabel = t.dueInDays < 0
        ? `VENCIDA hace ${Math.abs(t.dueInDays)}d`
        : t.dueInDays === 0
        ? 'vence HOY'
        : `vence en ${t.dueInDays}d`;
      parts.push(`- [${t.priority}] ${t.title} (${t.assignedTo}, ${dueLabel})`);
    });
  }

  if (ctx.adsMetrics) {
    parts.push('', '— MÉTRICAS DE ADS (últimos 7 días) —');
    const m = ctx.adsMetrics;
    const bits: string[] = [];
    if (m.roas != null) bits.push(`ROAS: ${m.roas.toFixed(2)}x`);
    if (m.cpa != null) bits.push(`CPA: $${m.cpa.toFixed(0)}`);
    if (m.ctr != null) bits.push(`CTR: ${(m.ctr * 100).toFixed(2)}%`);
    if (m.spend7d != null) bits.push(`Spend 7d: $${m.spend7d.toFixed(0)}`);
    if (bits.length > 0) parts.push(bits.join(' · '));
    if (m.notes) parts.push(`Tendencia: ${m.notes}`);
  }

  parts.push('', 'Genera la agenda de 5 puntos para esta reunión, dándole continuidad al contexto anterior. Si hay tareas VENCIDAS, prioriza abordarlas. Si hay métricas en caída, conviértelas en punto de la agenda. Si las notas del pre-brief mencionan temas concretos, abórdalos primero.');

  const user = parts.join('\n');
  return callAnthropic(apiKey, system, user, 700);
}

async function threeOptions(apiKey: string, ctx: ThreeOptionsCtx): Promise<Array<{ id: string; title: string; content: string }>> {
  const sectionPrompts: Record<ThreeOptionsCtx['section'], { focus: string; titles: string[] }> = {
    market: {
      focus: 'lectura del mercado y oportunidad estratégica',
      titles: ['Lectura por datos', 'Lectura emocional', 'Lectura competitiva'],
    },
    offer: {
      focus: 'estructura de oferta irresistible',
      titles: ['Orientada a resultado', 'Orientada a proceso', 'Transformacional'],
    },
    narrative: {
      focus: 'tono y narrativa de marca',
      titles: ['Voz empática y cercana', 'Voz experta y autoritaria', 'Voz inspiracional'],
    },
    personas: {
      focus: 'buyer personas (3 segmentos diferenciados)',
      titles: ['Avatar primario', 'Avatar secundario', 'Avatar aspiracional'],
    },
  };
  const def = sectionPrompts[ctx.section];
  const signal = ctx.signal ? `\nDirección adicional solicitada: "${ctx.signal}"` : '';

  const system = `Eres una estratega senior. Generas EXACTAMENTE 3 opciones diferenciadas para una sección estratégica, cada una con un ángulo distinto. Devuelve SOLO un array JSON válido con esta forma:
[
  {"title": "Título corto", "content": "Contenido de 2-3 oraciones, accionable y específico"},
  {"title": "...", "content": "..."},
  {"title": "...", "content": "..."}
]
Sin texto antes ni después del JSON.`;
  const user = `Sección: ${def.focus}
Cliente: ${ctx.client.businessName} — industria: ${ctx.client.industry}${ctx.client.founderName ? ` — founder: ${ctx.client.founderName}` : ''}${signal}

Genera las 3 opciones. Usa estos títulos sugeridos pero adáptalos al contexto: ${def.titles.join(', ')}.`;

  const txt = await callAnthropic(apiKey, system, user, 1500);
  let parsed: Array<{ title: string; content: string }>;
  try {
    parsed = JSON.parse(extractJson(txt));
  } catch {
    throw new Error('Claude devolvió JSON inválido para three_options');
  }
  return parsed.slice(0, 3).map((opt, i) => ({
    id: `${ctx.section}_${i}_${Date.now()}`,
    title: opt.title,
    content: opt.content,
  }));
}

async function regenerateSection(apiKey: string, ctx: RegenerateCtx): Promise<Record<string, unknown>> {
  const name = ctx.identity?.businessName ?? 'la marca';
  const industry = ctx.identity?.industry ?? 'su industria';
  const founder = ctx.identity?.founderName ?? 'el founder';

  const sectionFields: Record<RegenerateCtx['section'], string> = {
    market: `Genera un análisis ejecutivo actualizado del mercado y un gap analysis. Devuelve JSON con campos "executiveSummary" (3-4 oraciones) y "gapAnalysis" (2-3 oraciones).`,
    offer: `Genera UNA oferta irresistible en 1-2 oraciones. Devuelve JSON con campo "irresistibleOffer".`,
    narrative: `Genera una descripción de la narrativa y tono de marca en 2-3 oraciones. Devuelve JSON con campo "executiveSummary".`,
    personas: `Genera EXACTAMENTE 3 buyer personas diferenciados. Devuelve JSON con campo "buyerPersonas" que es un array con: name, description, pains (3 strings), desires (3 strings).`,
    brand_architecture: `Genera la arquitectura de marca completa. Devuelve JSON con campo "brandArchitecture" que es un objeto con esta forma EXACTA:
{
  "mission": "1 oración clara — para qué existe la marca",
  "vision": "1 oración — hacia dónde va la marca en 3-5 años",
  "values": ["valor 1", "valor 2", "valor 3", "valor 4"],
  "pillars": [
    {"name": "Nombre del pilar", "description": "Qué comunica este pilar y para quién (1-2 oraciones)"},
    {"name": "...", "description": "..."},
    {"name": "...", "description": "..."}
  ],
  "voiceTone": "2-3 oraciones describiendo el tono de voz de la marca: cómo se siente, qué evita, ejemplos de palabras clave",
  "dos": ["acción 1", "acción 2", "acción 3", "acción 4"],
  "donts": ["evitar 1", "evitar 2", "evitar 3", "evitar 4"]
}
Reglas:
- 3-5 valores (string corto, una palabra o frase máx 4 palabras).
- 3-5 pillars.
- 3-5 do's y 3-5 don'ts (acciones concretas, no abstractas).
- Sin texto antes ni después del JSON.`,
  };
  const instruction = sectionFields[ctx.section];

  const system = `Eres estratega senior. Devuelve SOLO JSON válido sin texto antes ni después. ${instruction}`;
  const user = `Cliente: ${name} (${industry}) — founder: ${founder}

Contexto actual: ${JSON.stringify(ctx.current).slice(0, 1500)}

Regenera la sección.`;

  const txt = await callAnthropic(apiKey, system, user, 1500);
  try {
    return JSON.parse(extractJson(txt));
  } catch {
    throw new Error('Claude devolvió JSON inválido para regenerate_section');
  }
}

async function brainFromOnboarding(apiKey: string, ctx: BrainCtx): Promise<Record<string, unknown>> {
  const system = `Eres estratega senior de marketing digital. A partir del onboarding del cliente, generas un cerebro estratégico completo. Devuelve SOLO JSON válido con esta estructura:
{
  "executiveSummary": "Resumen ejecutivo del negocio en 3-4 oraciones",
  "buyerPersonas": [
    {"name": "Avatar Principal", "description": "...", "pains": ["...","...","..."], "desires": ["...","...","..."]},
    {"name": "Avatar Secundario", "description": "...", "pains": [...], "desires": [...]},
    {"name": "Avatar Aspiracional", "description": "...", "pains": [...], "desires": [...]}
  ],
  "irresistibleOffer": "Una oferta irresistible específica, 1-2 oraciones",
  "gapAnalysis": "Brecha entre situación actual y meta, 2-3 oraciones",
  "recommendedSystem": "uno de: ecommerce | launch | evergreen | personal_brand",
  "initialDeliverables": [
    {"title": "...", "dueInDays": 5, "responsibleRole": "estratega"},
    {"title": "...", "dueInDays": 7, "responsibleRole": "media_buyer"},
    {"title": "...", "dueInDays": 10, "responsibleRole": "copywriter"},
    {"title": "...", "dueInDays": 14, "responsibleRole": "designer"},
    {"title": "...", "dueInDays": 18, "responsibleRole": "estratega"}
  ]
}

Sin texto antes ni después del JSON.`;
  const user = `Onboarding del cliente:
${JSON.stringify(ctx.onboarding).slice(0, 3000)}

Genera el cerebro estratégico completo.`;

  const txt = await callAnthropic(apiKey, system, user, 3000);
  try {
    const parsed = JSON.parse(extractJson(txt));
    parsed.generatedAt = new Date().toISOString();
    return parsed;
  } catch {
    throw new Error('Claude devolvió JSON inválido para brain_from_onboarding');
  }
}

async function extractTasks(apiKey: string, ctx: ExtractTasksCtx): Promise<Array<{ title: string; responsibleRole: string; dueInDays: number }>> {
  const system = `Eres una PM senior. Extraes tareas accionables de las notas de una reunión. Devuelve SOLO un array JSON válido (sin texto antes ni después) con esta forma:
[
  {"title": "Tarea clara y accionable (verbo + objeto)", "responsibleRole": "NOMBRE de la persona del equipo (o el rol si no hay persona clara)", "dueInDays": número entre 1 y 30},
  ...
]
Reglas:
- Extrae TODAS las tareas accionables que se acordaron o mencionaron en la reunión. Sé exhaustiva: no te limites a un número fijo. Si se hablaron 15 tareas, devuelve 15.
- Si no hay tareas claras, devuelve [].
- No inventes tareas que no se mencionaron.
- NO DUPLICAR: si se te dan "Tareas ya existentes y pendientes", NO generes una tarea que ya esté cubierta por una de ellas (aunque esté redactada distinto). Si un tema de la reunión es continuación o seguimiento de una tarea existente, NO crees una nueva. Solo extrae tareas NUEVAS.
- Cada title empieza con verbo en infinitivo.
- responsibleRole: pon el NOMBRE EXACTO de la persona del equipo responsable, según su rol y quién se mencione en la reunión. Solo si NINGUNA persona del equipo encaja con ese trabajo, usa el slug del rol.
- dueInDays: urgente=2, normal=7, baja=14.`;

  const existing = ctx.existingTasks && ctx.existingTasks.length
    ? `Tareas YA existentes y pendientes de este cliente (NO las vuelvas a crear; si un tema de la reunión es continuación o seguimiento de una de estas, NO generes una tarea nueva):\n${ctx.existingTasks.map((t) => `- ${t}`).join('\n')}\n\n`
    : '';

  const roster = ctx.teamMembers && ctx.teamMembers.length
    ? `Equipo del cliente — asigna cada tarea a la PERSONA por su NOMBRE EXACTO según su rol y quién se mencione:\n${ctx.teamMembers.map((m) => `- ${m.nombre} (${m.rol})`).join('\n')}\n\n`
    : '';

  const user = `Cliente: ${ctx.clientName} (${ctx.industry})
Tipo de reunión: ${ctx.meetingType}
Roles disponibles: ${ctx.availableRoles.join(', ')}

${roster}${existing}${ctx.agenda ? `Agenda:\n${ctx.agenda}\n\n` : ''}Notas de la reunión:
${ctx.notes}

Extrae SOLO las tareas accionables NUEVAS (que no estén ya en la lista de existentes).`;

  const txt = await callAnthropic(apiKey, system, user, 4000);
  try {
    const parsed = JSON.parse(extractJson(txt));
    if (!Array.isArray(parsed)) return [];
    // Tope de seguridad amplio (antes 8): permite reuniones con muchas tareas.
    return parsed.slice(0, 40).map((t: { title?: string; responsibleRole?: string; dueInDays?: number }) => ({
      title: String(t.title ?? '').slice(0, 200),
      responsibleRole: String(t.responsibleRole ?? ctx.availableRoles[0] ?? 'estratega'),
      dueInDays: Math.max(1, Math.min(30, Number(t.dueInDays) || 7)),
    })).filter((t) => t.title.length > 0);
  } catch {
    throw new Error('Claude devolvió JSON inválido para extract_tasks');
  }
}

/* ─────────────── ROPRE from transcription ─────────────── */

interface RopreExtract {
  results: Array<{ title: string; description?: string }>;
  objectives: Array<{ title: string; targetValue?: string }>;
  premises: Array<{ title: string; description?: string }>;
  risks: Array<{ title: string; riskLevel?: 'low' | 'medium' | 'high'; mitigation?: string }>;
  deliverables: Array<{ title: string; responsible?: string; dueInDays?: number }>;
}

async function ropreFromTranscription(apiKey: string, ctx: RopreFromTranscriptionCtx): Promise<RopreExtract> {
  const system = `Eres un consultor estratégico senior. A partir de una transcripción de reunión, extraes el framework ROPRE: Resultados, Objetivos, Primicias (premisas/insights), Riesgos y Entregables. Devuelve SOLO un objeto JSON válido con esta forma exacta:
{
  "results": [{"title": "...", "description": "..."}],
  "objectives": [{"title": "...", "targetValue": "..."}],
  "premises": [{"title": "...", "description": "..."}],
  "risks": [{"title": "...", "riskLevel": "low|medium|high", "mitigation": "..."}],
  "deliverables": [{"title": "...", "responsible": "rol_disponible", "dueInDays": 7}]
}
Reglas:
- Máximo 3 items por categoría (sé conciso).
- Cada title máximo 80 caracteres. Cada description máximo 120 caracteres.
- Resultados: logros concretos ya alcanzados (con números si aparecen).
- Objetivos: metas accionables y medibles.
- Primicias: insights validados que guían decisiones.
- Riesgos: amenazas concretas con riskLevel y mitigación.
- Entregables: outputs concretos (verbo + objeto) con responsible y dueInDays (1-30).
- Si una categoría no aparece en la transcripción, devuelve [].
- Sin texto antes ni después del JSON.`;

  const user = `Cliente: ${ctx.clientName} (${ctx.industry})
Tipo de reunión: ${ctx.meetingType}
Roles disponibles: ${ctx.availableRoles.join(', ')}

Transcripción:
${ctx.transcription.slice(0, 5000)}

Extrae el ROPRE en JSON.`;

  const txt = await callAnthropic(apiKey, system, user, 1400);
  try {
    const parsed = JSON.parse(extractJson(txt)) as Partial<RopreExtract>;
    const cap = <T,>(arr: T[] | undefined): T[] => (Array.isArray(arr) ? arr.slice(0, 3) : []);
    const validLevel = (l?: string): 'low' | 'medium' | 'high' | undefined =>
      l === 'low' || l === 'medium' || l === 'high' ? l : undefined;
    return {
      results: cap(parsed.results).map((i) => ({ title: String(i.title ?? '').slice(0, 200), description: i.description ? String(i.description).slice(0, 400) : undefined })).filter((i) => i.title),
      objectives: cap(parsed.objectives).map((i) => ({ title: String(i.title ?? '').slice(0, 200), targetValue: i.targetValue ? String(i.targetValue).slice(0, 100) : undefined })).filter((i) => i.title),
      premises: cap(parsed.premises).map((i) => ({ title: String(i.title ?? '').slice(0, 200), description: i.description ? String(i.description).slice(0, 400) : undefined })).filter((i) => i.title),
      risks: cap(parsed.risks).map((i) => ({ title: String(i.title ?? '').slice(0, 200), riskLevel: validLevel(i.riskLevel), mitigation: i.mitigation ? String(i.mitigation).slice(0, 400) : undefined })).filter((i) => i.title),
      deliverables: cap(parsed.deliverables).map((i) => ({ title: String(i.title ?? '').slice(0, 200), responsible: i.responsible ? String(i.responsible).slice(0, 80) : undefined, dueInDays: i.dueInDays ? Math.max(1, Math.min(30, Number(i.dueInDays))) : 7 })).filter((i) => i.title),
    };
  } catch {
    throw new Error('Claude devolvió JSON inválido para ropre_from_transcription');
  }
}

/* ─────────────── Content Copy generation ─────────────── */

const PLATFORM_GUIDE: Record<string, string> = {
  instagram: 'Instagram: hook impactante en línea 1 (gancho emocional + curiosidad). Body 2-4 párrafos cortos con saltos de línea + emojis estratégicos (no decorativos). Cierre con CTA claro y hashtags (5-8). Total 80-150 palabras.',
  tiktok: 'TikTok: tono casual y directo, lenguaje hablado. Hook que cree pattern interrupt en los primeros 3 segundos. Body conversacional, 2-3 frases cortas. CTA implícito o explícito ("guarda esto", "etiqueta a alguien"). Sin hashtags excesivos.',
  youtube: 'YouTube: si es Short, similar a TikTok. Si es Video largo, descripción optimizada para SEO con keywords, primeros 100 caracteres como hook, luego estructura clara con timestamps si aplica, CTA al final.',
  linkedin: 'LinkedIn: tono profesional pero humano. Hook con dato concreto o pregunta provocadora. Body con storytelling B2B, lecciones aprendidas, mostrando autoridad. CTA suave (debate, opinión). Sin emojis o muy pocos. 150-220 palabras.',
  facebook: 'Facebook: más conversacional que LinkedIn pero menos casual que TikTok. Hook con historia o pregunta. Body 100-180 palabras con estructura clara. CTA explícito al final.',
};

const FORMAT_GUIDE: Record<string, string> = {
  reel: 'Reel de video corto (15-60s). Script breve, accionable, con beats claros.',
  post: 'Post estático (carrusel/imagen). Texto del caption.',
  story: 'Story efímera (24h). Texto breve, directo, con tap-through.',
  video: 'Video largo. Estructura con intro + desarrollo + cierre.',
  carousel: 'Carrusel multi-slide. Cada slide tiene 1 idea. Estructura: portada gancho → 4-7 slides de contenido → slide CTA final.',
  short: 'Short vertical (15-60s). Script breve, hook fuerte.',
};

const CTA_GUIDE: Record<string, string> = {
  lead_magnet:  'CTA hacia un lead magnet gratis con link en bio. Frase tipo "Link en bio para descargar GRATIS ↓".',
  buy_now:      'CTA directo a comprar. Mensaje de urgencia o escasez si aplica. Ej: "Disponible ahora → link en bio".',
  comment_info: 'CTA pidiendo que comenten una palabra clave (ej. "INFO" o "QUIERO") para enviar más detalles por DM.',
  dm_keyword:   'CTA pidiendo que envíen una palabra al DM directamente para activar una conversación 1:1.',
  subscribe:    'CTA de suscripción/seguimiento. Para crecer audiencia, no para conversión inmediata.',
  save:         'CTA pidiendo guardar el post para releer. Ideal en contenido educativo denso.',
  tag_friend:   'CTA pidiendo etiquetar a alguien que necesite ver esto. Genera alcance orgánico.',
  share:        'CTA pidiendo compartir en story / con alguien específico.',
  click_link:   'CTA explícito a clickear el link en bio o stories.',
  webinar:      'CTA a inscribirse al webinar/evento con fecha y promesa clara.',
  book_call:    'CTA a agendar una llamada de diagnóstico/consultoría.',
  no_cta:       'NO incluyas CTA — esta pieza es de valor puro, sin pedir acción.',
};

async function generateContentCopy(apiKey: string, ctx: GenerateContentCopyCtx): Promise<{ script: string; caption: string }> {
  const platformHint = PLATFORM_GUIDE[ctx.platform.toLowerCase()] ?? PLATFORM_GUIDE.instagram;
  const formatHint = FORMAT_GUIDE[ctx.format.toLowerCase()] ?? FORMAT_GUIDE.post;
  const ctaHint = ctx.ctaType ? (CTA_GUIDE[ctx.ctaType] ?? '') : '';

  const brandBlock = [
    ctx.brandMission ? `Misión: ${ctx.brandMission}` : null,
    ctx.brandVoiceTone ? `Tono de voz: ${ctx.brandVoiceTone}` : null,
    ctx.brandValues && ctx.brandValues.length > 0 ? `Valores: ${ctx.brandValues.join(' · ')}` : null,
    ctx.brandPillars && ctx.brandPillars.length > 0
      ? `Pilares: ${ctx.brandPillars.map((p) => `${p.name} (${p.description})`).join(' / ')}`
      : null,
    ctx.brandDos && ctx.brandDos.length > 0 ? `DO's: ${ctx.brandDos.join(' · ')}` : null,
    ctx.brandDonts && ctx.brandDonts.length > 0 ? `DON'Ts: ${ctx.brandDonts.join(' · ')}` : null,
  ].filter(Boolean).join('\n');

  const personaBlock = ctx.personas && ctx.personas.length > 0
    ? ctx.personas.slice(0, 2).map((p) => `${p.name}: ${p.description}\n  Dolores: ${p.pains.join(', ')}\n  Deseos: ${p.desires.join(', ')}`).join('\n')
    : '(sin personas definidos)';

  const system = `Eres un copywriter senior de marketing digital. Escribes copies que convierten para redes sociales.

Devuelve SOLO JSON válido con esta forma EXACTA, sin texto antes ni después:
{
  "script": "Guion para el equipo (qué decir/grabar, beats, ángulo, transiciones). 4-8 líneas para reel/video/short, 2-4 frases para post/carrusel/story. NO se publica.",
  "caption": "Caption COMPLETO listo para copiar y pegar en la plataforma. Hook impactante en línea 1, cuerpo con saltos de línea reales y emojis estratégicos, CTA al cierre y hashtags si la plataforma los usa (IG 5-8, TikTok 3-5, LinkedIn 3-5, YT/FB pocos)."
}

Reglas:
- El hook del caption debe detener el scroll (no empezar con "Hola" ni "¿Sabías que...").
- Usa el tono de voz y respeta do's/don'ts de la marca.
- Habla a los dolores y deseos del avatar.
- El CTA debe ser EL SOLICITADO (ver guía de CTA). Si no se solicita ninguno, infiere uno apropiado o omítelo si la pieza es de valor puro.
- Respeta hints de plataforma y formato.`;

  const user = `Cliente: ${ctx.clientName} (${ctx.industry})

═══ MARCA ═══
${brandBlock || '(sin arquitectura de marca definida — usa criterio)'}

═══ AVATAR PRINCIPAL ═══
${personaBlock}

═══ OFERTA ═══
${ctx.irresistibleOffer ?? '(sin oferta definida)'}

═══ PIEZA A GENERAR ═══
Plataforma: ${ctx.platform}
Formato: ${ctx.format}
Idea / título de la pieza: "${ctx.title}"
Lead magnet activo: ${ctx.hasLeadMagnet ? 'sí' : 'no'}
${ctaHint ? `\nCTA solicitado: ${ctaHint}` : ''}

Guía de la plataforma: ${platformHint}
Guía del formato: ${formatHint}

Devuelve el JSON con script + caption.`;

  const txt = await callAnthropic(apiKey, system, user, 1400);
  try {
    const parsed = JSON.parse(extractJson(txt)) as { script?: string; caption?: string };
    return {
      script: String(parsed.script ?? '').trim(),
      caption: String(parsed.caption ?? '').trim(),
    };
  } catch {
    // Fallback: si la IA no devolvió JSON, tratamos todo como caption.
    return { script: '', caption: txt.trim() };
  }
}

/* ─────────────── Ad Variants generation ─────────────── */

const AD_PLATFORM_HINT: Record<string, string> = {
  meta: 'Meta Ads (Facebook / Instagram): primaryText hasta 125 chars idealmente (máx 1000 ok). headline máx 40 chars. description máx 30 chars. ctaButton de la lista de botones de Meta.',
  google: 'Google Ads (Search): headline máx 30 chars cada uno. description máx 90 chars. SEO-friendly con keywords del producto. ctaButton "Más información" o "Comprar".',
  tiktok: 'TikTok Ads: lenguaje hablado y casual. primaryText 100 chars ideales. headline corto y punchy. Tono nativo de TikTok (no parece anuncio).',
  youtube: 'YouTube Ads: para Skip Ads / Bumper. Hook de 5 segundos. primaryText breve, gancho directo. headline impactante.',
};

const AD_ANGLES = [
  { id: 'pain',          label: 'Dolor',           focus: 'Empezar con el dolor más doloroso del avatar (frase punzante). Validar empatía. Mostrar la salida.' },
  { id: 'desire',        label: 'Deseo / aspiración', focus: 'Pintar la vida después de comprar. Tono inspiracional. Llevar al avatar a verse ya en el resultado.' },
  { id: 'objection',     label: 'Objeción común',  focus: 'Atacar la objeción más fuerte (precio, tiempo, escepticismo). Desarmar con dato o garantía.' },
  { id: 'social_proof',  label: 'Prueba social',   focus: 'Citar un caso real (número o testimonio breve). Posicionar como prueba de que sí funciona.' },
  { id: 'curiosity',     label: 'Curiosidad',      focus: 'Abrir con dato contraintuitivo o pregunta provocadora. No revelar la respuesta hasta el CTA.' },
];

async function generateAdVariants(apiKey: string, ctx: GenerateAdVariantsCtx): Promise<Array<{
  angle: string;
  angleLabel: string;
  headline: string;
  primaryText: string;
  description?: string;
  ctaButton: string;
}>> {
  const platformHint = AD_PLATFORM_HINT[ctx.platform.toLowerCase()] ?? AD_PLATFORM_HINT.meta;
  const brandBlock = [
    ctx.brandMission ? `Misión: ${ctx.brandMission}` : null,
    ctx.brandVoiceTone ? `Tono de voz: ${ctx.brandVoiceTone}` : null,
    ctx.brandDos && ctx.brandDos.length > 0 ? `DO's: ${ctx.brandDos.join(' · ')}` : null,
    ctx.brandDonts && ctx.brandDonts.length > 0 ? `DON'Ts: ${ctx.brandDonts.join(' · ')}` : null,
  ].filter(Boolean).join('\n');

  const personaBlock = ctx.personas && ctx.personas.length > 0
    ? ctx.personas.slice(0, 2).map((p) => `${p.name}: ${p.description}\n  Dolores: ${p.pains.join(', ')}\n  Deseos: ${p.desires.join(', ')}`).join('\n')
    : '(sin personas — usa criterio del producto/oferta)';

  const system = `Eres un copywriter senior de paid media (Meta Ads, Google Ads, TikTok Ads). Generas anuncios que VENDEN — no contenido orgánico.

Devuelve SOLO un array JSON con EXACTAMENTE 5 variantes (una por ángulo), sin texto antes ni después:

[
  {"angle": "pain", "headline": "...", "primaryText": "...", "description": "...", "ctaButton": "..."},
  {"angle": "desire", "headline": "...", "primaryText": "...", "description": "...", "ctaButton": "..."},
  {"angle": "objection", "headline": "...", "primaryText": "...", "description": "...", "ctaButton": "..."},
  {"angle": "social_proof", "headline": "...", "primaryText": "...", "description": "...", "ctaButton": "..."},
  {"angle": "curiosity", "headline": "...", "primaryText": "...", "description": "...", "ctaButton": "..."}
]

Reglas:
- 5 variantes, cada una con un ángulo distinto (los 5 listados).
- Respeta el límite de caracteres de la plataforma.
- ctaButton: string corto en español del estilo "Más información" / "Comprar ahora" / "Descargar" / "Agendar" / "Suscribirme".
- description es opcional (omítelo en TikTok/YouTube, OK en Meta/Google).
- Cada variant debe VENDER, no educar. Trigger emocional + propuesta clara + CTA.
- Sin emojis decorativos (1 o 0 emojis estratégicos máximo).
- Sin clichés ("transforma tu vida", "descubre el secreto", "imagina si...").
- Usa el tono de la marca pero adaptado a paid media (más punchy).`;

  const user = `Cliente: ${ctx.clientName} (${ctx.industry})

═══ MARCA ═══
${brandBlock || '(sin arquitectura de marca definida — usa criterio)'}

═══ AVATAR ═══
${personaBlock}

═══ OFERTA / PRODUCTO ═══
${ctx.productOrOffer}
${ctx.irresistibleOffer ? `\nOferta de la marca: ${ctx.irresistibleOffer}` : ''}

═══ CAMPAÑA ═══
Plataforma: ${ctx.platform}
Objetivo: ${ctx.objective}
${ctx.landingUrl ? `Landing: ${ctx.landingUrl}` : ''}
${ctx.budget ? `Presupuesto: ${ctx.budget}` : ''}

Plataforma específica: ${platformHint}

Ángulos a cubrir (uno por variante):
${AD_ANGLES.map((a) => `- ${a.id} (${a.label}): ${a.focus}`).join('\n')}

Genera las 5 variantes en JSON.`;

  const txt = await callAnthropic(apiKey, system, user, 1800);
  try {
    const parsed = JSON.parse(extractJson(txt)) as Array<{
      angle?: string; headline?: string; primaryText?: string; description?: string; ctaButton?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 5).map((v, i) => {
      const angleId = String(v.angle ?? AD_ANGLES[i]?.id ?? 'pain');
      const meta = AD_ANGLES.find((a) => a.id === angleId) ?? AD_ANGLES[i] ?? AD_ANGLES[0];
      return {
        angle: angleId,
        angleLabel: meta.label,
        headline: String(v.headline ?? '').slice(0, 200),
        primaryText: String(v.primaryText ?? '').slice(0, 2000),
        description: v.description ? String(v.description).slice(0, 200) : undefined,
        ctaButton: String(v.ctaButton ?? 'Más información').slice(0, 40),
      };
    }).filter((v) => v.headline && v.primaryText);
  } catch {
    throw new Error('Claude devolvió JSON inválido para generate_ad_variants');
  }
}

/* ─────────────── Weekly client report (haiku) ─────────────── */

async function weeklyReport(apiKey: string, ctx: WeeklyReportCtx): Promise<{ summary: string; priorities: string[] }> {
  const system = `Eres una PM senior que escribe reportes ejecutivos para clientes finales (founders de marcas / agencias). Tono profesional, positivo, orientado a resultados — NO marketinero, NO buzzword-heavy. Específico al cliente y al estado real del proyecto.

Devuelve SOLO un JSON con esta forma EXACTA, sin texto antes ni después:
{
  "summary": "Un párrafo de 3-4 oraciones que resume el avance de la semana del cliente. Empieza con un hecho concreto (ej: 'Completamos X tareas esta semana...'). Menciona el cumplimiento, el ritmo y la mira en el próximo hito. Cierra con una nota de continuidad.",
  "priorities": ["3 prioridades para la próxima semana, cada una es una frase corta y accionable que empieza con verbo en infinitivo. Específicas a las tareas pendientes que aparecen abajo. NO genéricas."]
}

Reglas:
- "priorities" SIEMPRE tiene exactamente 3 elementos.
- Si no hay datos suficientes, igualmente devuelve el JSON con texto neutral.
- Sin emojis. Sin "¡!". Tono adulto y serio.`;

  const daysToEventText = ctx.daysToNextEvent === null
    ? 'sin evento principal definido'
    : ctx.daysToNextEvent < 0
    ? `el próximo hito pasó hace ${Math.abs(ctx.daysToNextEvent)} días`
    : `${ctx.daysToNextEvent} días al próximo hito`;

  const pendingBlock = ctx.pendingTasksSample.length === 0
    ? '(no hay tareas pendientes registradas)'
    : ctx.pendingTasksSample.map((t) => {
        const due = t.dueInDays < 0
          ? `VENCIDA hace ${Math.abs(t.dueInDays)}d`
          : t.dueInDays === 0 ? 'vence hoy' : `vence en ${t.dueInDays}d`;
        return `- [${t.priority}] ${t.title} (${t.role}, ${due})`;
      }).join('\n');

  const user = `Cliente: ${ctx.clientName}
Período: ${ctx.weekStart.slice(0, 10)} → ${ctx.weekEnd.slice(0, 10)}

DATOS DE LA SEMANA:
- Tareas completadas: ${ctx.tasksCompleted}
- Tareas pendientes: ${ctx.tasksPending}
- Cumplimiento a tiempo: ${ctx.compliancePct}%
- ${daysToEventText}

TAREAS PENDIENTES (para inferir las 3 prioridades):
${pendingBlock}

Genera summary + priorities en JSON.`;

  // Usamos haiku-4-5: más rápido y barato; calidad suficiente para resúmenes
  // estructurados. ~$0.005 por reporte vs ~$0.04 con sonnet.
  const txt = await callAnthropic(apiKey, system, user, 800, FAST_MODEL);
  try {
    const parsed = JSON.parse(extractJson(txt)) as { summary?: string; priorities?: string[] };
    const summary = String(parsed.summary ?? '').trim();
    const priorities = Array.isArray(parsed.priorities)
      ? parsed.priorities.slice(0, 3).map((p) => String(p).trim()).filter(Boolean)
      : [];
    // Garantiza siempre 3 prioridades para que el PDF no se vea raro.
    while (priorities.length < 3) priorities.push('Sin prioridad adicional para esta semana.');
    return { summary, priorities };
  } catch {
    throw new Error('Claude devolvió JSON inválido para weekly_report');
  }
}

async function ropreWeekly(apiKey: string, ctx: RopreWeeklyCtx): Promise<{
  estado_resultado: string; avance_resultado: number; resumen_semana: string;
  alertas_ropre: string[]; cambios_esta_semana: string; semaforo: string; recomendacion_pm: string;
}> {
  const system = `Eres una PM senior que analiza el estado ROPRE (Resultado, Objetivos, Premisas, Riesgos, Entregables) de un proyecto al cierre de la semana. Tono profesional, directo, orientado a acción.

Devuelve SOLO un JSON con esta forma EXACTA:
{
  "estado_resultado": "En camino | En riesgo | Desviado",
  "avance_resultado": <número 0-100>,
  "resumen_semana": "2 oraciones sobre qué avanzó",
  "alertas_ropre": ["alertas si existen, vacío si no"],
  "cambios_esta_semana": "qué cambió respecto a la semana anterior",
  "semaforo": "verde | amarillo | rojo",
  "recomendacion_pm": "una acción concreta para la próxima semana"
}
Sin texto antes ni después. Sin emojis.`;

  const user = `Cliente: ${ctx.clientName}
Resultado esperado: ${ctx.resultadoEsperado || '(sin definir)'}
Objetivos: ${ctx.objetivos.join('; ') || '(ninguno)'}
Premisas: ${ctx.premisas.join('; ') || '(ninguna)'}
Riesgos activos: ${ctx.riesgos.join('; ') || '(ninguno)'}
Entregables pendientes: ${ctx.entregablesPendientes}
Tareas completadas esta semana: ${ctx.tareasCompletadas.join('; ') || '(ninguna)'}
Tareas vencidas: ${ctx.tareasVencidas.join('; ') || '(ninguna)'}
Cumplimiento del equipo: ${ctx.cumplimientoPct}%

Genera el análisis ROPRE en JSON.`;

  const txt = await callAnthropic(apiKey, system, user, 700, FAST_MODEL);
  const parsed = JSON.parse(extractJson(txt)) as Record<string, unknown>;
  return {
    estado_resultado: String(parsed.estado_resultado ?? 'En camino'),
    avance_resultado: Number(parsed.avance_resultado ?? 0),
    resumen_semana: String(parsed.resumen_semana ?? ''),
    alertas_ropre: Array.isArray(parsed.alertas_ropre) ? parsed.alertas_ropre.map(String) : [],
    cambios_esta_semana: String(parsed.cambios_esta_semana ?? ''),
    semaforo: String(parsed.semaforo ?? 'amarillo'),
    recomendacion_pm: String(parsed.recomendacion_pm ?? ''),
  };
}

async function meetingReport(apiKey: string, ctx: MeetingReportCtx): Promise<{
  headline: string;
  deck: string;
  kpis: Array<{ label: string; value: string; sub?: string; tone: string }>;
  decisions: string[];
  risks: Array<{ title: string; detail?: string; level: string }>;
  nextSteps: string[];
  nextMeetingFocus?: string;
}> {
  const system = `Eres una Project Manager senior de una agencia de marketing digital en LATAM. Redactas el REPORTE EJECUTIVO de una reunión, dirigido al equipo: claro, específico y accionable, como lo haría una PM con 10 años de experiencia.

Devuelve SOLO un objeto JSON válido (sin texto antes ni después) con esta forma EXACTA:
{
  "headline": "Título corto y potente del reporte (máx 8 palabras)",
  "deck": "Bajada de 1-2 frases con lo esencial: qué se decidió y qué sigue.",
  "kpis": [{"label":"etiqueta corta","value":"dato o cifra","sub":"contexto breve","tone":"g|r|a|b|"}],
  "decisions": ["Decisión concreta tomada en la reunión"],
  "risks": [{"title":"Riesgo o bloqueo","detail":"por qué importa o cómo mitigar","level":"low|medium|high"}],
  "nextSteps": ["Próximo paso accionable (verbo en infinitivo)"],
  "nextMeetingFocus": "Foco sugerido para la próxima reunión (una frase)"
}

Reglas:
- Usa SOLO información de las notas/agenda/resumen. NO inventes cifras ni acuerdos.
- kpis: solo métricas o hechos duros que aparezcan (ROAS, presupuesto, leads, fechas límite, %). Si no hay datos duros, devuelve [] o 1-2 hitos cualitativos. tone: g=logro/positivo, r=alerta/crítico, a=atención, b=informativo, ""=neutro.
- decisions: máximo 6, las más importantes. Si no hay, [].
- risks: máximo 4; si no hay riesgos claros, [].
- nextSteps: máximo 6. No repitas los compromisos ya listados (esos ya están registrados como tareas).
- Español, profesional pero directo. Sin relleno.`;

  const commitments = ctx.commitments?.length
    ? `Compromisos/tareas ya extraídos de la reunión (YA registrados como tareas — no los repitas en nextSteps):\n${ctx.commitments.map((c) => `- ${c.title} → ${c.responsible} (en ${c.dueInDays}d)`).join('\n')}\n\n`
    : '';

  const user = `Cliente: ${ctx.clientName} (${ctx.industry})
Reunión: ${ctx.meetingTitle} · Tipo: ${ctx.meetingType} · Fecha: ${ctx.date}

${ctx.summary ? `Resumen previo:\n${ctx.summary.slice(0, 2000)}\n\n` : ''}${ctx.agenda ? `Agenda:\n${ctx.agenda.slice(0, 2000)}\n\n` : ''}${commitments}Notas de la reunión:
${(ctx.notes || '(sin notas)').slice(0, 8000)}

Genera el reporte ejecutivo en JSON.`;

  // Modelo rápido (Haiku) + notas acotadas: evita el timeout del Edge Function
  // con transcripciones largas. Salida estructurada corta → 1200 tokens bastan.
  const txt = await callAnthropic(apiKey, system, user, 1200, FAST_MODEL);
  const parsed = JSON.parse(extractJson(txt)) as Record<string, unknown>;
  const okTone = (t: unknown) => (['g', 'r', 'a', 'b', ''].includes(String(t)) ? String(t) : '');
  const okLevel = (l: unknown) => (['low', 'medium', 'high'].includes(String(l)) ? String(l) : 'medium');
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  return {
    headline: String(parsed.headline ?? ctx.meetingTitle).slice(0, 120),
    deck: String(parsed.deck ?? '').slice(0, 600),
    kpis: arr(parsed.kpis).slice(0, 6).map((k) => {
      const o = k as Record<string, unknown>;
      return {
        label: String(o.label ?? '').slice(0, 40),
        value: String(o.value ?? '').slice(0, 40),
        sub: o.sub ? String(o.sub).slice(0, 140) : undefined,
        tone: okTone(o.tone),
      };
    }).filter((k) => k.label && k.value),
    decisions: arr(parsed.decisions).slice(0, 6).map((d) => String(d).slice(0, 300)).filter(Boolean),
    risks: arr(parsed.risks).slice(0, 4).map((r) => {
      const o = r as Record<string, unknown>;
      return {
        title: String(o.title ?? '').slice(0, 180),
        detail: o.detail ? String(o.detail).slice(0, 300) : undefined,
        level: okLevel(o.level),
      };
    }).filter((r) => r.title),
    nextSteps: arr(parsed.nextSteps).slice(0, 6).map((s) => String(s).slice(0, 300)).filter(Boolean),
    nextMeetingFocus: parsed.nextMeetingFocus ? String(parsed.nextMeetingFocus).slice(0, 300) : undefined,
  };
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = text.indexOf('{');
  const startArr = text.indexOf('[');
  const realStart = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (realStart === -1) return text;
  return text.slice(realStart).trim();
}
