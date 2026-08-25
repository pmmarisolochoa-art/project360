/**
 * Escrituras optimistas que saben deshacerse.
 *
 * La app pinta el cambio antes de que Supabase confirme, porque esperar a la
 * red en cada clic se siente roto. El precio es que, si la base rechaza, la
 * pantalla enseña algo que no existe.
 *
 * El 1 de agosto se cerró la mitad del problema: ahora avisa cuando falla. Pero
 * el aviso solo mitiga. La fila fantasma **se queda en pantalla**,
 * indistinguible de las reales: se sigue trabajando encima, se la nombra en una
 * reunión, y desaparece en la siguiente recarga. Siete de los treinta mensajes
 * decían "recarga para ver el estado real", que es pedirle al usuario que haga
 * a mano lo que el código puede hacer solo.
 *
 * Estas tres funciones devuelven un `revertir` que deshace EXACTAMENTE lo que
 * hicieron, y nada más.
 *
 * POR QUÉ QUIRÚRGICO Y NO "GUARDAR LA LISTA ENTERA Y RESTAURARLA": entre que se
 * pinta el cambio y llega el fallo pasan segundos, y en esos segundos el
 * usuario puede haber editado otra fila. Restaurar la lista completa se llevaría
 * por delante ese trabajo — arreglaría un fantasma creando otro.
 */

interface ConId {
  id: string;
}

/** Alta: pinta el elemento arriba. Revertir = quitarlo por id. */
export function altaOptimista<T extends ConId>(
  lista: () => T[],
  guardar: (l: T[]) => void,
  item: T,
): () => void {
  guardar([item, ...lista()]);
  return () => guardar(lista().filter((x) => x.id !== item.id));
}

/** Cambio: aplica el parche. Revertir = devolver esa fila a como estaba. */
export function cambioOptimista<T extends ConId>(
  lista: () => T[],
  guardar: (l: T[]) => void,
  id: string,
  patch: Partial<T>,
): () => void {
  const previo = lista().find((x) => x.id === id);
  guardar(lista().map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return () => {
    if (!previo) return;
    guardar(lista().map((x) => (x.id === id ? previo : x)));
  };
}

/**
 * Baja: quita el elemento. Revertir = devolverlo A SU SITIO.
 *
 * Se recuerda la posición, no solo el elemento: si vuelve al principio de una
 * lista ordenada a mano, el usuario ve moverse algo que él no movió y no
 * entiende por qué.
 */
export function bajaOptimista<T extends ConId>(
  lista: () => T[],
  guardar: (l: T[]) => void,
  id: string,
): () => void {
  const antes = lista();
  const posicion = antes.findIndex((x) => x.id === id);
  const previo = antes[posicion];
  guardar(antes.filter((x) => x.id !== id));
  return () => {
    if (!previo) return;
    const actual = lista().slice();
    actual.splice(Math.min(Math.max(posicion, 0), actual.length), 0, previo);
    guardar(actual);
  };
}
