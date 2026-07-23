import { ROLE_DEFS, type TeamRoleSlug } from '@/types/team';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';

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
    const member = useTeamMembersStore.getState().members.find(
      (m) => m.clientId === clientId && m.rol === assignedTo,
    );
    if (member?.nombre) return member.nombre;
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

/**
 * Dado un nombre humano (o slug) y el clientId, devuelve el título del
 * rol asociado al miembro del equipo de ese cliente. Si no encuentra
 * coincidencia, devuelve null.
 *
 * Útil para mostrar "Diego Ramírez · Media Buyer" en tareas.
 */
export function resolveRoleLabel(assignedTo: string, clientId?: string): string | null {
  if (!assignedTo) return null;

  // Si es slug, mapeo directo
  if (VALID_SLUGS.has(assignedTo)) {
    return roleSlugToLabel(assignedTo);
  }

  // Si es nombre, busca en el team del cliente
  if (clientId) {
    const member = useTeamMembersStore.getState().members.find(
      (m) => m.clientId === clientId && m.nombre === assignedTo,
    );
    if (member) {
      const role = ROLE_DEFS.find((r) => r.slug === member.rol);
      return role?.title ?? null;
    }
  }

  return null;
}

/**
 * Como resolveRoleLabel, pero devuelve TODOS los títulos de rol del
 * responsable. Una misma persona puede estar en el equipo con 2+ roles
 * (ej. "Jhonatan · Estratega" y "Jhonatan · Copywriter") — el filtro por
 * rol debe matchear cualquiera de ellos, no solo el primero.
 */
export function resolveRoleLabels(assignedTo: string, clientId?: string): string[] {
  if (!assignedTo) return [];

  if (VALID_SLUGS.has(assignedTo)) {
    return [roleSlugToLabel(assignedTo)];
  }

  if (clientId) {
    const labels = useTeamMembersStore.getState().members
      .filter((m) => m.clientId === clientId && m.nombre === assignedTo)
      .map((m) => ROLE_DEFS.find((r) => r.slug === m.rol)?.title)
      .filter((t): t is string => !!t);
    if (labels.length > 0) return Array.from(new Set(labels));
  }

  return [];
}
