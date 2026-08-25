/**
 * Generación y hash de llaves de la API pública.
 *
 * Este archivo vive bajo `_lib/` a propósito: Vercel ignora carpetas que
 * empiezan con guion bajo, así que NO se publica como endpoint. Es código
 * compartido, no una ruta.
 *
 * DOS REGLAS QUE NO SE NEGOCIAN
 *
 * 1. La aleatoriedad viene de `crypto.getRandomValues`, nunca de `Math.random`.
 *    `Math.random` es predecible: quien vea unas cuantas salidas puede calcular
 *    las siguientes, y eso convierte una llave secreta en una adivinable.
 *
 * 2. La llave se guarda HASHEADA (SHA-256). En claro solo existe en el momento
 *    de crearla, dentro de la respuesta que ve la dueña una única vez. Ni la
 *    base ni los logs la tienen. Por eso una llave perdida no se recupera: se
 *    revoca y se emite otra.
 */

/** Prefijo visible de toda llave de producción. */
const PREFIJO = 'pk_live_';

/**
 * Alfabeto sin caracteres ambiguos (0/O, 1/l/I). La llave se copia y pega a
 * mano más veces de las que uno cree, y un 0 confundido con una O produce un
 * 401 que nadie sabe explicar.
 */
const ALFABETO = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Cuántos caracteres aleatorios lleva la llave (sin contar el prefijo). */
const LARGO_SECRETO = 32;

/**
 * Genera una llave nueva: `pk_live_` + 32 caracteres aleatorios seguros.
 *
 * Se usa rechazo de muestras (`% 256 - resto`) en vez de un `% ALFABETO.length`
 * directo. El módulo directo daría más probabilidad a los primeros caracteres
 * del alfabeto — un sesgo pequeño, pero es exactamente el tipo de detalle que
 * le quita entropía real a un secreto.
 */
export function generarKey(): { key: string; prefix: string } {
  const n = ALFABETO.length;
  const limite = 256 - (256 % n); // descarta la cola que produciría sesgo
  let out = '';

  while (out.length < LARGO_SECRETO) {
    const bytes = new Uint8Array(LARGO_SECRETO);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limite) continue; // byte sesgado → se descarta y se pide otro
      out += ALFABETO[b % n];
      if (out.length === LARGO_SECRETO) break;
    }
  }

  const key = PREFIJO + out;
  // El prefijo guardado incluye los 4 primeros caracteres del secreto: alcanza
  // para distinguir llaves en una lista, no para reconstruir ninguna.
  return { key, prefix: `${PREFIJO}${out.slice(0, 4)}` };
}

/** SHA-256 en hex. Lo que se guarda en `api_keys.key_hash`. */
export async function hashKey(key: string): Promise<string> {
  const datos = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Forma esperada de una llave. Descarta basura antes de tocar la base. */
export function pareceKeyValida(key: string): boolean {
  return new RegExp(`^${PREFIJO}[${ALFABETO}]{${LARGO_SECRETO}}$`).test(key);
}

/** Los únicos permisos que existen hoy. La base repite esta lista en un CHECK. */
export const SCOPES_VALIDOS = [
  'read:tasks',
  'write:tasks',
  'read:meetings',
  'write:meetings',
  // Paso 2 de la integración (25-ago): solo LECTURA. La escritura de estos se
  // abre después y de a una, cuando la lectura ya funcione — regla del 6-ago.
  // OJO: esta lista está TAMBIÉN en el CHECK de `api_keys.scopes` (migración
  // 043). Si se agrega uno aquí y no allí, emitir la llave falla con un error
  // críptico de Postgres. Ya pasó tres veces en este proyecto.
  'read:clients',
  'read:team',
  'read:ropre',
  'read:deliverables',
] as const;

export type Scope = (typeof SCOPES_VALIDOS)[number];
