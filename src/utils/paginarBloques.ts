/**
 * Reparte bloques de alto conocido en páginas A4, sin que nada se salga.
 *
 * EL FALLO QUE LA ORIGINA (21-sep-2026). Esta regla vivía dentro de
 * `composeReport` y no contemplaba un bloque más alto que la página: lo
 * colocaba igual y lo que pasaba del borde inferior SE PERDÍA. No fallaba
 * nada —el PDF se generaba, se abría y tenía sus páginas— simplemente faltaba
 * contenido. Lo vio la founder al abrir el semanal de Ikigai: media página en
 * blanco y los riesgos cortados.
 *
 * Vive aquí, pura y sin dependencias, para poder probarla. Dentro del motor
 * hacía falta un navegador con html2canvas para ejecutarla, así que en la
 * práctica no se probaba nunca.
 *
 * Quien la llame debe garantizar que ningún bloque supere `altoUtil` — el
 * motor lo consigue partiendo los bitmaps altos antes de llegar aquí. Si aun
 * así llegara uno, se le da su propia página en vez de dejarlo desbordar.
 */
export interface BloqueMedido { hmm: number }

export interface Colocado<T> { bloque: T; y: number }

export function paginarBloques<T extends BloqueMedido>(
  bloques: T[],
  opts: { topPrimera: number; topResto: number; fondo: number; hueco: number },
): Array<Array<Colocado<T>>> {
  const { topPrimera, topResto, fondo, hueco } = opts;
  const paginas: Array<Array<Colocado<T>>> = [[]];
  let p = 0;
  let y = topPrimera;

  const utilResto = fondo - topResto;

  for (const bloque of bloques) {
    /**
     * Se salta de página cuando el bloque no cabe Y saltar sirve de algo:
     *
     *  · si la página actual ya tiene contenido, vaciarla puede ser suficiente;
     *  · o si el bloque cabe en una página de continuación aunque no quepa en
     *    esta. Pasa en la PRIMERA página, que empieza 22-37 mm más abajo por la
     *    portada: un bloque de 250 mm cabe en la segunda (263 útiles) y no en
     *    la primera (226). Sin esta segunda condición se colocaba igual y se
     *    salía del papel — lo cazó la prueba, no la lectura del código.
     *
     * Si no cabe en ninguna, se coloca donde esté: saltar sería un bucle de
     * páginas en blanco. Para que ese caso no llegue aquí, el motor parte los
     * bitmaps más altos que `utilResto` antes de llamar.
     */
    const cabriaEnOtra = bloque.hmm <= utilResto;
    if (y + bloque.hmm > fondo && (paginas[p].length > 0 || cabriaEnOtra)) {
      p += 1;
      paginas[p] = [];
      y = topResto;
    }
    paginas[p].push({ bloque, y });
    y += bloque.hmm + hueco;
  }

  return paginas;
}
