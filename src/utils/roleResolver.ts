import { ROLE_DEFS, type TeamRoleSlug } from '@/types/team';
import { useTeamStore } from '@/store/useTeamStore';

const VALID_SLUGS: ReadonlySet<string> = new Set(ROLE_DEFS.map((r) => r.slug));

/**
 * Resuelve un assignedTo que puede ser:
 *  - un slug de rol ("media_buyer") → nombre real del miembro del equipo
 *    para ese cliente, o si no hay asignación → título legible del rol
 *    ("Media Buyer")
 *  - un nombre humano ("Diego Ramírez") → se devuelve tal cual
 *
 * Útil para mostrar tareas creadas desde plantillas de embudo, donde
 * el campo se guardó como slug. Llámalo solo en runtime de render.
 */
export function resolveAssignee(assignedTo: string, clientId?: string): string {
  if (!assignedTo) return 'Sin asignar';
  if (!VALID_SLUGS.has(assignedTo)) return assignedTo; // ya es nombre humano

  // Buscar miembro real del equipo del cliente
  if (clientId) {
    const assignment = useTeamStore.getState().assignments.find(
      (a) => a.clientId === clientId && a.roleSlug === assignedTo,
    );
    if (assignment?.memberName) return assignment.memberName;
  }

  // Fallback: título legible del rol
  const role = ROLE_DEFS.find((r) => r.slug === assignedTo);
  return role?.title ?? assignedTo;
}

/** Variante para casos donde no tienes clientId (rinde el título del rol). */
export function roleSlugToLabel(slug: string): string {
  if (!VALID_SLUGS.has(slug)) return slug;
  const role = ROLE_DEFS.find((r) => r.slug === slug);
  return role?.title ?? slug;
}

export function isRoleSlug(s: string): s is TeamRoleSlug {
  return VALID_SLUGS.has(s);
}
