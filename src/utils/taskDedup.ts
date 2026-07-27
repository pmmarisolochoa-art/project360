/**
 * Anti-duplicados de tareas extraídas de reuniones.
 *
 * Un mismo título puede llegar dos veces: porque ya existe una tarea abierta,
 * o porque la IA lo devolvió repetido en el mismo lote. Este guard, aplicado en
 * TODOS los puntos donde una reunión crea tareas (extraer manual, auto-extract
 * al cerrar, y confirmar el borrador), garantiza que no se dupliquen.
 */

/** Normaliza un título para comparar: sin acentos, minúsculas, espacios colapsados. */
export const normTaskTitle = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Filtra candidatos dejando solo los NUEVOS: descarta los que coinciden (por
 * título normalizado) con una tarea ya existente o con otro candidato del lote.
 */
export function dedupeExtracted<T extends { title: string }>(
  candidates: T[],
  existingTitles: string[],
): { unique: T[]; omitted: number } {
  const existing = new Set(existingTitles.map(normTaskTitle));
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const c of candidates) {
    const k = normTaskTitle(c.title);
    if (!k || existing.has(k) || seen.has(k)) continue;
    seen.add(k);
    unique.push(c);
  }
  return { unique, omitted: candidates.length - unique.length };
}
