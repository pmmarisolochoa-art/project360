export type RopreType = 'result' | 'objective' | 'premise' | 'risk' | 'deliverable';
export type RiskLevel = 'low' | 'medium' | 'high';
export type DeliverableStatus = 'todo' | 'in_progress' | 'review' | 'done';

export interface RopreItem {
  id: string;
  clientId: string;
  type: RopreType;
  title: string;
  description?: string;
  // Riesgos:
  riskLevel?: RiskLevel;
  mitigation?: string;
  // Entregables:
  status?: DeliverableStatus;
  dueDate?: string;
  startDate?: string;
  responsible?: string;
  // OKRs / objetivos:
  targetValue?: string;
  currentValue?: string;
  // Vinculación con Módulo de Tareas — cuando un entregable se promociona a tarea.
  linkedTaskId?: string;
  // Trazabilidad — qué reunión editó este item por última vez.
  // Lo escribe el panel ROPRE del MeetingDrawer cuando type === 'ropre_strategy'.
  lastEditedInMeetingId?: string;
  lastEditedAt?: string;
  createdAt: string;
}
