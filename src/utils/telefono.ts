/**
 * ¿Esto parece un teléfono?
 *
 * Nace de un dato real: la ficha de David Guerrero llegó a producción con
 * **"Colombia" en el campo de WhatsApp**, y se descubrió meses después, al
 * exportar el portafolio para enviárselo a un tercero. La validación que había
 * era `min(7)` sobre el texto — y "Colombia" tiene ocho letras, así que pasaba.
 *
 * LA REGLA ES CONTAR DÍGITOS, no medir el texto. Un teléfono del mundo real
 * tiene al menos siete cifras (E.164 admite hasta 15), y lo que le rodea varía
 * demasiado para normarlo: "+57 300 000 0000", "(300) 000-0000", un número con
 * extensión. Contar dígitos deja pasar todas esas formas y no deja pasar
 * ninguna palabra — que es exactamente el error que se quiere impedir.
 *
 * A propósito NO se valida el país ni la longitud exacta: sería precisión
 * fingida, y un formato que rechaza números legítimos se acaba esquivando.
 */

/** Cuántas cifras tiene el texto, ignorando todo lo demás. */
export function digitosDe(valor: string): number {
  return (valor.match(/\d/g) ?? []).length;
}

/** Mínimo de cifras para que un número sea plausible en cualquier país. */
export const MIN_DIGITOS_TELEFONO = 7;

export function esTelefonoPlausible(valor: string): boolean {
  return digitosDe(valor) >= MIN_DIGITOS_TELEFONO;
}

/** El mismo mensaje en los dos sitios donde se pide un teléfono. */
export const ERROR_TELEFONO = 'Debe ser un número de teléfono (con código de país)';
