/**
 * Vercel Edge Function — Lee las reuniones de Fathom y las devuelve ya
 * traducidas al vocabulario de Project360, listas para importar.
 *
 * Mismo porqué que `api/paralelo/reuniones.ts`: la llave de Fathom (API key de
 * cuenta) ve TODAS las reuniones grabadas por quien la generó, transcripción
 * incluida. Se queda aquí, en `FATHOM_API_KEY`; el navegador solo ve el
 * resultado ya filtrado por cliente.
 *
 * A diferencia de Paralelo, Fathom no tiene "proyectos": el cliente se decide
 * por palabra clave en el título (`src/config/fathom.ts`), y lo que no calce
 * con ningún cliente habilitado, o calce con más de uno, se descarta — no se
 * adivina ni se mete en un cajón de sastre.
 *
 * NO trae transcripción completa en el listado — solo `default_summary`
 * (markdown ya resumido por Fathom) y `action_items`. Si algún día hace falta
 * el texto completo para el agente PM, va en un endpoint aparte bajo demanda.
 *
 * Requiere en Vercel: FATHOM_API_KEY, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL.
 */

import { createClient } from '@supabase/supabase-js';
// La extensión `.js` (el archivo real es `fathom.ts`) es obligatoria aquí:
// como función Node normal, Vercel NO empaqueta este archivo en uno solo
// (como sí hacía Edge con esbuild) — solo lo copia y deja que el loader ESM
// nativo de Node resuelva el import en producción, y ese loader exige
// extensión explícita en imports relativos. Sin ella: ERR_MODULE_NOT_FOUND
// en prod (confirmado en los logs de Vercel), aunque typecheck pase local.
import {
  FATHOM_CLIENTES,
  FATHOM_DESDE,
  clienteDeTituloFathom,
  externalIdReunionFathom,
  externalIdTareaFathom,
  resolverResponsableFathom,
} from '../../src/config/fathom.js';

// SIN runtime 'edge' a propósito: las Edge Functions de Vercel tienen que
// EMPEZAR a responder dentro de 25s pase lo que pase (no es negociable con
// menos trabajo) — confirmado en prod con 504 a los 25.1s incluso tras
// aligerar la primera pasada. Como función Node normal (`maxDuration` en
// vercel.json) no tiene ese límite rígido.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface FathomAssignee {
  name?: string;
  email?: string;
  team?: string;
}

interface FathomActionItem {
  description?: string;
  completed?: boolean;
  assignee?: FathomAssignee;
}

interface FathomInvitee {
  name?: string;
  email?: string;
}

interface FathomMeeting {
  title?: string;
  meeting_title?: string;
  recording_id: number;
  url?: string;
  scheduled_start_time?: string | null;
  recording_start_time?: string | null;
  recording_end_time?: string | null;
  calendar_invitees?: FathomInvitee[];
  default_summary?: { markdown_formatted?: string } | null;
  action_items?: FathomActionItem[];
}

/**
 * Pide una página (o varias, siguiendo el cursor) de `GET /meetings` a
 * Fathom con los parámetros dados. Separado del handler porque se llama DOS
 * VECES (pasada liviana + pasada con detalle) con distintos parámetros — ver
 * el comentario en el handler.
 */
async function listarFathom(
  fathomKey: string,
  params: Record<string, string>,
  maxPaginas: number,
): Promise<{ items: FathomMeeting[] } | { error: Response }> {
  let items: FathomMeeting[] = [];
  let cursor: string | undefined;
  try {
    for (let pagina = 0; pagina < maxPaginas; pagina++) {
      const url = new URL('https://api.fathom.ai/external/v1/meetings');
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      if (cursor) url.searchParams.set('cursor', cursor);

      const r = await fetch(url, { headers: { 'X-Api-Key': fathomKey, Accept: 'application/json' } });
      if (r.status === 401) {
        return { error: json({ error: 'Fathom rechazó la llave (401). Está vencida o revocada: pide una nueva.' }, 502) };
      }
      if (!r.ok) return { error: json({ error: `Fathom respondió ${r.status}.` }, 502) };

      const data = (await r.json()) as { items?: FathomMeeting[]; next_cursor?: string };
      items = items.concat(Array.isArray(data.items) ? data.items : []);
      if (!data.next_cursor) break;
      cursor = data.next_cursor;
    }
  } catch (e) {
    return { error: json({ error: `No se pudo hablar con Fathom: ${(e as Error).message}` }, 502) };
  }
  return { items };
}

