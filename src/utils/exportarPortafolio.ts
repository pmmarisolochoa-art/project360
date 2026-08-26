/**
 * Exportar el portafolio a un archivo para enviarlo fuera de Project360.
 *
 * Lógica pura a propósito: aquí se decide QUÉ sale y con qué forma, y eso se
 * puede probar sin navegador (`pruebas/exportar-portafolio.mjs`). La descarga
 * del archivo vive en el modal.
 *
 * LO QUE NUNCA SALE, y no es negociable:
 *   - Nada marcado como privado (`esPrivada`), ni tareas ni reuniones. Lo
 *     privado es privado también cuando alguien exporta (migración 030).
 *   - Transcripciones, notas y resúmenes de reuniones. Es la misma línea que
 *     ya traza la API pública: la agenda dice QUE hubo una reunión, no lo que
 *     se dijo dentro.
 * Las dos exclusiones están cubiertas por pruebas para que nadie las levante
 * sin querer al añadir una columna.
 */
import type { Client, ClientStatus, ProjectType } from '@/types/client';
import type { Task, TaskStatus } from '@/types/task';
import type { Meeting, MeetingType } from '@/types/meeting';
import type { TaskLink } from '@/services/taskLinks';

/** Una tabla lista para volcarse a CSV o a una hoja de Excel. */
export interface Tabla {
  /** Nombre del archivo (sin extensión) y de la hoja de Excel. */
  nombre: string;
  columnas: string[];
  filas: Array<Array<string | number>>;
}

export type ClaveTabla = 'clientes' | 'tareas' | 'reuniones' | 'entregables';

export const TABLAS_LABEL: Record<ClaveTabla, string> = {
  clientes: 'Clientes',
  tareas: 'Tareas',
  reuniones: 'Agenda',
  entregables: 'Entregables',
};

// ─────────────────────────── etiquetas ───────────────────────────
// En español, que es como se lee la app. Quien recibe el archivo no sabe qué
// es `in_review` ni tiene por qué averiguarlo.

const ESTADO_CLIENTE: Record<ClientStatus, string> = {
  onboarding: 'Onboarding',
  planning: 'Planificación',
  active: 'Activo',
  paused: 'En pausa',
  completed: 'Completado',
};

const TIPO_PROYECTO: Record<ProjectType, string> = {
  ecommerce: 'E-commerce',
  launch: 'Lanzamiento',
  evergreen: 'Evergreen',
  personal_brand: 'Marca personal',
  other: 'Otro',
};

const ESTADO_TAREA: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  in_review: 'En revisión',
  completed: 'Completada',
  blocked: 'Bloqueada',
};

const TIPO_REUNION: Record<MeetingType, string> = {
  kickoff: 'Kickoff',
  weekly_metrics: 'Métricas semanal',
  content_strategy: 'Estrategia de contenido',
  ads_review: 'Revisión de ADS',
  monthly_closing: 'Cierre mensual',
  crisis: 'Crisis',
  weekly_planning: 'Planeación semanal',
  ropre_strategy: 'Estrategia ROPRE',
  weekly_closing: 'Cierre de semana',
  general: 'General',
  management: 'Gerencia',
};

const ESTADO_ENTREGABLE: Record<string, string> = {
  pendiente: 'Pendiente revisión',
  aprobado: 'Aprobado',
  correcciones: 'Con correcciones',
};

const si = (v: boolean | undefined) => (v ? 'Sí' : 'No');

