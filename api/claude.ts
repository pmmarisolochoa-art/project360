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
}

interface ThreeOptionsCtx {
  section: 'market' | 'offer' | 'narrative' | 'personas';
  client: { businessName: string; industry: string; founderName?: string };
  signal?: string;
}

interface RegenerateCtx {
  section: 'market' | 'offer' | 'narrative' | 'personas';
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

type RequestBody =
  | { feature: 'meeting_agenda'; context: MeetingAgendaCtx }
  | { feature: 'three_options'; context: ThreeOptionsCtx }
  | { feature: 'regenerate_section'; context: RegenerateCtx }
  | { feature: 'brain_from_onboarding'; context: BrainCtx }
  | { feature: 'extract_tasks'; context: ExtractTasksCtx };

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
  const system = `Eres una estratega senior de marketing digital. Generas agendas de reunión claras, accionables y breves, siempre adaptadas al contexto real del cliente (cerebro estratégico, notas del pre-brief y reuniones previas). Devuelve SOLO una lista numerada de 5 puntos, sin introducción ni cierre. Cada punto debe ser específico al cliente — evita genéricos como "Revisar performance".`;

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

  parts.push('', 'Genera la agenda de 5 puntos para esta reunión, dándole continuidad al contexto anterior. Si hay seguimiento pendiente de reuniones previas, inclúyelo. Si las notas del pre-brief mencionan temas concretos, abórdalos primero.');

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

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = text.indexOf('{');
  const startArr = text.indexOf('[');
  const realStart = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (realStart === -1) return text;
  return text.slice(realStart).trim();
}
