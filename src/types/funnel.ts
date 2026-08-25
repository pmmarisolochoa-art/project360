/**
 * Embudos de LANZAMIENTO (los que sí se usan y se guardan en la base).
 *
 * Aquí vivían también los tipos del constructor visual de embudos del módulo
 * Planeación. Ese módulo se retiró el 25-ago: decía "embudo creado" y no
 * guardaba nada, y la founder confirmó que no lo usaban. Sus tipos se fueron
 * con él para que nadie construya encima de un esqueleto muerto — y para que
 * no queden dos cosas casi iguales llamadas "funnel", que ya fue la causa de
 * media semana perdida el 11 de agosto.
 */
/**
 * Meta de cada tipo de nodo del diagrama — emoji + lenguaje plano para que
 * el cliente entienda el embudo sin jerga de marketing.
 */
/* ════════════════════════════════════════════════════════════════════════════
 * SISTEMA DE EMBUDOS DE LANZAMIENTO CON ROADMAP
 * Nuevo sistema (no rompe el anterior). Un cliente tiene 0+ Funnels.
 * Cada Funnel se basa en un FunnelTemplate, tiene FunnelPhases, y sus tareas
 * viven en la tabla normal de tasks vinculadas por funnelId + phaseId.
 * ════════════════════════════════════════════════════════════════════════════ */

export type FunnelTemplateKey =
  | 'seed_leadmagnet'      // Lanzamiento Semilla + Lead Magnet (28-45d)
  | 'paid_workshop'        // Lanzamiento Pago Workshop (30-60d)
  | 'internal_launch'      // Lanzamiento Interno orgánico (30-45d)
  | 'evergreen_social';    // Evergreen / Social Funnel (operación mensual)

export type FunnelStatus = 'planning' | 'active' | 'completed' | 'paused' | 'cancelled';

export interface Funnel {
  id: string;
  clientId: string;
  templateKey: FunnelTemplateKey;
  name: string;                  // ej "Lanzamiento Semilla Q3"
  status: FunnelStatus;
  startDate: string;             // ISO — día 1 del embudo
  eventDate?: string;            // fecha del evento principal (webinar/apertura carrito)
  endDate?: string;              // fecha de cierre
  shareToken: string;            // token unguessable para portal cliente público
  programId?: string;            // programa al que pertenece (Sprint E · Sección 4)
  createdAt: string;
}

export interface FunnelPhase {
  id: string;
  funnelId: string;
  order: number;
  name: string;
  color: string;
  dayStart: number;              // offset en días desde startDate del funnel
  dayEnd: number;
}

export interface TemplateTask {
  title: string;
  responsibleRole: string;       // slug de team role
  dayStart: number;
  dayEnd: number;
  input?: string;
  output?: string;
  priority?: 'P1' | 'P2' | 'P3';
  recurring?: boolean;
  // Marca tareas cuyo output es un entregable formal para el cliente
  // (PDF, video, secuencia de emails, deck, etc.). Al materializar, estas
  // tareas reciben tag = 'deliverable'.
  isDeliverable?: boolean;
}

export interface TemplatePhase {
  name: string;
  color: string;
  dayStart: number;
  dayEnd: number;
  tasks: TemplateTask[];
}

export interface FunnelTemplate {
  key: FunnelTemplateKey;
  emoji: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  estimatedDays: { min: number; max: number };
  phases: TemplatePhase[];
}