// Exportada como `fetch` más abajo (no `export default`) a propósito: en el
// runtime Node.js de Vercel, `export default` usa la firma VIEJA de Node
// `(req, res) => void` (tus `return json(...)` se ignoran) — solo Edge le da
// la firma de Fetch (Request/Response) gratis a un `export default`. `fetch`
// es el nombre que Vercel reconoce para pedir la firma moderna también en
// Node. Sin esto: 500 FUNCTION_INVOCATION_FAILED instantáneo, confirmado en
// prod. Se llama `handler` (no `fetch`) y se reexporta con alias al final del
// archivo — nombrar la función misma `fetch` ensombrecería el `fetch` GLOBAL
// que este mismo archivo usa para hablar con Fathom y Anthropic.
async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Método no permitido.' }, 405);

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fathomKey = process.env.FATHOM_API_KEY;

  if (!supaUrl || !serviceKey) return json({ error: 'Falta config Supabase.' }, 500);
  if (!fathomKey) {
    return json({ error: 'Falta FATHOM_API_KEY. Configúralo en Vercel antes de importar.' }, 503);
  }

  // ── 1. Autenticar: sesión válida de Project360 ─────────────────────────────
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autorizado.' }, 401);

  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json({ error: 'Sesión inválida.' }, 401);

  // ── 2. Qué cliente se pide ──────────────────────────────────────────────────
  const clienteNombre = new URL(req.url).searchParams.get('cliente')?.trim() || '';
  if (!clienteNombre) return json({ error: 'Falta cliente.' }, 400);

  const declarado = FATHOM_CLIENTES.find(
    (c) => c.cliente.trim().toLowerCase() === clienteNombre.toLowerCase(),
  );
  if (!declarado) {
    return json(
      {
        error:
          'Ese cliente no está habilitado para Fathom. ' +
          'Agrégalo a src/config/fathom.ts si de verdad debe importarse.',
        habilitados: FATHOM_CLIENTES.map((c) => c.cliente),
      },
      422,
    );
  }

  // ── 3. Traer de Fathom en DOS PASADAS ───────────────────────────────────────
  //
  // Fathom no filtra por cliente de su lado (no hay "proyectos" ahí) — antes
  // esto pedía `include_summary`+`include_action_items` para TODA la cuenta
  // desde FATHOM_DESDE de una sola pasada, y con varios clientes grabando
  // desde septiembre eso agota el límite de 25s del edge function (confirmado
  // en prod: 504 a los 25.29s, SIN llegar nunca a filtrar por título).
  //
  // Pasada 1 — liviana: solo título + fecha, SIN resumen ni tareas, para
  // encontrar cuáles reuniones son de este cliente.
  // Pasada 2 — solo si hubo match: vuelve a pedir, pero acotada a la fecha
  // real de esas reuniones (±1 día de margen por huso horario), CON resumen y
  // tareas. El costo caro queda limitado al puñado de reuniones del cliente,
  // no a la cuenta entera.
  const createdAfter = `${FATHOM_DESDE}T00:00:00Z`;

  const pase1 = await listarFathom(fathomKey, { created_after: createdAfter, limit: '25' }, 40);
  if ('error' in pase1) return pase1.error;
  const livianas = pase1.items;

  const diag: Record<string, unknown> = { recibidasDeFathom: livianas.length };

  const esDeEsteCliente = (m: FathomMeeting) => {
    const r = clienteDeTituloFathom(m.title || m.meeting_title || '');
    return r !== undefined && r !== 'ambiguo' && r.cliente === declarado.cliente;
  };

  const matchLivianas = livianas.filter(esDeEsteCliente);
  diag.trasPalabraClave = matchLivianas.length;

  const ambiguas = livianas
    .filter((m) => clienteDeTituloFathom(m.title || m.meeting_title || '') === 'ambiguo')
    .map((m) => m.title || m.meeting_title || '(sin título)');
  diag.ambiguasDescartadas = ambiguas;

  let items: FathomMeeting[] = [];
  if (matchLivianas.length > 0) {
    const fechas = matchLivianas
      .map((m) => m.recording_start_time || m.scheduled_start_time)
      .filter((f): f is string => Boolean(f))
      .map((f) => new Date(f).getTime())
      .filter((t) => !Number.isNaN(t));
    const DIA_MS = 86400000;
    const params: Record<string, string> = {
      created_after: fechas.length ? new Date(Math.min(...fechas) - DIA_MS).toISOString() : createdAfter,
      include_summary: 'true',
      include_action_items: 'true',
      limit: '25',
    };
    if (fechas.length) params.created_before = new Date(Math.max(...fechas) + DIA_MS).toISOString();

    const pase2 = await listarFathom(fathomKey, params, 10);
    if ('error' in pase2) return pase2.error;
    // Reafirma el filtro por título: la ventana de fechas puede traer
    // reuniones de OTROS clientes grabadas el mismo día.
    items = pase2.items.filter(esDeEsteCliente);
  }
  diag.trasDetalle = items.length;

  // ── 3.5 Cargar el equipo del cliente destino (para resolver assignees) ─────
  let nombresEquipo: string[] = [];
  {
    const { data: cs } = await admin.from('clients').select('id').eq('name', declarado.cliente).limit(2);
    if (cs && cs.length === 1) {
      const { data: tm } = await admin.from('team_members').select('nombre').eq('client_id', cs[0].id);
      nombresEquipo = [...new Set((tm ?? []).map((m) => String(m.nombre ?? '').trim()).filter(Boolean))];
    }
  }

  // ── 4. Traducir ──────────────────────────────────────────────────────────
  const reuniones = items
    .map((m) => {
      const titulo = (m.title || m.meeting_title || 'Reunión sin título').trim();
      const fecha = m.recording_start_time || m.scheduled_start_time || null;
      const actionItems = Array.isArray(m.action_items) ? m.action_items : [];

      return {
        externalId: externalIdReunionFathom(m.recording_id),
        fathomId: m.recording_id,
        titulo,
        cliente: declarado.cliente,
        fecha,
        duracionMin: minutosEntre(m.recording_start_time, m.recording_end_time),
        url: m.url,
        resumen: m.default_summary?.markdown_formatted?.trim() || undefined,
        tareas: actionItems
          .filter((a) => !a.completed) // ya resueltos en la reunión misma: no hace falta traerlos
          .map((a) => {
            const descripcion = String(a.description ?? '').trim();
            return {
              externalId: externalIdTareaFathom(m.recording_id, descripcion),
              titulo: descripcion,
              responsableCrudo: a.assignee?.name,
              responsable: resolverResponsableFathom(a.assignee?.name, nombresEquipo),
            };
          })
          .filter((t) => t.titulo.length > 0),
      };
    })
    .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));

  diag.finalParaCliente = reuniones.length;

  /**
   * Traducir al español — SOLO lo que de verdad se va a mostrar/guardar (las
   * reuniones ya filtradas para este cliente, no todo lo que trajo Fathom).
   *
   * Se hace AQUÍ, antes de devolver, no después de importar: lo que la bandeja
   * de revisión muestra tiene que ser lo mismo que se guarda — el fallo de
   * "los dos traductores" del 11-ago, otra vez, si se tradujera en otro sitio.
   * Si falla, se sigue con el texto original (inglés) — no es motivo para que
   * la importación entera se caiga.
   */
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && reuniones.length > 0) {
    try {
      await traducirAlEspanol(anthropicKey, reuniones);
      diag.traducido = true;
    } catch (e) {
      diag.traducido = `falló: ${(e as Error).message}`;
    }
  }

  return json({ cliente: declarado.cliente, total: reuniones.length, reuniones, diagnostico: diag });
}

