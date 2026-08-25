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
 * `message` es lo que lee el usuario: qué NO se guardó.
 * `revertir` deshace el cambio optimista de la pantalla.
 *
 * SIN `revertir` EL AVISO SOLO MITIGA. La fila que no se guardó se queda a la
 * vista, idéntica a las buenas: alguien sigue trabajando encima de ella y
 * desaparece en la siguiente recarga. Con él, la pantalla vuelve a decir la
 * verdad sola y el mensaje puede hablar en pasado en vez de mandar a recargar.
 *
 * Los `revertir` los fabrican `altaOptimista`, `cambioOptimista` y
 * `bajaOptimista` en `escrituraOptimista.ts`.
 */
export const onWriteError =
  (label: string, message: string, revertir?: () => void) => (e: unknown) => {
    console.warn(`[${label}]`, e);
    revertir?.();
    toast.error(message);
  };
