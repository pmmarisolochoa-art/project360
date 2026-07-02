import { useAuthStore } from '@/store/useAuthStore';

/**
 * Modo de acceso del usuario actual sobre el cerebro de UN cliente.
 * Pásale el clientId que se está viendo (multi-cliente: el nivel de acceso
 * puede diferir por cliente).
 *
 *  - owner            → ve y edita todo (operación de la agencia).
 *  - member + editor  → ejecuta: ve todo y puede mover/editar SUS tareas.
 *  - member + viewer  → solo lectura: revisa estado y reportes.
 *
 * La verdad dura la impone RLS (migración 018); esto solo ajusta la UI.
 */
export function useClientMode(clientId?: string) {
  const role = useAuthStore((s) => s.role);
  const accesses = useAuthStore((s) => s.clientAccesses);
  const isMember = role === 'member';
  const access = clientId ? accesses.find((a) => a.clientId === clientId) : accesses[0];
  return {
    isMember,
    accessLevel: access?.accessLevel ?? null,
    /** ¿Es miembro con acceso (a cualquiera de sus clientes)? */
    hasAccessToClient: !clientId || accesses.some((a) => a.clientId === clientId),
    /** Puede crear/mover/editar tareas: owner siempre; miembro solo si es editor. */
    canEditTasks: !isMember || access?.accessLevel === 'editor',
  };
}
