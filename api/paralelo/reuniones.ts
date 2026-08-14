/**
 * Vercel Edge Function — Lee las reuniones de Paralelo (Meetico) y las devuelve
 * ya traducidas al vocabulario de Project360, listas para importar.
 *
 * POR QUÉ ESTO EXISTE Y NO SE LLAMA A PARALELO DESDE EL NAVEGADOR:
 * la llave de Paralelo es un JWT que da acceso de lectura a TODAS las reuniones
 * de la cuenta — transcripciones incluidas. Cualquier cosa que viva en el
 * frontend la puede leer quien abra el inspector, miembros del equipo incluidos.
 * Así que la llave se queda aquí, en `PARALELO_TOKEN`, y el navegador solo ve
 * el resultado ya filtrado.
 *
 * Qué filtra, en orden:
 *   1. Solo proyectos declarados en `src/config/paralelo.ts` (lista blanca).
 *   2. Solo reuniones `completed` — las que están `processing` no tienen reporte.
 *   3. Fuera las de prueba ("prueba", "reu3.mp4", …).
 *
 * NO trae transcripciones. El reporte de Paralelo ya viene resumido y con las
 * tareas extraídas; la transcripción completa son ~30 KB por reunión de los que
 * aquí no se usa nada. Si algún día hace falta, va en un endpoint aparte y bajo
 * demanda, no en el listado.
 *
 * Es de SOLO LECTURA: no escribe en Paralelo (su API no lo permite) ni en
 * nuestra base. Quien escribe es el frontend, con la sesión del usuario y
 * pasando por RLS como cualquier otra creación de tarea.
 *
 * Requiere en Vercel: PARALELO_TOKEN, PARALELO_TENANT (opcional, default
 *   'ikigaigm'), SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL.
 */

import { createClient } from '@supabase/supabase-js';
import {
  PARALELO_PROYECTOS,
  PARALELO_DESDE,
  PARALELO_VENTANA_DIAS,
  proyectoParalelo,
  esReunionDePrueba,
  limpiarTituloParalelo,
  limpiarNombreParalelo,
  externalIdReunionParalelo,
  externalIdTareaParalelo,
} from '../../src/config/paralelo';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Forma de una reunión tal como la devuelve Meetico. */
interface MeetingParalelo {
  id: string;
  project_id: string | null;
  name: string | null;
  status: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  scheduled_start_time: string | null;
  recording_url: string | null;
}

/** Un compromiso dentro del reporte de Paralelo. */
interface ActionItemParalelo {
  task?: string;
  dueDate?: string;
  priority?: string;
  assignedTo?: string[] | string;
  dependencies?: string;
}

interface ReportRowParalelo {
  meeting_id: string;
  report: {
    actionItems?: ActionItemParalelo[];
    executiveSummary?: string | string[];
    reportTitle?: string;
  } | null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Método no permitido.' }, 405);

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paraleloToken = process.env.PARALELO_TOKEN;
  const tenant = process.env.PARALELO_TENANT || 'ikigaigm';

  if (!supaUrl || !serviceKey) return json({ error: 'Falta config Supabase.' }, 500);
  if (!paraleloToken) {
    return json(
      { error: 'Falta PARALELO_TOKEN. Configúralo en Vercel antes de importar.' },
      503,
    );
  }

