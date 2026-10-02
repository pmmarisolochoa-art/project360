/**
 * SOP del pipeline de Ventas — etapas fijas, iguales para cualquier cliente/programa.
 * Founder, 27/28-sep-2026. No son configurables por cliente a propósito: mantenerlas
 * fijas es lo que permite comparar el embudo entre clientes en el dashboard.
 */
export type LeadStage =
  | 'nuevo'
  | 'contactado'
  | 'calificado'
  | 'cita_agendada'
  | 'cita_realizada'
  | 'propuesta'
  | 'ganado'
  | 'perdido';

export const LEAD_STAGES: LeadStage[] = [
  'nuevo', 'contactado', 'calificado', 'cita_agendada',
  'cita_realizada', 'propuesta', 'ganado', 'perdido',
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  cita_agendada: 'Cita agendada',
  cita_realizada: 'Cita realizada',
  propuesta: 'Propuesta enviada',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

/**
 * Fuente del lead — distingue FORMATO de contenido (reel/story/carrusel/perfil)
 * además de meta_ads/referido/otro (migración 048, 29-sep-2026).
 */
export type LeadSource = 'meta_ads' | 'reel' | 'story' | 'carrusel' | 'perfil' | 'referido' | 'otro';

export const LEAD_SOURCES: LeadSource[] = ['meta_ads', 'reel', 'story', 'carrusel', 'perfil', 'referido', 'otro'];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  meta_ads: 'Meta Ads',
  reel: 'Reel',
  story: 'Story',
  carrusel: 'Carrusel',
  perfil: 'Perfil',
  referido: 'Referido',
  otro: 'Otro',
};

export interface Lead {
  id: string;
  clientId: string;
  nombre: string;
  telefono?: string;
  email?: string;
  fuente: LeadSource;
  etapa: LeadStage;
  setterId?: string;
  closerId?: string;
  /** Quién es el comprador — texto libre, cada cliente define sus categorías (migración 048). */
  perfilRol?: string;
  /**
   * Calificación del lead — score/banda/ruta, texto/número libre a propósito
   * (migración 050, 30-sep-2026): cada cliente con un formulario de
   * calificación propio (ej. RPM Method de Alejo: score 0-100, banda
   * rojo/amarillo/verde, ruta sprint/academy/method) trae su propia escala.
   * No se normaliza a un enum fijo — es lo que ya viene calculado en su
   * formulario externo, y forzarlo a categorías nuestras sería inventar datos.
   */
  score?: number;
  banda?: string;
  ruta?: string;
  /** Valor del programa contratado — editable, normalmente se llena al pasar a "ganado". */
  programValue?: number;
  /**
   * Cash collected — MANUAL a propósito (founder, 28-sep-2026). Lo actualiza
   * quien confirma el pago; no se deriva de un plan de cuotas ni de eventos.
   */
  cashCollected: number;
  lostReason?: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;

  /**
   * Agenda y resultado de la llamada de ventas (migración 052, 02-oct-2026).
   * `asistio` es texto libre (sí/no/reprogramó…) a propósito: un enum cerrado
   * bloquearía un caso que no se previó, igual que `banda`/`score`/`ruta`.
   */
  fechaAgenda?: string;
  fechaLlamada?: string;
  asistio?: string;
  resultado?: string;

  /** Lo que se cerró y cómo se paga. `programValue` ES el precio pactado. */
  producto?: string;
  formaPago?: string;

  /**
   * Plan de pagos — hasta 4 cuotas. El "Pago 1" es `cashCollected` (ya
   * existe, siempre cobrado al cierre): aquí solo falta su fecha. Los pagos
   * 2-4 sí llevan su propio `pagado`, porque a diferencia del 1 no están
   * cobrados por definición.
   */
  pago1Fecha?: string;
  pago2Monto?: number;
  pago2Fecha?: string;
  pago2Pagado?: boolean;
  pago3Monto?: number;
  pago3Fecha?: string;
  pago3Pagado?: boolean;
  pago4Monto?: number;
  pago4Fecha?: string;
  pago4Pagado?: boolean;

  ultimoSeguimiento?: string;
  notas?: string;
}

/**
 * El viaje del lead — append-only. Cada movimiento de etapa agrega una fila
 * nueva aquí; nunca se edita ni se borra una existente. De esta tabla vive el
 * panel "Viaje del lead".
 */
export interface LeadEvent {
  id: string;
  leadId: string;
  etapaAnterior?: LeadStage;
  etapaNueva: LeadStage;
  nota?: string;
  actorId?: string;
  actorNombre?: string;
  createdAt: string;
}
