import type { TeamRoleSlug } from './team';

/**
 * Miembro del equipo asignado a un cliente (Sprint E · Sección 3).
 * Persona concreta con nombre + rol, funciones editables y KPIs (los del rol
 * con valores manuales + KPIs personalizados). Vive en la tabla `team_members`.
 *
 * Es independiente del sistema role-based existente (useTeamStore / RoleAssignment),
 * que se conserva intacto.
 */

export type CustomKpiType = 'percent' | 'number' | 'text';
export type KpiMeasure = 'auto' | 'manual';

export interface CustomKpiDef {
  key: string;
  label: string;
  type: CustomKpiType;
  target: string;       // meta (string para soportar %, número o texto)
  measure: KpiMeasure;  // automático (desde tareas) o manual
}

export interface TeamMemberKpis {
  /** Valores manuales por KPI (clave = key del KPI del rol o personalizado). */
  values: Record<string, string>;
  /** Historial de los últimos valores manuales por KPI (máx 4). */
  history?: Record<string, string[]>;
  /**
   * Meta (target) sobreescrita por cliente para un KPI del rol.
   * Si falta, se usa el target por defecto de ROLE_DEFS. Clave = key del KPI.
   */
  targets?: Record<string, string>;
  /** KPIs personalizados agregados por el PM. */
  custom: CustomKpiDef[];
}

export interface TeamMember {
  id: string;
  clientId: string;
  nombre: string;
  rol: TeamRoleSlug;
  email?: string;
  telefono?: string;
  avatarColor: string;
  funciones: string[];
  kpis: TeamMemberKpis;
  createdAt: string;
}

export function emptyKpis(): TeamMemberKpis {
  return { values: {}, history: {}, targets: {}, custom: [] };
}
