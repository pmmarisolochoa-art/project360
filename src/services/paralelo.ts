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

export interface ResultadoImportacion {
  reunionesCreadas: number;
  tareasCreadas: number;
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
  const nombresEquipo = teamMembersForClient(clientId).map((m) => m.nombre);

  const out: ResultadoImportacion = { reunionesCreadas: 0, tareasCreadas: 0, fallos: [] };

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
      summary: r.resumen,
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
      const responsable = t.responsables.length
        ? resolverResponsableParalelo(t.responsables[0], nombresEquipo)
        : 'Sin asignar';

      const task: Task = {
        id: genId(),
        clientId,
        title: t.titulo,
        description: descripcionDeTarea(t),
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
  }

  return out;
}

/**
 * El plazo y las dependencias que dijo Paralelo van al texto de la tarea.
 * "antes de la etapa de captación" es información real que se perdería si solo
 * se guardara la fecha calculada.
 */
function descripcionDeTarea(t: TareaParalelo): string | undefined {
  const lineas: string[] = [];
  if (t.plazoTexto) lineas.push(`Plazo según la reunión: ${t.plazoTexto}`);
  if (t.dependencias) lineas.push(`Depende de: ${t.dependencias}`);
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
