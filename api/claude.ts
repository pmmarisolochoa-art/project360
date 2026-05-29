import Anthropic from '@anthropic-ai/sdk';

/**
 * Vercel Serverless Function — Anthropic API proxy.
 *
 * La API key vive solo aquí (ANTHROPIC_API_KEY env var en Vercel),
 * nunca llega al browser. El cliente solo conoce `/api/claude`.
 *
 * Endpoints discriminados por `feature` en el body:
 *   - meeting_agenda
 *   - three_options
 *   - regenerate_section
 *   - brain_from_onboarding
 */

const MODEL = 'claude-sonnet-4-6';

// CORS minimal — solo permite POST y JSON
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

type RequestBody =
  | { feature: 'meeting_agenda'; context: MeetingAgendaCtx }
  | { feature: 'three_options'; context: ThreeOptionsCtx }
  | { feature: 'regenerate_section'; context: RegenerateCtx }
  | { feature: 'brain_from_onboarding'; context: BrainCtx };

export const config = { runtime: 'edge' };

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

  const anthropic = new Anthropic({ apiKey });

  try {
    switch (body.feature) {
      case 'meeting_agenda':
        return json({ text: await meetingAgenda(anthropic, body.context) });
      case 'three_options':
        return json({ options: await threeOptions(anthropic, body.context) });
      case 'regenerate_section':
        return json({ patch: await regenerateSection(anthropic, body.context) });
      case 'brain_from_onboarding':
        return json({ brain: await brainFromOnboarding(anthropic, body.context) });
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

async function callText(client: Anthropic, system: string, user: string, maxTokens = 1024): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Respuesta sin contenido de texto');
  return block.text.trim();
}

async function meetingAgenda(client: Anthropic, ctx: MeetingAgendaCtx): Promise<string> {
  const system = `Eres una estratega senior de marketing digital. Generas agendas de reunión claras, accionables y breves. Devuelve SOLO una lista numerada de 5 puntos, sin introducción ni cierre. Cada punto en una línea.`;
  const user = `Cliente: ${ctx.clientName} (${ctx.industry})
Tipo de reunión: ${ctx.meetingType}
Tareas pendientes del cliente: ${ctx.pendingTasksCount}
Datos de ADS conectados: ${ctx.hasAdsData ? 'sí' : 'no'}

Genera la agenda de 5 puntos para esta reunión.`;
  return callText(client, system, user, 512);
}

async function threeOptions(client: Anthropic, ctx: ThreeOptionsCtx): Promise<Array<{ id: string; title: string; content: string }>> {
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

  const txt = await callText(client, system, user, 1500);
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

async function regenerateSection(client: Anthropic, ctx: RegenerateCtx): Promise<Record<string, unknown>> {
  const name = ctx.identity?.businessName ?? 'la marca';
  const industry = ctx.identity?.industry ?? 'su industria';
  const founder = ctx.identity?.founderName ?? 'el founder';

  const sectionFields: Record<RegenerateCtx['section'], { fields: string[]; instruction: string }> = {
    market: {
      fields: ['executiveSummary', 'gapAnalysis'],
      instruction: `Genera un análisis ejecutivo actualizado del mercado y un gap analysis. Devuelve JSON con campos "executiveSummary" (3-4 oraciones) y "gapAnalysis" (2-3 oraciones).`,
    },
    offer: {
      fields: ['irresistibleOffer'],
      instruction: `Genera UNA oferta irresistible en 1-2 oraciones. Debe ser específica, con resultado claro y diferenciador. Devuelve JSON con campo "irresistibleOffer".`,
    },
    narrative: {
      fields: ['executiveSummary'],
      instruction: `Genera una descripción de la narrativa y tono de marca en 2-3 oraciones. Devuelve JSON con campo "executiveSummary".`,
    },
    personas: {
      fields: ['buyerPersonas'],
      instruction: `Genera EXACTAMENTE 3 buyer personas diferenciados. Devuelve JSON con campo "buyerPersonas" que es un array de objetos con campos: name, description (1-2 oraciones), pains (array de 3 strings), desires (array de 3 strings).`,
    },
  };
  const def = sectionFields[ctx.section];

  const system = `Eres estratega senior. Devuelve SOLO JSON válido sin texto antes ni después. ${def.instruction}`;
  const user = `Cliente: ${name} (${industry}) — founder: ${founder}

Contexto actual: ${JSON.stringify(ctx.current).slice(0, 1500)}

Regenera la sección.`;

  const txt = await callText(client, system, user, 1500);
  try {
    return JSON.parse(extractJson(txt));
  } catch {
    throw new Error('Claude devolvió JSON inválido para regenerate_section');
  }
}

async function brainFromOnboarding(client: Anthropic, ctx: BrainCtx): Promise<Record<string, unknown>> {
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

  const txt = await callText(client, system, user, 3000);
  try {
    const parsed = JSON.parse(extractJson(txt));
    parsed.generatedAt = new Date().toISOString();
    return parsed;
  } catch {
    throw new Error('Claude devolvió JSON inválido para brain_from_onboarding');
  }
}

function extractJson(text: string): string {
  // Extrae JSON aunque venga rodeado de markdown ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = text.indexOf('{');
  const startArr = text.indexOf('[');
  const realStart = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (realStart === -1) return text;
  return text.slice(realStart).trim();
}
