/**
 * ¿Este id corresponde a una fila real de Supabase, o es data local del seed?
 *
 * El seed in-memory (`src/data/seed.ts`) usa ids legibles tipo `c_fitmind`,
 * mientras que las filas reales llevan uuid. Las columnas `*_id` de Supabase son
 * de tipo uuid, así que intentar escribir un id del seed revienta con
 * `22P02: invalid input syntax for type uuid`.
 *
 * Eso es exactamente lo que ensuciaba `/team` con 39 errores 400 por visita:
 * `TeamPage` llamaba a `ensureForClient()` para TODOS los clientes del store —
 * que antes de hidratar son el seed— y cada asignación intentaba persistirse.
 *
 * Úsalo para saltarte la escritura (no el estado en memoria: la UI local debe
 * seguir funcionando con el seed).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPersistableId(id: string | null | undefined): boolean {
  return typeof id === 'string' && UUID_RE.test(id);
}
