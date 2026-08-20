/**
 * Reporte de la Daily — plantilla 1 de Ikigai.
 *
 * LA IDEA DE FONDO, y es lo que lo diferencia del reporte genérico que ya
 * existía: el reporte se parte en dos mitades con reglas distintas.
 *
 *   HECHOS  (secciones 3 y 4) — salen de las tareas de Project360. Cuántas
 *           vencidas, quién las tiene, cuántas se cerraron desde la daily
 *           anterior, cuáles nacieron hoy. Aquí la IA no pinta nada: son datos
 *           que ya están en la base y contarlos mal sería imperdonable.
 *
 *   LECTURA (secciones 1, 2, 5 y 6) — salen de lo que se dijo en la reunión, y
 *           eso solo está en las notas y el resumen. Ahí sí interpreta la IA,
 *           con la instrucción de no inventar: lo que no se mencionó se marca
 *           como no mencionado.
 *
 * Mezclar las dos mitades era lo que hacía flojo el reporte anterior: le pedía
 * a la IA "los KPIs" y ella los sacaba del texto, cuando la mitad estaban en la
 * base y se podían contar.
 */

import { differenceInCalendarDays, isAfter, parseISO, subDays } from 'date-fns';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import type { Task } from '@/types/task';
import { useClientStore } from '@/store/useClientStore';
import { AREAS_DAILY, VENTANA_DAILY_ANTERIOR_DIAS, esDaily } from '@/config/reporteDaily';
import { generateDailyReport, type DailyReportIA } from '@/services/claudeApi';

export { esDaily };

/* ── Lo que se entrega ──────────────────────────────────────────────────────*/

export interface FilaSeguimiento {
  titulo: string;
  responsable: string;
  fechaLimite: string;
  estado: 'completada' | 'en_progreso' | 'vencida' | 'pendiente';
  diasAtraso: number;
}

export interface ReporteDaily {
  /* Metadatos */
  fecha: string;
  diaSemana: string;
  duracionMin: number;
  participantes: string[];

  /* HECHOS */
  seguimiento: FilaSeguimiento[];
  vencidas: number;
  nuevas: FilaSeguimiento[];
  /** La daily anterior contra la que se compara. Null si es la primera. */
  dailyAnterior: { titulo: string; fecha: string } | null;

  /* LECTURA (IA) */
  estadoEquipo: DailyReportIA['estadoEquipo'];
  prioridades: DailyReportIA['prioridades'];
  alertas: string[];
  pulso: string;
}

/* ── Construcción ──────────────────────────────────────────────────────────*/

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export async function construirReporteDaily(
  client: Client,
  meeting: Meeting,
): Promise<ReporteDaily> {
  const ahora = new Date();
  const fechaReunion = parseISO(meeting.scheduledAt);
  const todasLasTareas = useClientStore.getState().tasks.filter((t) => t.clientId === client.id);

  /**
   * La daily anterior: la más reciente ANTES de esta, dentro de la ventana.
   * Sin ventana, una daily después de vacaciones compararía contra algo de hace
   * dos meses y el seguimiento no diría nada útil.
   */
  const dailyAnterior = useClientStore
    .getState()
    .meetings.filter(
      (m) =>
        m.clientId === client.id &&
        m.id !== meeting.id &&
        esDaily(client, m) &&
        isAfter(parseISO(m.scheduledAt), subDays(fechaReunion, VENTANA_DAILY_ANTERIOR_DIAS)) &&
        !isAfter(parseISO(m.scheduledAt), fechaReunion),
    )
    .sort((a, b) => +parseISO(b.scheduledAt) - +parseISO(a.scheduledAt))[0] ?? null;

  const seguimiento = dailyAnterior
    ? todasLasTareas.filter((t) => t.meetingId === dailyAnterior.id).map((t) => aFila(t, ahora))
    : [];

  const nuevas = todasLasTareas.filter((t) => t.meetingId === meeting.id).map((t) => aFila(t, ahora));

  const vencidas = seguimiento.filter((f) => f.estado === 'vencida').length;

  /**
   * A la IA se le dan los HECHOS ya contados, no para que los repita sino para
   * que el pulso sea coherente con ellos: un pulso que dice "todo tranquilo"
   * con 5 tareas vencidas encima es peor que no tener pulso.
   */
  const lectura = await generateDailyReport({
    titulo: meeting.title,
    fecha: meeting.scheduledAt,
    areas: AREAS_DAILY,
    notas: meeting.notes,
    resumen: meeting.summary,
    agenda: meeting.agenda,
    hechos: {
      vencidas,
      seguimiento: seguimiento.length,
      nuevas: nuevas.length,
      completadas: seguimiento.filter((f) => f.estado === 'completada').length,
    },
  });

  return {
    fecha: meeting.scheduledAt,
    diaSemana: DIAS[fechaReunion.getDay()],
    duracionMin: meeting.durationMin ?? 0,
    participantes: (meeting.participants ?? []).map((p) => p.name).filter(Boolean),
    seguimiento,
    vencidas,
    nuevas,
    dailyAnterior: dailyAnterior
      ? { titulo: dailyAnterior.title, fecha: dailyAnterior.scheduledAt }
      : null,
    estadoEquipo: lectura.estadoEquipo,
    prioridades: lectura.prioridades,
    alertas: lectura.alertas,
    pulso: lectura.pulso,
  };
}

/**
 * Estado real de una tarea. `vencida` gana a `pendiente`: si pasó su fecha y no
 * está cerrada, lo que importa es el atraso, no en qué columna esté.
 */
function aFila(t: Task, ahora: Date): FilaSeguimiento {
  const vence = t.dueDate ? parseISO(t.dueDate) : null;
  const atraso = vence && t.status !== 'completed' ? differenceInCalendarDays(ahora, vence) : 0;

  const estado: FilaSeguimiento['estado'] =
    t.status === 'completed'
      ? 'completada'
      : atraso > 0
        ? 'vencida'
        : t.status === 'in_progress' || t.status === 'in_review'
          ? 'en_progreso'
          : 'pendiente';

  return {
    titulo: t.title,
    responsable: t.assignedTo || 'Sin asignar',
    fechaLimite: t.dueDate ?? '',
    estado,
    diasAtraso: Math.max(0, atraso),
  };
}

/**
 * La línea de alerta de la sección 3, tal como la pide la plantilla.
 * Se calcula aquí y no en la IA porque es un conteo, no una opinión.
 */
export const lineaDeAlerta = (vencidas: number): string | null =>
  vencidas > 0
    ? `${vencidas} tarea${vencidas === 1 ? '' : 's'} vencida${vencidas === 1 ? '' : 's'} sin resolver — requiere${vencidas === 1 ? '' : 'n'} atención.`
    : null;