/** ISO → `2026-08-26`. Sin hora: para una hoja de cálculo la hora estorba. */
function fecha(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** ISO → `2026-08-26 14:30`. Solo donde la hora significa algo (una reunión). */
function fechaHora(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

// ─────────────────────────── las cuatro tablas ───────────────────────────

/**
 * Una fila por cliente, con el pulso de su operación: cuántas tareas tiene
 * abiertas, cuántas vencidas y qué porcentaje lleva.
 *
 * Los conteos se CUENTAN aquí desde las tareas, no se leen de
 * `client.metrics`, que es una foto vieja que solo se refresca en algunos
 * caminos. Un número exportado que no cuadra con la pantalla es peor que no
 * exportarlo.
 */
export function tablaClientes(clients: Client[], tasks: Task[]): Tabla {
  const visibles = tasks.filter((t) => !t.esPrivada);
  const hoy = new Date().toISOString().slice(0, 10);

  return {
    nombre: 'Clientes',
    columnas: [
      'Cliente', 'Sigla', 'Industria', 'Tipo de negocio', 'Estado', 'Tipo de proyecto',
      'Es espacio interno', 'Tareas totales', 'Tareas pendientes', 'Tareas vencidas',
      'Avance %', 'Presupuesto ads mensual', 'País', 'Ciudad', 'Contacto', 'Email',
      'WhatsApp', 'Sitio web', 'Creado',
    ],
    filas: clients.map((c) => {
      const suyas = visibles.filter((t) => t.clientId === c.id);
      const completadas = suyas.filter((t) => t.status === 'completed').length;
      const pendientes = suyas.filter((t) => t.status !== 'completed');
      const vencidas = pendientes.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < hoy).length;
      const id = c.onboardingData?.identity;
      return [
        c.name,
        c.sigla ?? '',
        c.industry,
        c.businessType,
        ESTADO_CLIENTE[c.status] ?? c.status,
        TIPO_PROYECTO[c.projectType] ?? c.projectType,
        si(c.isAgency),
        suyas.length,
        pendientes.length,
        vencidas,
        suyas.length ? Math.round((completadas / suyas.length) * 100) : 0,
        c.monthlyAdsBudget ?? 0,
        id?.country ?? '',
        id?.city ?? '',
        id?.founderName ?? '',
        id?.email ?? '',
        id?.whatsapp ?? '',
        id?.website ?? '',
        fecha(c.createdAt),
      ];
    }),
  };
}

/**
 * Una fila por tarea. `resolverResponsable` se recibe de fuera en vez de
 * importar el store: mantiene este archivo probable, y sobre todo evita una
 * SEGUNDA función que traduzca responsables — el fallo de los dos traductores
 * ya costó media semana. Quien llama pasa la de siempre (`resolveAssignee`).
 */
export function tablaTareas(
  tasks: Task[],
  clients: Client[],
  resolverResponsable: (assignedTo: string, clientId: string) => string,
): Tabla {
  const nombreCliente = new Map(clients.map((c) => [c.id, c.name]));
  const hoy = new Date().toISOString().slice(0, 10);

  return {
    nombre: 'Tareas',
    columnas: [
      'Cliente', 'Tarea', 'Responsable', 'Estado', 'Prioridad', 'Etiqueta',
      'Fecha de entrega', 'Vencida', 'Días de atraso', 'Completada el',
      'KPI', 'Meta', 'Resultado', 'Entregable (link)', 'Origen', 'Reunión de origen', 'Creada',
    ],
    // Lo privado no sale. Nunca. Es la primera línea del filtro para que se
    // vea al leer, y está cubierta por una prueba.
    filas: tasks
      .filter((t) => !t.esPrivada)
      .map((t) => {
        const vencida = t.status !== 'completed' && !!t.dueDate && t.dueDate.slice(0, 10) < hoy;
        return [
          nombreCliente.get(t.clientId) ?? '(cliente no encontrado)',
          t.title,
          resolverResponsable(t.assignedTo, t.clientId),
          ESTADO_TAREA[t.status] ?? t.status,
          t.priority,
          t.tag ?? '',
          fecha(t.dueDate),
          si(vencida),
          vencida ? diasEntre(t.dueDate, hoy) : 0,
          fecha(t.completedAt),
          t.kpiNombre ?? '',
          t.kpiMeta ?? '',
          t.kpiResultado ?? '',
          t.driveLink ?? '',
          t.origen ?? 'manual',
          t.meetingNombre ?? '',
          fecha(t.createdAt),
        ];
      }),
  };
}

/**
 * Una fila por reunión. Sale QUE hubo reunión, con quién y de qué tipo —
 * nunca la transcripción, las notas ni el resumen. Esa es la misma línea que
 * traza la API pública, y por el mismo motivo: una agenda se comparte, lo que
 * se dijo dentro no.
 */
export function tablaReuniones(meetings: Meeting[], clients: Client[]): Tabla {
  const nombreCliente = new Map(clients.map((c) => [c.id, c.name]));
  return {
    nombre: 'Agenda',
    columnas: [
      'Cliente', 'Reunión', 'Tipo', 'Fecha y hora', 'Duración (min)',
      'Participantes', 'Realizada', 'Origen',
    ],
    filas: meetings
      .filter((m) => !m.esPrivada)
      .map((m) => [
        nombreCliente.get(m.clientId) ?? '(cliente no encontrado)',
        m.title,
        TIPO_REUNION[m.type] ?? m.type,
        fechaHora(m.scheduledAt),
        m.durationMin ?? 0,
        (m.participants ?? []).map((p) => p.name).join(', '),
        si(m.completed),
        m.origen ?? 'manual',
      ]),
  };
}

/** Una fila por entregable subido (tabla `task_links`), con su link y su revisión. */
export function tablaEntregables(links: TaskLink[], clients: Client[]): Tabla {
  const nombreCliente = new Map(clients.map((c) => [c.id, c.name]));
  return {
    nombre: 'Entregables',
    columnas: ['Cliente', 'Entregable', 'Link', 'Tipo', 'Revisión', 'Subido por', 'Origen', 'Fecha'],
    filas: links.map((l) => [
      nombreCliente.get(l.clientId) ?? '(cliente no encontrado)',
      l.nombre,
      l.url,
      l.tipo,
      ESTADO_ENTREGABLE[l.estado] ?? l.estado,
      l.createdByNombre ?? '',
      l.fuente === 'tarea' ? 'De una tarea' : 'Subido a mano',
      fecha(l.createdAt),
    ]),
  };
}

function diasEntre(desdeISO: string, hastaISO: string): number {
  const a = new Date(desdeISO.slice(0, 10)).getTime();
  const b = new Date(hastaISO.slice(0, 10)).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// ─────────────────────────── volcado a CSV ───────────────────────────

/**
 * Separador `;` y no `,` a propósito: el Excel en español —el que va a abrir
 * quien reciba esto— interpreta la coma como decimal y mete la fila entera en
 * una sola columna. Google Sheets detecta el `;` sin problema. Ese detalle es
 * la diferencia entre un archivo que se lee y uno que hay que rescatar a mano.
 */
export const SEPARADOR = ';';

function escapar(valor: string | number): string {
  const s = String(valor ?? '');
  // Comillas, separador o salto de línea obligan a entrecomillar; las comillas
  // de dentro se duplican. Es el formato que entienden Excel y Sheets.
  if (s.includes('"') || s.includes(SEPARADOR) || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function tablaACSV(tabla: Tabla): string {
  return [tabla.columnas, ...tabla.filas]
    .map((fila) => fila.map(escapar).join(SEPARADOR))
    .join('\r\n');
}

/** Nombre del archivo: `Project360-Tareas-2026-08-26.csv`. */
export function nombreArchivo(tabla: string, hoyISO: string, extension: string): string {
  return `Project360-${tabla}-${hoyISO.slice(0, 10)}.${extension}`;
}
