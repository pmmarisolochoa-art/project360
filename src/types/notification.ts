export type NotificationChannel = 'in_app' | 'email' | 'whatsapp';
export type NotificationUrgency = 'low' | 'normal' | 'high' | 'critical';
export type NotificationType =
  | 'task_overdue'
  | 'task_due_soon'
  | 'meeting_soon'
  | 'roas_low'
  | 'content_pending_approval'
  | 'task_comment'
  | 'deliverable_completed'
  | 'onboarding_complete';

export interface Notification {
  id: string;
  userId: string;
  clientId?: string;
  type: NotificationType;
  message: string;
  urgency: NotificationUrgency;
  isRead: boolean;
  channel: NotificationChannel;
  sentAt: string;
  createdAt: string;
  // ID de la entidad origen (taskId para task_*, meetingId para meeting_*, contentPieceId para content_*).
  // Permite que "Resolver →" navegue directo a la entidad y abra su detalle.
  entityId?: string;
}
