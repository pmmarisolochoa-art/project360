import { useAuthStore } from '@/store/useAuthStore';

/**
 * Modo de acceso del usuario actual sobre el cerebro del cliente.
 *
 *  - owner            → ve y edita todo (operación de la agencia).
 *  - member + editor  → ejecuta: ve todo y puede mover/editar SUS tareas.
 *  - member + viewer  → solo lectura: revisa estado y reportes.
 *
 * La verdad dura la impone RLS (migración 018); esto solo ajusta la UI
 * para no mostrar acciones que el servidor rechazaría.
 */
export function useClientMode() {
  const role = useAuthStore((s) => s.role);
  const access = useAuthStore((s) => s.clientAccess);
  const isMember = role === 'member';
  return {
    isMember,
    accessLevel: access?.accessLevel ?? null,
    /** Puede crear/mover/editar tareas: owner siempre; miembro solo si es editor. */
    canEditTasks: !isMember || access?.accessLevel === 'editor',
  };
}
