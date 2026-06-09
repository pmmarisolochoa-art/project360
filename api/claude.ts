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
}

interface RopreFromTranscriptionCtx {
  clientName: string;
  industry: string;
  meetingType: string;
  transcription: string;
  availableRoles: string[];
}

interface GenerateContentCopyCtx {
  clientName: string;
  industry: string;
  platform: string;            // instagram | tiktok | youtube | linkedin | facebook
  format: string;              // reel | post | story | video | carousel | short
  title: string;               // idea / título del pieza
  hasLeadMagnet: boolean;
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

type RequestBody =
  | { feature: 'meeting_agenda'; context: MeetingAgendaCtx }
  | { feature: 'three_options'; context: ThreeOptionsCtx }
  | { feature: 'regenerate_section'; context: RegenerateCtx }
  | { feature: 'brain_from_onboarding'; context: BrainCtx }
  | { feature: 'extract_tasks'; context: ExtractTasksCtx }
  | { feature: 'ropre_from_transcription'; context: RopreFromTranscriptionCtx }
  | { feature: 'generate_content_copy'; context: GenerateContentCopyCtx };

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

async function callAnthropic(apiKey: string, system: string, user: string, maxTokens = 1024): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
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
  {"title": "Tarea clara y accionable (verbo + objeto)", "responsibleRole": "uno de los roles disponibles", "dueInDays": número entre 1 y 30},
  ...
]
Reglas:
- Máximo 8 tareas, mínimo 0.
- Si no hay tareas claras, devuelve [].
- Cada title empieza con verbo en infinitivo.
- Asigna el rol más apropiado de la lista disponible.
- dueInDays: urgente=2, normal=7, baja=14.`;

  const user = `Cliente: ${ctx.clientName} (${ctx.industry})
Tipo de reunión: ${ctx.meetingType}
Roles disponibles: ${ctx.availableRoles.join(', ')}

${ctx.agenda ? `Agenda:\n${ctx.agenda}\n\n` : ''}Notas de la reunión:
${ctx.notes}

Extrae las tareas accionables.`;

  const txt = await callAnthropic(apiKey, system, user, 1200);
  try {
    const parsed = JSON.parse(extractJson(txt));
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 8).map((t: { title?: string; responsibleRole?: string; dueInDays?: number }) => ({
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

async function generateContentCopy(apiKey: string, ctx: GenerateContentCopyCtx): Promise<string> {
  const platformHint = PLATFORM_GUIDE[ctx.platform.toLowerCase()] ?? PLATFORM_GUIDE.instagram;
  const formatHint = FORMAT_GUIDE[ctx.format.toLowerCase()] ?? FORMAT_GUIDE.post;

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

  const system = `Eres un copywriter senior de marketing digital. Escribes copies que convierten para redes sociales, adaptados al cliente, su audiencia y la plataforma. NO devuelvas JSON ni metadatos. Devuelve SOLO el texto del copy listo para copiar y pegar.

Reglas:
- Empieza con un HOOK que detenga el scroll (primera línea).
- Usa el tono y do's/don'ts de la marca.
- Habla a los dolores y deseos del avatar específico.
- Si la marca tiene una oferta irresistible, ánclalo al final con CTA claro.
- Si hasLeadMagnet es true, dirige el CTA al lead magnet en bio. Si no, al producto/servicio principal.
- Respeta el formato y plataforma.`;

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

Guía de la plataforma: ${platformHint}
Guía del formato: ${formatHint}

Escribe el copy completo, listo para copiar.`;

  const txt = await callAnthropic(apiKey, system, user, 1200);
  return txt.trim();
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
