import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { resolveAssignee, isRoleSlug } from '@/utils/roleResolver';
import type { Task } from '@/types/task';

/**
 * "¿Esta tarea es mía?" — una sola respuesta para toda la app.
 *
 * Vivía dentro de TasksModule y solo servía ahí. Al personalizar las
 * notificaciones hacía falta la misma pregunta en otro sitio, y copiarla habría
 * sido el fallo de los dos traductores del 11-ago: dos versiones de la misma
 * regla, una usada a diario y otra de mes en mes, divergiendo en silencio. Aquí
 * el que la corrija la corrige para todos.
 *
 * Reconoce una tarea como propia por TRES caminos, porque `assignedTo` es texto
 * libre y llega de sitios distintos:
 *   · el nombre coincide con el mío
 *   · está asignada a un ROL que yo tengo en ese cliente
 *   · el nombre, una vez resuelto (slug de rol → persona real), coincide
 *
 * `clientId` acota la identidad a un cliente; sin él vale para la vista global,
 * que es lo que necesitan las notificaciones.
 */
export function useIdentidadTareas(clientId?: string) {
  // MIEMBRO → su nombre del acceso, NO el del owner. OWNER → currentUser.
  // No mezclar al owner en la identidad de un miembro es lo que hace que cada
  // quien vea lo suyo y no lo de Marisol.
  const currentUser = useAppStore((s) => s.currentUser);
  const authRole = useAuthStore((s) => s.role);
  const clientAccesses = useAuthStore((s) => s.clientAccesses);
  const allMembers = useTeamMembersStore((s) => s.members);
  const isMember = authRole === 'member';

  const myNames = useMemo(() => {
    const set = new Set<string>();
    if (isMember) {
      for (const a of clientAccesses) {
        if ((clientId ? a.clientId === clientId : true) && a.nombre) set.add(a.nombre.trim().toLowerCase());
      }
    } else if (currentUser?.name) {
      set.add(currentUser.name.trim().toLowerCase());
    }
    return set;
  }, [isMember, clientAccesses, currentUser, clientId]);

  /** Roles que tengo → las tareas asignadas por rol también son mías. */
  const myRoleSlugs = useMemo(() => {
    const miembros = clientId ? allMembers.filter((m) => m.clientId === clientId) : allMembers;
    return new Set<string>(
      miembros.filter((m) => myNames.has((m.nombre ?? '').trim().toLowerCase())).map((m) => m.rol),
    );
  }, [allMembers, myNames, clientId]);

  const esMia = useMemo(
    () => (t: Task): boolean => {
      const an = (t.assignedTo ?? '').trim().toLowerCase();
      if (an && myNames.has(an)) return true;
      if (isRoleSlug(t.assignedTo) && myRoleSlugs.has(t.assignedTo)) return true;
      // Se resuelve con el cliente DE LA TAREA, no con el del módulo: en la
      // vista global las tareas vienen de varios clientes a la vez.
      const resolved = resolveAssignee(t.assignedTo, t.clientId).trim().toLowerCase();
      return myNames.has(resolved);
    },
    [myNames, myRoleSlugs],
  );

  return { myNames, myRoleSlugs, esMia };
}
