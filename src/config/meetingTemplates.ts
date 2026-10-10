/**
 * Plantillas de Modo Reunión.
 *
 * Son datos, no código: agregar, quitar, reordenar un paso o cambiar su
 * tiempo sugerido es editar este archivo, no tocar los componentes de
 * `components/meetingMode/`. Genérico a propósito — nada de nombres de
 * cliente ni de agencia, porque esto corre en la versión plantilla de
 * Project360 para cualquiera que la use.
 *
 * `kind` decide qué contenido pinta cada paso (ver
 * `components/meetingMode/slides/`). Los `kind` que empiezan por `review_`
 * o `closing` jalan datos reales (tareas, equipo); los demás son pasos
 * guiados con una pregunta y notas libres.
 */

export type MeetingTemplateId = 'sprint' | 'planning' | 'retro';

export type SlideKind =
  | 'intro'          // objetivo + fecha de la reunión
  | 'week_recap'      // arranque del cierre: objetivo de Planeación + cumplimiento + reuniones de la semana
  | 'context'        // métricas / estado actual
  | 'review_tasks'   // tareas reales por persona (hecho / en curso / bloqueado)
  | 'blockers'       // qué necesita cada uno y de quién
  | 'topics'         // temas a decidir, con su propio tiempo
  | 'decisions'      // registro explícito de decisiones tomadas
  | 'action_plan'    // tareas/responsables/fechas del plan
  | 'priorities'     // prioridades de la semana
  | 'retro_question' // pregunta abierta de retro (qué funcionó / qué no / qué aprendimos)
  | 'retro_actions'  // acciones de mejora, máx. 3 con responsable
  | 'retro_previous' // revisión de las acciones de la retro anterior
  | 'closing';        // resumen de compromisos → crear tareas

export interface MeetingSlideStep {
  id: string;
  titulo: string;
  /** Minutos sugeridos. Es una guía visual, no bloquea el avance. */
  minutos: number;
  kind: SlideKind;
  /** Texto de apoyo bajo el título — la pregunta o instrucción del paso. */
  prompt?: string;
}

export interface MeetingTemplate {
  id: MeetingTemplateId;
  nombre: string;
  descripcion: string;
  /** Token de color ya existente en tailwind.config (accent.*). */
  color: string;
  duracionSugeridaMin: number;
  pasos: MeetingSlideStep[];
}

export const MEETING_TEMPLATES: Record<MeetingTemplateId, MeetingTemplate> = {
  sprint: {
    id: 'sprint',
    nombre: 'Sprint',
    descripcion: 'Seguimiento semanal — ~30 min',
    color: '#06B6D4', // accent.cyan
    duracionSugeridaMin: 30,
    pasos: [
      { id: 'apertura', titulo: 'Recuento de la semana', minutos: 2, kind: 'week_recap', prompt: 'Lo que se planteó en Planeación, y cómo quedó' },
      { id: 'revision', titulo: 'Revisión de tareas por persona', minutos: 15, kind: 'review_tasks', prompt: 'Hecho / en curso / bloqueado' },
      { id: 'bloqueos', titulo: 'Bloqueos', minutos: 5, kind: 'blockers', prompt: '¿Qué necesita cada uno y de quién?' },
      { id: 'prioridades', titulo: 'Prioridades de la semana', minutos: 5, kind: 'priorities', prompt: '¿En qué nos enfocamos los próximos 7 días?' },
      { id: 'cierre', titulo: 'Cierre', minutos: 3, kind: 'closing', prompt: 'Compromisos con responsable y fecha' },
    ],
  },
  planning: {
    id: 'planning',
    nombre: 'Planeación y estrategia',
    descripcion: 'Sesión de decisiones — ~60 min',
    color: '#6366F1', // accent.indigo
    duracionSugeridaMin: 60,
    pasos: [
      { id: 'objetivo', titulo: 'Objetivo de la sesión', minutos: 5, kind: 'intro', prompt: '¿Qué resultado esperamos al salir de aquí?' },
      { id: 'contexto', titulo: 'Contexto', minutos: 10, kind: 'context', prompt: 'Métricas o estado actual por cliente/proyecto' },
      { id: 'temas', titulo: 'Temas a decidir', minutos: 25, kind: 'topics', prompt: 'Máx. 3 temas, con tiempo asignado a cada uno' },
      { id: 'decisiones', titulo: 'Decisiones tomadas', minutos: 10, kind: 'decisions', prompt: 'Registro explícito — qué se decidió y por qué' },
      { id: 'plan', titulo: 'Plan de acción', minutos: 7, kind: 'action_plan', prompt: 'Tareas, responsables, fechas' },
      { id: 'cierre', titulo: 'Cierre y próximos pasos', minutos: 3, kind: 'closing', prompt: 'Compromisos con responsable y fecha' },
    ],
  },
  retro: {
    id: 'retro',
    nombre: 'Retro',
    descripcion: 'Retrospectiva de equipo — ~45 min',
    color: '#8B5CF6', // accent.violet
    duracionSugeridaMin: 45,
    pasos: [
      { id: 'objetivo', titulo: 'Objetivo y reglas', minutos: 3, kind: 'intro', prompt: 'Espacio seguro — sin culpables' },
      { id: 'bien', titulo: '¿Qué funcionó bien?', minutos: 10, kind: 'retro_question', prompt: 'Lo que queremos repetir' },
      { id: 'mal', titulo: '¿Qué no funcionó?', minutos: 10, kind: 'retro_question', prompt: 'Lo que nos costó o frenó' },
      { id: 'aprendimos', titulo: '¿Qué aprendimos?', minutos: 7, kind: 'retro_question', prompt: 'El aprendizaje, no solo el síntoma' },
      { id: 'acciones', titulo: 'Acciones de mejora', minutos: 10, kind: 'retro_actions', prompt: 'Máx. 3, cada una con responsable' },
      { id: 'anterior', titulo: 'Retro anterior', minutos: 5, kind: 'retro_previous', prompt: '¿Cómo quedaron las acciones de la vez pasada?' },
    ],
  },
};

export const MEETING_TEMPLATE_LIST = Object.values(MEETING_TEMPLATES);
