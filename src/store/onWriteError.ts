/**
 * Aviso único para escrituras que fallan.
 *
 * TODAS las escrituras de la app son optimistas: la interfaz pinta el cambio
 * antes de que Supabase lo confirme. Por eso un fallo NUNCA puede quedarse solo
 * en la consola — el usuario creería que guardó, se iría tranquilo, y el trabajo
 * desaparecería al recargar. Ya pasó: `tasks.update` devolvía 400 durante días
 * por una columna inexistente y nadie se enteró.
 *
 * La regla se estableció el 1 de agosto y se aplicó a las 9 rutas de
 * `useClientStore`. Los otros 7 stores —ROPRE, embudos, equipo, personas,
 * contenido, roles y proyecciones— se quedaron fuera **sin que nadie lo
 * anotara**, así que durante tres semanas parecieron arreglados porque la regla
 * decía que lo estaban. Eran 23 rutas más, y las encontró la primera auditoría.
 *
 * Vive aquí, y no dentro de un store, justamente por eso: para que la siguiente
 * persona que escriba un store lo tenga a mano y no reinvente el `console.warn`.
 */

import { toast } from '@/store/useToastStore';

/**
 * `label` identifica la operación en la consola (`ropre.create`).
 * `message` es lo que lee el usuario: qué NO se guardó y qué hacer.
 */
export const onWriteError = (label: string, message: string) => (e: unknown) => {
  console.warn(`[${label}]`, e);
  toast.error(message);
};
