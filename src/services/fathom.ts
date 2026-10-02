/**
 * Importar reuniones de Fathom — lado navegador.
 *
 * Mismo reparto de responsabilidades que `services/paralelo.ts`: el endpoint
 * `/api/fathom/reuniones` trae y traduce; aquí se cruza contra lo ya importado
 * (por `externalId`, en memoria) y se ESCRIBE con la sesión del usuario, para
 * pasar por RLS como cualquier otra creación.
 */

import type { Meeting } from '@/types/meeting';
import type { Task } from '@/types/task';
import { supabase } from './supabase';
import { MeetingsRepo } from './repositories';
import { useClientStore } from '@/store/useClientStore';
import { TASK_SLA_DAYS } from '@/config/taskSLA';
import { genId } from '@/utils/id';

export interface TareaFathom {
  externalId: string;
  titulo: string;
  responsableCrudo?: string;
  /** Ya resuelto contra el equipo real por el servidor. */
  responsable: string;
}

export interface ReunionFathom {
  externalId: string;
  fathomId: number;
  titulo: string;
  cliente: string;
  fecha: string | null;
  duracionMin: number;
  url?: string;
  resumen?: string;
  tareas: TareaFathom[];
}

export interface ReunionFathomConEstado extends ReunionFathom {
  yaImportada: boolean;
}

export type DiagnosticoFathom = Record<string, unknown>;

export interface RespuestaFathom {
  reuniones: ReunionFathomConEstado[];
  diagnostico?: DiagnosticoFathom;
}

/** Trae de Fathom lo que hay para este cliente y marca lo ya importado. */
export async function traerReunionesFathom(clienteNombre: string): Promise<RespuestaFathom> {
  if (!supabase) throw new Error('Sin conexión a Supabase.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo.');

  const res = await fetch(`/api/fathom/reuniones?cliente=${encodeURIComponent(clienteNombre)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await res.json().catch(() => ({}))) as {
    reuniones?: ReunionFathom[];
    diagnostico?: DiagnosticoFathom;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || 'No se pudieron traer las reuniones de Fathom.');

  const yaEstan = new Set(
    useClientStore.getState().meetings.map((m) => m.externalId).filter(Boolean) as string[],
  );

  return {
    reuniones: (data.reuniones ?? []).map((r) => ({ ...r, yaImportada: yaEstan.has(r.externalId) })),
    diagnostico: data.diagnostico,
  };
}

export interface ResultadoImportacionFathom {
  reunionesCreadas: number;
  tareasCreadas: number;
  fallos: Array<{ titulo: string; motivo: string }>;
}

/**
 * Importa las reuniones seleccionadas al cliente indicado. Cada reunión entra
 * `completed` (Fathom solo graba lo ya ocurrido) y sus action items como
 * tareas normales con `origen: 'reunion'`.
 */
export async function importarReunionesFathom(
  clientId: string,
  seleccionadas: ReunionFathom[],
): Promise<ResultadoImportacionFathom> {
  const store = useClientStore.getState();
  const out: ResultadoImportacionFathom = { reunionesCreadas: 0, tareasCreadas: 0, fallos: [] };

  for (const r of seleccionadas) {
    const fechaISO = r.fecha ?? new Date().toISOString();
    const meetingId = genId();

    const meeting: Meeting = {
      id: meetingId,
      clientId,
      title: r.titulo,
      type: 'general',
      scheduledAt: fechaISO,
      durationMin: r.duracionMin,
      participants: [],
      summary: r.resumen,
      recordingUrl: r.url,
      completed: true,
      origen: 'fathom',
      externalId: r.externalId,
    };

    try {
      await MeetingsRepo.create(meeting);
    } catch (e) {
      out.fallos.push({ titulo: r.titulo, motivo: (e as Error).message });
      continue;
    }
    useClientStore.setState((s) => ({ meetings: [meeting, ...s.meetings] }));
    out.reunionesCreadas += 1;

    for (const t of r.tareas) {
      const task: Task = {
        id: genId(),
        clientId,
        title: t.titulo,
        status: 'pending',
        priority: 'P2',
        assignedTo: t.responsable || 'Sin asignar',
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

function sumarDias(desdeISO: string, dias: number): string {
  const d = new Date(desdeISO);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
