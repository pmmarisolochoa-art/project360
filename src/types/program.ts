/**
 * Programa de un cliente (Sprint E · Sección 4).
 * Un cliente puede correr varios programas a la vez (lanzamiento, evergreen, etc.).
 * Vive en la tabla `programs`; tareas y embudos se vinculan vía program_id.
 */

export type ProgramEstado = 'activo' | 'pausa' | 'riesgo' | 'archivado';

export interface Program {
  id: string;
  clientId: string;
  nombre: string;
  tipo: string;                 // value de PROGRAM_TYPES
  descripcion?: string;
  fechaInicio?: string;         // YYYY-MM-DD
  fechaEvento?: string;
  fechaCierre?: string;
  estado: ProgramEstado;
  funnelTemplate?: string;      // template key aplicado (si se materializó embudo)
  color?: string;
  createdAt: string;
}

export const PROGRAM_TYPES: Array<{ value: string; label: string; emoji: string; template?: string }> = [
  { value: 'seed_leadmagnet', label: 'Lanzamiento Semilla', emoji: '🌱', template: 'seed_leadmagnet' },
  { value: 'paid_workshop',   label: 'Lanzamiento Pago',    emoji: '💰', template: 'paid_workshop' },
  { value: 'internal_launch', label: 'Lanzamiento Interno', emoji: '🏠', template: 'internal_launch' },
  { value: 'evergreen_social', label: 'Evergreen',          emoji: '♾️', template: 'evergreen_social' },
  { value: 'otro',            label: 'Otro',                emoji: '🚀' },
];

export const PROGRAM_COLORS = ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899'];

export const PROGRAM_ESTADO_META: Record<ProgramEstado, { label: string; emoji: string; color: string }> = {
  activo:     { label: 'Activo',     emoji: '🟢', color: '#10B981' },
  pausa:      { label: 'En pausa',   emoji: '🟡', color: '#F59E0B' },
  riesgo:     { label: 'En riesgo',  emoji: '🔴', color: '#EF4444' },
  archivado:  { label: 'Archivado',  emoji: '⚫', color: '#6B7280' },
};

export function programTypeMeta(tipo: string) {
  return PROGRAM_TYPES.find((t) => t.value === tipo) ?? PROGRAM_TYPES[PROGRAM_TYPES.length - 1];
}