interface ReunionTraducible {
  titulo: string;
  resumen?: string;
  tareas: Array<{ titulo: string }>;
}

/**
 * Traduce título, resumen y títulos de tareas al español, EN SITIO (muta los
 * objetos). Un solo llamado a Anthropic con todos los textos de todas las
 * reuniones, en vez de uno por campo: más rápido y no se queda sin tiempo el
 * edge function con varias reuniones.
 */
async function traducirAlEspanol(apiKey: string, reuniones: ReunionTraducible[]): Promise<void> {
  // Aplana todos los textos a traducir en un solo array, con su ruta de vuelta.
  const textos: string[] = [];
  const rutas: Array<(nuevo: string) => void> = [];

  for (const r of reuniones) {
    textos.push(r.titulo);
    rutas.push((n) => { r.titulo = n; });
    if (r.resumen) {
      textos.push(r.resumen);
      rutas.push((n) => { r.resumen = n; });
    }
    for (const t of r.tareas) {
      textos.push(t.titulo);
      rutas.push((n) => { t.titulo = n; });
    }
  }
  if (textos.length === 0) return;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system: 'Traduces textos cortos de reuniones de trabajo (títulos de tareas, resúmenes) '
        + 'del idioma que vengan al ESPAÑOL. Si un texto ya está en español, lo devuelves tal '
        + 'cual. Devuelve SOLO un array JSON de strings, en el MISMO ORDEN y con la MISMA '
        + 'CANTIDAD de elementos que recibiste. Sin texto antes ni después del JSON.',
      messages: [{ role: 'user', content: JSON.stringify(textos) }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const bloque = data.content?.find((b) => b.type === 'text')?.text;
  if (!bloque) throw new Error('Respuesta sin texto');

  const match = bloque.match(/\[[\s\S]*\]/);
  const traducidos = JSON.parse(match ? match[0] : bloque) as unknown[];
  if (!Array.isArray(traducidos) || traducidos.length !== textos.length) {
    throw new Error(`Longitud no coincide (${Array.isArray(traducidos) ? traducidos.length : 'no es array'} de ${textos.length})`);
  }

  traducidos.forEach((t, i) => {
    const s = String(t ?? '').trim();
    if (s) rutas[i](s);
  });
}

function minutosEntre(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 30;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 30;
  return Math.max(1, Math.round(ms / 60000));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export { handler as fetch };
