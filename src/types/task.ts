export type TaskStatus = 'pending' | 'in_progress' | 'in_review' | 'completed' | 'blocked';
export type TaskPriority = 'P1' | 'P2' | 'P3';

export interface Task {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string;
  dueDate: string;
  completedAt?: string;
  parentTaskId?: string;
  moduleTag?: string;
  isDelayed: boolean;
  delayDays: number;
  // Origen: si la tarea fue creada desde un entregable ROPRE.
  origin?: { type: 'ropre'; itemId: string };
  // Input/Output para el flujo de trabajo
  input?: string;
  output?: string;
  // Dependencias: IDs de otras tareas. `dependsOn` se llena manualmente,
  // `dependedBy` se deriva (no se persiste como tal, pero lo computamos al render).
  dependsOn?: string[];
  // Para vista Gantt — si falta, se infiere desde createdAt/dueDate.
  startDate?: string;
  // Subtareas (hasta 5 recomendado, no enforced)
  subtasks?: Array<{ id: string; title: string; done: boolean }>;
  // Comentarios — historial de la tarea
  comments?: Array<{ id: string; author: string; text: string; createdAt: string }>;
  // Etiqueta semántica (ADS / Contenido / Estrategia / Reunión / Entregable / ROPRE / Otro)
  tag?: TaskTag;
  // Link a Drive / repositorio externo donde vive el entregable.
  driveLink?: string;
  // Embudo: si la tarea pertenece a un Funnel (sistema de lanzamiento), enlace + fase.
  funnelId?: string;
  phaseId?: string;
  // KPI de resultado (Sprint E · Sección 5) — qué resultado debe generar la tarea.
  kpiNombre?: string;     // ej "500 leads captados"
  kpiMeta?: string;       // ej "500"
  kpiResultado?: string;  // resultado real, se llena al completar
  kpiTipo?: string;       // 'manual' | 'auto'
  createdAt: string;
  /** Última modificación — se actualiza en cada cambio (trigger en BD + store). */
  updatedAt?: string;
  /** ID de esta tarea en la plataforma externa (integración). Evita duplicados
   *  en la sincronización de ida-y-vuelta. Vacío = creada dentro de Project360. */
  externalId?: string;

  /* ── Trazabilidad de origen (migración 029) ────────────────────────────────
   * OJO: `origin` (arriba, jsonb) es el enlace a ROPRE. `origen` (aquí, texto)
   * es la CATEGORÍA de dónde nació la tarea. No son lo mismo.                */
  /** De dónde nació la tarea. Default 'manual'. */
  origen?: TaskOrigen;
  /** Reunión de la que salió (solo si origen = 'reunion'). */
  meetingId?: string;
  /** Nombre de esa reunión, copiado para mostrarlo sin cargarla. */
  meetingNombre?: string;
  /** Fecha de esa reunión (ISO). */
  meetingFecha?: string;

  /* ── Espacio privado (migración 030) ───────────────────────────────────── */
  /** true = solo la ve su propietario. No sale en vistas ni reportes del equipo. */
  esPrivada?: boolean;
  /** auth.users.id del dueño de la tarea privada. */
  propietarioId?: string;
}

/** De dónde nació una tarea. Debe coincidir con el CHECK de `tasks.origen`. */
export type TaskOrigen = 'manual' | 'reunion' | 'embudo' | 'ia';

export const TASK_ORIGEN_LABEL: Record<TaskOrigen, string> = {
  manual: 'Tarea manual',
  reunion: 'De una reunión',
  embudo: 'Del embudo',
  ia: 'Generada por IA',
};

export type TaskTag = 'ads' | 'content' | 'strategy' | 'meeting' | 'deliverable' | 'ropre' | 'other';

export const TASK_TAG_LABEL: Record<TaskTag, string> = {
  ads: 'ADS',
  content: 'Contenido',
  strategy: 'Estrategia',
  meeting: 'Reunión',
  deliverable: 'Entregable',
  ropre: 'ROPRE',
  other: 'Otro',
};
