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
}

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