  // ── 1. Autenticar: sesión válida de Project360 ─────────────────────────────
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'No autorizado.' }, 401);

  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json({ error: 'Sesión inválida.' }, 401);

  // ── 2. Qué proyecto se pide ────────────────────────────────────────────────
  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || '';
  if (!projectId) return json({ error: 'Falta projectId.' }, 400);

  const proyecto = proyectoParalelo(projectId);
  if (!proyecto) {
    // La regla de la integración: lo que existe allá y no está mapeado acá, se
    // rechaza. No se inventa un cliente ni se mete en un cajón de sastre.
    return json(
      {
        error:
          'Ese proyecto de Paralelo no está habilitado en Project360. ' +
          'Agrégalo a src/config/paralelo.ts si de verdad debe importarse.',
        habilitados: PARALELO_PROYECTOS.map((p) => ({ projectId: p.projectId, cliente: p.cliente })),
      },
      422,
    );
  }

  // ── 3. Traer de Paralelo: reuniones + reportes ─────────────────────────────
  const base = `https://${tenant}.meetico.parallelo.ai`;
  const headers = { Authorization: `Bearer ${paraleloToken}`, Accept: 'application/json' };

  let reuniones: MeetingParalelo[];
  let reportes: ReportRowParalelo[];
  try {
    const [rMeetings, rReports] = await Promise.all([
      fetch(`${base}/meetings`, { headers }),
      // `meeting_type=team` no es un lujo: sin él, Paralelo devuelve también
      // los reportes de sus LLAMADAS DE VENTA, que son otra cosa por completo
      // (perfil del lead, objeciones, métricas de cierre — ni una sola tarea).
      // Para David Guerrero son 220 llamadas contra 42 reuniones: filtrar baja
      // la respuesta de 8.7 MB a 615 KB. Un edge function no debería estar
      // moviendo 8 MB para tirar el 93%.
      fetch(
        `${base}/meetings/reports/query` +
          `?project_id=${encodeURIComponent(projectId)}&meeting_type=team&limit=500`,
        { headers },
      ),
    ]);

    // 401 aquí significa llave vencida o revocada por Paralelo, no un fallo
    // nuestro. Se dice tal cual para no mandar a nadie a depurar el sitio malo.
    if (rMeetings.status === 401 || rReports.status === 401) {
      return json(
        { error: 'Paralelo rechazó la llave (401). Está vencida o revocada: pide una nueva.' },
        502,
      );
    }
    if (!rMeetings.ok || !rReports.ok) {
      return json(
        { error: `Paralelo respondió ${rMeetings.ok ? rReports.status : rMeetings.status}.` },
        502,
      );
    }
    reuniones = (await rMeetings.json()) as MeetingParalelo[];
    reportes = (await rReports.json()) as ReportRowParalelo[];
  } catch (e) {
    return json({ error: `No se pudo hablar con Paralelo: ${(e as Error).message}` }, 502);
  }

  // ── 4. Traducir a vocabulario Project360 ───────────────────────────────────
  const reportePorReunion = new Map<string, ReportRowParalelo['report']>();
  for (const r of Array.isArray(reportes) ? reportes : []) {
    if (r?.meeting_id && r.report) reportePorReunion.set(r.meeting_id, r.report);
  }

  // Ventana: desde el arranque de la integración, y como mucho N días atrás.
  // La reunión del 5-ago apareció en Paralelo el 10 — por eso se mira hacia
  // atrás y no solo "lo de hoy".
  const corte = new Date(Date.now() - PARALELO_VENTANA_DIAS * 86400000)
    .toISOString()
    .slice(0, 10);
  const desde = corte > PARALELO_DESDE ? corte : PARALELO_DESDE;

  /**
   * DIAGNÓSTICO PERMANENTE — no borrar.
   *
   * El 13-ago la bandeja salió vacía en producción mientras el MISMO filtro,
   * corrido contra los MISMOS datos en local, devolvía una reunión. Sin ver
   * dónde se cae, eso son horas de adivinar entre la fecha, el token y el
   * proyecto. Contar en cada escalón cuesta nada y responde la pregunta de una.
   *
   * Es la regla de la casa: cuando la deducción falla, se mide.
   */
  const diag: Record<string, unknown> = {
    recibidasDeParalelo: Array.isArray(reuniones) ? reuniones.length : 0,
    reportesRecibidos: Array.isArray(reportes) ? reportes.length : 0,
    // Qué proyectos ve ESTA llave. Si el nuestro no está, el problema es el
    // token (otra cuenta), no el filtro.
    proyectosVisibles: [
      ...new Set((Array.isArray(reuniones) ? reuniones : []).map((m) => m.project_id)),
    ].slice(0, 20),
  };

  const paso1 = (Array.isArray(reuniones) ? reuniones : []).filter((m) => m.project_id === projectId);
  diag.trasProyecto = paso1.length;
  const paso2 = paso1.filter((m) => m.status === 'completed');
  diag.trasCompleted = paso2.length;

  const items = paso2
    // Se compara contra la fecha REAL de la reunión, no contra cuándo Paralelo
    // la cargó: el histórico anterior al arranque no entra nunca.
    .filter((m) => String(m.actual_start_time || m.scheduled_start_time || '').slice(0, 10) >= desde)
    .map((m) => {
      const titulo = limpiarTituloParalelo(m.name);
      const inicio = m.actual_start_time || m.scheduled_start_time;
      const report = reportePorReunion.get(m.id) ?? null;
      const actionItems = Array.isArray(report?.actionItems) ? report!.actionItems! : [];

      return {
        externalId: externalIdReunionParalelo(m.id),
        paraleloId: m.id,
        titulo,
        cliente: proyecto.cliente,
        fecha: inicio,
        duracionMin: minutosEntre(m.actual_start_time, m.actual_end_time),
        tieneReporte: !!report,
        resumen: textoDe(report?.executiveSummary),
        tareas: actionItems
          .map((a) => ({
            externalId: externalIdTareaParalelo(m.id, String(a.task ?? '')),
            titulo: String(a.task ?? '').trim(),
            responsables: normalizarResponsables(a.assignedTo),
            prioridad: mapearPrioridad(a.priority),
            /**
             * DECISIÓN (founder, 13-ago): la fecha de entrega NO sale de aquí.
             * Sale de nuestro SLA (`TASK_SLA_DAYS`) contado desde la reunión.
             *
             * El `dueDate` de Paralelo no es una fecha, es prosa: "ASAP",
             * "Antes de la fase evergreen", "A partir del regreso de Bala".
             * Interpretarlo sería inventar, y una fecha inventada mete tareas
             * falsas en "atrasadas" y ensucia el cumplimiento del equipo.
             *
             * El texto original SÍ viaja, para guardarlo en la descripción de
             * la tarea: "antes de la etapa de captación" dice más que una fecha.
             */
            plazoTexto: limpiarNoEspecificado(a.dueDate),
            dependencias: limpiarNoEspecificado(a.dependencies),
          }))
          .filter((t) => t.titulo.length > 0),
      };
    })
    .filter((m) => !esReunionDePrueba(m.titulo))
    // Más recientes primero: es por donde se quiere empezar a importar.
    .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));

  diag.desdeCalculado = desde;
  diag.hoyServidor = new Date().toISOString().slice(0, 10);
  diag.trasFechaYBasura = items.length;

  return json({
    cliente: proyecto.cliente,
    projectId,
    total: items.length,
    reuniones: items,
    diagnostico: diag,
  });
}

