/**
 * Importar reuniones de Paralelo (Meetico) — lado navegador.
 *
 * El endpoint `/api/paralelo/reuniones` ya devuelve las reuniones filtradas y
 * traducidas (ver `api/paralelo/reuniones.ts`). Aquí se hacen las dos cosas que
 * el servidor NO puede hacer:
 *
 *   1. Saber qué se importó ya. El servidor no consulta nuestra base — quien
 *      tiene las reuniones cargadas es el store. El cruce se hace por
 *      `externalId`, en memoria.
 *   2. ESCRIBIR. A propósito: al escribir desde aquí se usa la sesión del
 *      usuario y se pasa por RLS como cualquier otra creación. Si el endpoint
 *      escribiera con la service key, se saltaría los permisos y una reunión
 *      privada o de otra agencia podría acabar donde no debe.
 */

import type { Meeting } from '@/types/meeting';
import type { Task } from '@/types/task';
import { supabase } from './supabase';
import { MeetingsRepo } from './repositories';
import { useClientStore } from '@/store/useClientStore';
import { teamMembersForClient } from '@/store/useTeamMembersStore';
import { resolverResponsableParalelo } from '@/config/paralelo';
import { TASK_SLA_DAYS } from '@/config/taskSLA';
import { genId } from '@/utils/id';
import { useRopreStore } from '@/store/useRopreStore';
import type { RopreItem } from '@/types/ropre';

/** Una tarea tal como la manda el endpoint. */
export interface TareaParalelo {
  externalId: string;
  titulo: string;
  responsables: string[];
  prioridad: 'P1' | 'P2' | 'P3';
  /** El `dueDate` de Paralelo tal cual: es prosa, no fecha. Va a la descripción. */
  plazoTexto?: string;
  dependencias?: string;
}

/** Una reunión tal como la manda el endpoint. */
export interface ReunionParalelo {
  externalId: string;
  paraleloId: string;
  titulo: string;
  cliente: string;
  fecha: string | null;
  duracionMin: number;
  tieneReporte: boolean;
  resumen?: string;
  tareas: TareaParalelo[];

  /* ── Secciones ricas del reporte (ver el endpoint) ─────────────────────── */
  objetivos?: { declarado?: string; logrado?: string };
  decisiones?: Array<{ tema: string; resumen: string }>;
  riesgos?: Array<{ riesgo: string; mitigacion?: string }>;
  bloqueos?: Array<{ asunto: string; estado?: string; proximoPaso?: string }>;
  proximosPasos?: { proximaReunion?: string; puntosDeRevision?: string; hitos?: string[] };
  recursos?: { presupuesto?: string; personas?: string; herramientas?: string };
}

export interface ReunionParaleloConEstado extends ReunionParalelo {
  /** true si ya existe en Project360 (mismo `externalId`). No se vuelve a traer. */
  yaImportada: boolean;
}

/** Conteo por escalón del filtro. Lo manda el endpoint; se muestra si algo no cuadra. */
export type DiagnosticoParalelo = Record<string, unknown>;

export interface RespuestaParalelo {
  reuniones: ReunionParaleloConEstado[];
  diagnostico?: DiagnosticoParalelo;
}

/**
 * Trae de Paralelo lo que hay para este proyecto y marca lo ya importado.
 *
 * Lo ya importado NO se esconde: se muestra desactivado. Una bandeja que oculta
 * lo procesado deja a quien mira sin forma de saber si una reunión no está
 * porque ya entró o porque nunca llegó — y esa duda es la que hace que alguien
 * la cree a mano y termine duplicada.
 */
