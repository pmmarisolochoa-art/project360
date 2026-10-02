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
import {
  FATHOM_CLIENTES,
  FATHOM_DESDE,
  clienteDeTituloFathom,
  externalIdReunionFathom,
  externalIdTareaFathom,
  resolverResponsableFathom,
} from '../../src/config/fathom';

export const config = { runtime: 'edge' };

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

export default async function handler(req: Request): Promise<Response> {
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

  // ── 3. Traer de Fathom: reuniones con resumen + action items ───────────────
  const createdAfter = `${FATHOM_DESDE}T00:00:00Z`;
  let items: FathomMeeting[] = [];
  let cursor: string | undefined;
  try {
    for (let pagina = 0; pagina < 10; pagina++) {
      const url = new URL('https://api.fathom.ai/external/v1/meetings');
      url.searchParams.set('created_after', createdAfter);
      url.searchParams.set('include_summary', 'true');
      url.searchParams.set('include_action_items', 'true');
      if (cursor) url.searchParams.set('cursor', cursor);

      const r = await fetch(url, { headers: { 'X-Api-Key': fathomKey, Accept: 'application/json' } });
      if (r.status === 401) {
        return json({ error: 'Fathom rechazó la llave (401). Está vencida o revocada: pide una nueva.' }, 502);
      }
      if (!r.ok) return json({ error: `Fathom respondió ${r.status}.` }, 502);

      const data = (await r.json()) as { items?: FathomMeeting[]; next_cursor?: string };
      items = items.concat(Array.isArray(data.items) ? data.items : []);
      if (!data.next_cursor) break;
      cursor = data.next_cursor;
    }
  } catch (e) {
    return json({ error: `No se pudo hablar con Fathom: ${(e as Error).message}` }, 502);
  }

  // ── 3.5 Cargar el equipo del cliente destino (para resolver assignees) ─────
  let nombresEquipo: string[] = [];
  {
    const { data: cs } = await admin.from('clients').select('id').eq('name', declarado.cliente).limit(2);
    if (cs && cs.length === 1) {
      const { data: tm } = await admin.from('team_members').select('nombre').eq('client_id', cs[0].id);
      nombresEquipo = [...new Set((tm ?? []).map((m) => String(m.nombre ?? '').trim()).filter(Boolean))];
    }
  }

  // ── 4. Filtrar por palabra clave + traducir ─────────────────────────────────
  const diag: Record<string, unknown> = { recibidasDeFathom: items.length };

  const paso1 = items.filter((m) => {
    const titulo = m.title || m.meeting_title || '';
    const r = clienteDeTituloFathom(titulo);
    return r !== undefined && r !== 'ambiguo' && r.cliente === declarado.cliente;
  });
  diag.trasPalabraClave = paso1.length;

  const ambiguas = items
    .filter((m) => clienteDeTituloFathom(m.title || m.meeting_title || '') === 'ambiguo')
    .map((m) => m.title || m.meeting_title || '(sin título)');
  diag.ambiguasDescartadas = ambiguas;

  const reuniones = paso1
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

  return json({ cliente: declarado.cliente, total: reuniones.length, reuniones, diagnostico: diag });
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
