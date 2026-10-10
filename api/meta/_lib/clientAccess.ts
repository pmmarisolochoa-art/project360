import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * ¿Puede `userId` ver los datos de Meta del cliente `clientId`?
 *
 * Replica server-side el mismo modelo que `resolveUserContext()` en
 * `src/services/auth.ts` — necesario porque estos endpoints usan la
 * service role key (se saltan RLS), así que la autorización por tenant
 * hay que hacerla a mano aquí:
 *   1. Dueño de la agencia del cliente → sí.
 *   2. Miembro de equipo asignado directamente a ese cliente → sí.
 *   3. "Dirección" (es_direccion) de la MISMA agencia del cliente → sí
 *      (ve todos los clientes de su agencia, no solo los suyos asignados).
 *   4. Cualquier otro caso → no.
 */
export async function callerCanAccessClient(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
): Promise<boolean> {
  const { data: cliente } = await admin
    .from('clients')
    .select('agency_id')
    .eq('id', clientId)
    .maybeSingle();
  if (!cliente?.agency_id) return false;

  const { data: agency } = await admin
    .from('agencies')
    .select('owner_id')
    .eq('id', cliente.agency_id)
    .maybeSingle();
  if (agency?.owner_id === userId) return true;

  const { data: memberships } = await admin
    .from('team_members')
    .select('client_id, es_direccion')
    .eq('user_id', userId);
  if (!memberships || memberships.length === 0) return false;

  if (memberships.some((m) => m.client_id === clientId)) return true;

  const esDireccion = memberships.some((m) => m.es_direccion === true);
  if (!esDireccion) return false;

  const clientIds = memberships.map((m) => m.client_id).filter(Boolean);
  if (clientIds.length === 0) return false;
  const { data: misClientes } = await admin
    .from('clients')
    .select('agency_id')
    .in('id', clientIds);
  return (misClientes ?? []).some((c) => c.agency_id === cliente.agency_id);
}