export async function traerReunionesParalelo(projectId: string): Promise<RespuestaParalelo> {
  if (!supabase) throw new Error('Sin conexión a Supabase.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo.');

  const res = await fetch(`/api/paralelo/reuniones?projectId=${encodeURIComponent(projectId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await res.json().catch(() => ({}))) as {
    reuniones?: ReunionParalelo[];
    diagnostico?: DiagnosticoParalelo;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || 'No se pudieron traer las reuniones de Paralelo.');

  const yaEstan = new Set(
    useClientStore
      .getState()
      .meetings.map((m) => m.externalId)
      .filter(Boolean) as string[],
  );

  return {
    reuniones: (data.reuniones ?? []).map((r) => ({ ...r, yaImportada: yaEstan.has(r.externalId) })),
    diagnostico: data.diagnostico,
  };
}

/**
 * Quién queda como responsable de una tarea de Paralelo.
 *
 * FUENTE ÚNICA — la usan la bandeja (para previsualizar) y la importación (para
 * escribir). Estuvieron separadas y la bandeja mostraba el nombre CRUDO
 * mientras la importación guardaba el resuelto: revisabas "Mari Cruz" y en la
 * tarea aparecía "Marisol Ochoa". Una previsualización que no coincide con el
 * resultado no sirve para revisar, que es lo único para lo que existe.
 *
 * Es el mismo fallo de los dos traductores de fila del 11-ago: dos copias de la
 * misma lógica se separan, y la que nadie mira se queda atrás.
 */
export function responsableDeTarea(t: TareaParalelo, nombresEquipo: string[]): string {
  return t.responsables.length
    ? resolverResponsableParalelo(t.responsables[0], nombresEquipo)
    : 'Sin asignar';
}

/** Nombres del equipo de un cliente, para resolver responsables. */
export const nombresEquipoDe = (clientId: string): string[] =>
  teamMembersForClient(clientId).map((m) => m.nombre);

export interface ResultadoImportacion {
  reunionesCreadas: number;
  tareasCreadas: number;
  /** Riesgos y bloqueos que pasaron al ROPRE del cliente. */
  ropreCreados: number;
  /** Reuniones que no se pudieron guardar, con el porqué. */
  fallos: Array<{ titulo: string; motivo: string }>;
}

/**
 * Importa las reuniones seleccionadas al cliente indicado.
 *
 * Cada reunión entra como `completed` (Paralelo solo entrega las que ya
 * ocurrieron y tienen reporte) y sus compromisos entran como tareas normales
 * con `origen: 'reunion'` — no como un tipo aparte. Para el equipo son tareas
 * como cualquier otra; lo único que las distingue es su `externalId`.
 */
export async function importarReunionesParalelo(
  clientId: string,
  seleccionadas: ReunionParalelo[],
): Promise<ResultadoImportacion> {
  const store = useClientStore.getState();
  const nombresEquipo = nombresEquipoDe(clientId);

  const out: ResultadoImportacion = { reunionesCreadas: 0, tareasCreadas: 0, ropreCreados: 0, fallos: [] };

  for (const r of seleccionadas) {
    const fechaISO = r.fecha ?? new Date().toISOString();
    const meetingId = genId();

    const meeting: Meeting = {
      id: meetingId,
      clientId,
      title: r.titulo,
      // 'general' y no un tipo específico: adivinar el tipo desde el título
      // sería inventar. Quien la revise lo cambia en un clic si hace falta.
      type: 'general',
      scheduledAt: fechaISO,
      durationMin: r.duracionMin,
      participants: [],
      summary: resumenDeReunion(r),
      completed: true,
      origen: 'paralelo',
      externalId: r.externalId,
    };

    // La reunión se guarda PRIMERO y esperando. `addMeeting` del store es
    // optimista (pinta y guarda en segundo plano), y aquí eso no sirve: si la
    // reunión falla, sus tareas quedarían colgando de algo que no existe, y el
    // resumen diría "importadas 5" sin que se haya guardado ninguna.
    try {
      await MeetingsRepo.create(meeting);
    } catch (e) {
      out.fallos.push({ titulo: r.titulo, motivo: (e as Error).message });
      continue;
    }
    // Ya está en la base: solo falta que se vea sin recargar.
    useClientStore.setState((s) => ({ meetings: [meeting, ...s.meetings] }));
    out.reunionesCreadas += 1;

    for (const t of r.tareas) {
      const responsable = responsableDeTarea(t, nombresEquipo);

      const task: Task = {
        id: genId(),
        clientId,
        title: t.titulo,
        description: descripcionDeTarea(t),
        // Lo que la tarea necesita para poder empezar. Paralelo lo entrega como
        // `dependencies` y antes se enterraba en la descripción; `input` es el
        // campo que existe para esto y ya se ve en la tarjeta (chip IN).
        input: t.dependencias,
        status: 'pending',
        priority: t.prioridad,
        assignedTo: responsable,
        // La fecha sale de NUESTRO SLA contado desde la reunión, no del
        // `dueDate` de Paralelo (que es prosa). Ver la decisión en
        // `src/config/paralelo.ts`.
        dueDate: sumarDias(fechaISO, TASK_SLA_DAYS.meeting),
        isDelayed: false,
        delayDays: 0,
        tag: 'meeting',
        origen: 'reunion',
        meetingId,
        meetingNombre: r.titulo,
        meetingFecha: fechaISO,
        externalId: t.externalId,
        createdAt: new Date().toISOString(),
      };

      const ok = await store.addTask(task);
      if (ok) out.tareasCreadas += 1;
    }

    out.ropreCreados += volcarAlRopre(clientId, r);
  }

  return out;
}

/**
 * Riesgos y bloqueos de la reunión → items de ROPRE.
 *
 * Paralelo entrega el riesgo YA emparejado con su mitigación, que es
 * exactamente la forma de un item ROPRE de tipo `risk`. Hasta ahora eso se
 * escribía a mano leyendo el acta, o —más frecuente— no se escribía.
 *
 * Los bloqueos entran también como `risk`: un bloqueo es un riesgo que ya se
 * materializó. Su estado y próximo paso van a la descripción para no perderlos.
 *
 * Nivel `medium` a propósito: Paralelo no gradúa la severidad, y ponerlo todo
 * en `high` haría que el módulo grite por todo y se acabe ignorando.
 */
function volcarAlRopre(clientId: string, r: ReunionParalelo): number {
  const items: RopreItem[] = [];
  const ahora = new Date().toISOString();

  for (const x of r.riesgos ?? []) {
    items.push({
      id: genId(),
      clientId,
      type: 'risk',
      title: x.riesgo,
      description: `Detectado en la reunión "${r.titulo}".`,
      riskLevel: 'medium',
      mitigation: x.mitigacion,
      createdAt: ahora,
    });
  }

  for (const b of r.bloqueos ?? []) {
    items.push({
      id: genId(),
      clientId,
      type: 'risk',
      title: b.asunto,
      description: [
        `Bloqueo detectado en la reunión "${r.titulo}".`,
        b.estado && `Estado: ${b.estado}`,
        b.proximoPaso && `Próximo paso: ${b.proximoPaso}`,
      ]
        .filter(Boolean)
        .join('\n'),
      riskLevel: 'medium',
      createdAt: ahora,
    });
  }

  const add = useRopreStore.getState().add;
  items.forEach(add);
  return items.length;
}

/**
 * El resumen de la reunión, compuesto con las secciones del reporte.
 *
 * Antes solo se guardaba `executiveSummary` y se perdían las decisiones —que es
 * lo que de verdad se busca al releer un acta— junto con los objetivos y los
 * próximos pasos. Van todas al mismo campo, con títulos, porque es el texto que
 * ya lee el reporte ejecutivo en PDF.
 */
function resumenDeReunion(r: ReunionParalelo): string | undefined {
  const bloques: string[] = [];
  if (r.resumen) bloques.push(r.resumen);

  if (r.objetivos?.declarado || r.objetivos?.logrado) {
    bloques.push(
      ['OBJETIVOS', r.objetivos.declarado && `Buscado: ${r.objetivos.declarado}`, r.objetivos.logrado && `Logrado: ${r.objetivos.logrado}`]
        .filter(Boolean)
        .join('\n'),
    );
  }

  if (r.decisiones?.length) {
    bloques.push(
      ['DECISIONES Y PUNTOS TRATADOS', ...r.decisiones.map((d) => `• ${d.tema}: ${d.resumen}`)].join('\n'),
    );
  }

  if (r.proximosPasos) {
    const p = r.proximosPasos;
    const lineas = [
      p.proximaReunion && `Próxima reunión: ${p.proximaReunion}`,
      p.puntosDeRevision && `A revisar: ${p.puntosDeRevision}`,
      ...(p.hitos ?? []).map((h) => `• Hito: ${h}`),
    ].filter(Boolean);
    if (lineas.length) bloques.push(['PRÓXIMOS PASOS', ...lineas].join('\n'));
  }

  if (r.recursos) {
    const c = r.recursos;
    const lineas = [
      c.personas && `Personas: ${c.personas}`,
      c.herramientas && `Herramientas: ${c.herramientas}`,
      c.presupuesto && `Presupuesto: ${c.presupuesto}`,
    ].filter(Boolean);
    if (lineas.length) bloques.push(['RECURSOS QUE HACEN FALTA', ...lineas].join('\n'));
  }

  return bloques.length ? bloques.join('\n\n') : undefined;
}

/**
 * El plazo y las dependencias que dijo Paralelo van al texto de la tarea.
 * "antes de la etapa de captación" es información real que se perdería si solo
 * se guardara la fecha calculada.
 */
function descripcionDeTarea(t: TareaParalelo): string | undefined {
  const lineas: string[] = [];
  if (t.plazoTexto) lineas.push(`Plazo según la reunión: ${t.plazoTexto}`);
  // `dependencias` ya NO se repite aquí: vive en `input`, que es su campo.
  if (t.responsables.length > 1) {
    lineas.push(`También mencionados: ${t.responsables.slice(1).join(', ')}`);
  }
  return lineas.length ? lineas.join('\n') : undefined;
}

function sumarDias(desdeISO: string, dias: number): string {
  const d = new Date(desdeISO);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
