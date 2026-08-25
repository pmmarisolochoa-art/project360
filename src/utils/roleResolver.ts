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

/**
 * Traduce un responsable A NOMBRE DE PERSONA, para GUARDARLO.
 *
 * POR QUÉ EXISTE (25-ago-2026)
 * `resolveAssignee()` traduce al MOSTRAR: la tarjeta enseña "David Castaño"
 * aunque en la base ponga `media_buyer`. Eso hacía creer que asignar por rol
 * funcionaba, pero solo funcionaba en la tarjeta:
 *
 *   · Los KPIs del equipo buscan el nombre EXACTO (`assignedTo === nombre`),
 *     así que una tarea con slug no contaba para nadie.
 *   · El filtro "Todas las personas" y el recap de reunión mostraban el slug
 *     crudo: la founder vio `platforms`, `expert` y `designer` en la lista de
 *     personas de su equipo.
 *   · Si NADIE tenía ese rol, `resolveAssignee` caía al título del rol
 *     ("Plataformas"), que tampoco es una persona. Tarea huérfana para siempre.
 *
 * La regla nueva: **el rol se traduce cuando se ESCRIBE, no cuando se pinta**.
 * En la base solo hay nombres de personas. Así todo lo de abajo —KPIs, filtros,
 * reportes, la API— ve lo mismo, sin que cada uno tenga que acordarse de
 * traducir.
 *
 * Si no se puede resolver (nadie con ese rol, o DOS personas con él), devuelve
 * cadena vacía = "Sin asignar". Es a propósito: una tarea sin responsable salta
 * a la vista y alguien la corrige; una asignada a `platforms` no la corrige
 * nadie porque nadie sabe que está mal. Es la misma regla que con los apodos de
 * Paralelo.
 */
export function resolverResponsableParaGuardar(valor: string | undefined, clientId?: string): string {
  const v = (valor ?? '').trim();
  if (!v || !clientId) return '';

  const delCliente = useTeamMembersStore
    .getState()
    .members.filter((m) => m.clientId === clientId && (m.nombre ?? '').trim());

  // 1. ¿Es un rol conocido? → la persona que lo ejerce, si es UNA sola.
  if (VALID_SLUGS.has(v)) {
    const conEseRol = delCliente.filter((m) => m.rol === v);
    return conEseRol.length === 1 ? conEseRol[0].nombre.trim() : '';
  }

  // 2. ¿Es el nombre de alguien del equipo? → se acepta tal cual está en su ficha.
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const persona = delCliente.find((m) => norm(m.nombre) === norm(v));
  if (persona) return persona.nombre.trim();

  /**
   * 3. Ni rol conocido ni persona del equipo → Sin asignar.
   *
   * Este escalón se añadió al descubrir el hueco: antes cualquier texto que no
   * fuera un slug se devolvía tal cual "porque será un nombre". Con eso, una IA
   * que inventara un rol —y ya pasó: la ficha real de un cliente traía
   * `"estratega"`, que no existe— lo escribía como si fuera una persona.
   *
   * Vacío es visible y se corrige. Un nombre inventado no lo corrige nadie.
   */
  return '';
}

/**
 * Roles que HOY se pueden resolver a una persona concreta en este cliente.
 * Sirve para que el desplegable solo ofrezca lo que de verdad va a funcionar
 * (R-31: un control que solo puede fallar no se muestra).
 */
export function rolesResolublesDe(clientId: string): Array<{ slug: string; titulo: string; persona: string }> {
  const members = useTeamMembersStore.getState().members.filter((m) => m.clientId === clientId);
  return ROLE_DEFS.flatMap((r) => {
    const conEseRol = members.filter((m) => m.rol === r.slug && (m.nombre ?? '').trim());
    return conEseRol.length === 1
      ? [{ slug: r.slug, titulo: r.title, persona: conEseRol[0].nombre.trim() }]
      : [];
  });
}
