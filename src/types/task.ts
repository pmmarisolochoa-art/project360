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
  createdAt: string;
}