/* ── Ayudas ─────────────────────────────────────────────────────────────────*/

/** Paralelo usa "No especificado" como vacío. Aquí eso es undefined. */
function limpiarNoEspecificado(v: unknown): string | undefined {
  const s = String(v ?? '').trim();
  if (!s || /^no especificado$/i.test(s) || /^n\/a$/i.test(s)) return undefined;
  return s;
}

/**
 * `assignedTo` llega como array de nombres, a veces como texto suelto — y casi
 * siempre sucio, porque sale de una transcripción con diarización:
 *   "André (Speaker B)", "Andrés (Speaker A)", "Bala (David F)", "Camilo (diseñador)"
 * La misma persona aparece con tres etiquetas distintas. Se quita el paréntesis
 * para que "Andrés (Speaker A)" y "Andrés" sean la misma persona; el apodo entre
 * paréntesis se pierde, que es preferible a tener tres responsables fantasma.
 * El emparejamiento fino contra el equipo real lo hace el frontend, que sí tiene
 * cargada la lista de miembros.
 */
function normalizarResponsables(v: ActionItemParalelo['assignedTo']): string[] {
  const crudos = Array.isArray(v) ? v.map(String) : String(v ?? '').trim() ? [String(v)] : [];
  const limpios = crudos.map(limpiarNombreParalelo).filter(Boolean);
  // El emparejamiento contra el equipo real (alias incluidos) lo hace el
  // frontend, que sí tiene cargada la lista de miembros.
  return [...new Set(limpios)];
}

/** High/Medium/Low de Paralelo → P1/P2/P3 nuestro. Sin dato = P2. */
function mapearPrioridad(v: unknown): 'P1' | 'P2' | 'P3' {
  const s = String(v ?? '').toLowerCase();
  if (s.startsWith('high') || s.startsWith('alt')) return 'P1';
  if (s.startsWith('low') || s.startsWith('baj')) return 'P3';
  return 'P2';
}

/** `executiveSummary` a veces es texto, a veces lista de puntos. */
function textoDe(v: unknown): string | undefined {
  if (Array.isArray(v)) return v.map((x) => String(x)).join('\n') || undefined;
  const s = String(v ?? '').trim();
  return s || undefined;
}

function minutosEntre(a: string | null, b: string | null): number {
  if (!a || !b) return 60;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 60;
  return Math.max(1, Math.round(ms / 60000));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
