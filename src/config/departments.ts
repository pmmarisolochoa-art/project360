/**
 * Departamentos = "lentes" sobre los módulos del cerebro del cliente.
 *
 * NO son dashboards separados ni módulos nuevos: cada departamento es solo una
 * LISTA de slugs de `BRAIN_MODULES` (definidos en components/brain/BrainNav.tsx).
 * Una persona puede pertenecer a VARIOS departamentos; lo que ve es la UNIÓN de
 * los módulos de todos ellos (sin duplicar los compartidos).
 *
 * Fuente única: si mañana quieres mover un módulo de un departamento a otro,
 * se cambia AQUÍ y nada más. El editor/viewer (quién puede editar) es otro eje
 * aparte y no se toca desde acá.
 */

export type DepartmentId = 'pm' | 'finanzas' | 'content';

export interface DepartmentDef {
  id: DepartmentId;
  label: string;
  /** Descripción corta para UI/tooltips. */
  hint: string;
  /** Slugs de módulos de BRAIN_MODULES que este departamento muestra. */
  modules: string[];
}

export const DEPARTMENTS: DepartmentDef[] = [
  {
    id: 'pm',
    label: 'Project Manager',
    hint: 'gestión y seguimiento',
    modules: ['profile', 'tasks', 'ropre', 'meetings', 'programs', 'team'],
  },
  {
    id: 'finanzas',
    label: 'Planeación & Finanzas',
    hint: 'números del cliente',
    modules: ['projections', 'metrics'],
  },
  {
    id: 'content',
    label: 'Content Manager',
    hint: 'contenido y marca',
    // 'content' está oculto en beta (comentado en BRAIN_MODULES); cuando se
    // reactive el módulo, este departamento lo muestra sin cambios aquí.
    modules: ['content', 'profile', 'tasks', 'team'],
  },
];

/**
 * Slugs de módulos visibles para una lista de departamentos (unión, sin
 * duplicados). Los departamentos desconocidos se ignoran.
 */
export function moduleSlugsForDepartments(deptIds: string[]): Set<string> {
  const slugs = new Set<string>();
  for (const id of deptIds) {
    const dep = DEPARTMENTS.find((d) => d.id === id);
    dep?.modules.forEach((m) => slugs.add(m));
  }
  return slugs;
}

/**
 * Slugs de módulos que un MIEMBRO puede ver Y abrir, según sus departamentos.
 * Sin departamentos asignados → cae al set por defecto (`fallback`), que
 * preserva el comportamiento previo. Fuente única para el menú (BrainNav) y
 * el candado de acceso (ClientBrainPage): así nunca se desincronizan.
 */
export function memberAllowedSlugs(departamentos: string[], fallback: string[]): Set<string> {
  return departamentos.length > 0 ? moduleSlugsForDepartments(departamentos) : new Set(fallback);
}
