/**
 * Empaquetar varios archivos en un ZIP, dentro del navegador.
 *
 * Existe por un motivo muy concreto: **Chrome bloquea la segunda descarga
 * automática de una página**. Cuando la exportación bajaba dos archivos (los
 * datos y su diccionario), llegaba solo el primero — sin error, sin aviso, y
 * con el más importante de los dos perdiéndose la mitad de las veces. Lo mismo
 * con los cuatro CSV.
 *
 * La solución no es pelear con el navegador ni escalonar descargas: es no
 * pedirle más de una. Un envío es un archivo.
 *
 * `fflate` ya venía instalado por dentro de `xlsx`, pero se declara como
 * dependencia propia: usar algo que llegó de rebote significa que el día que
 * `xlsx` cambie de tripas, esto se rompe sin que nadie haya tocado este
 * archivo.
 */

/** Un ZIP con los archivos dados. Las claves son los nombres dentro del ZIP. */
export async function crearZip(archivos: Record<string, string | Uint8Array>): Promise<Blob> {
  // Se carga bajo demanda, como xlsx: nadie que no exporte debería pagar su peso.
  const { zipSync, strToU8 } = await import('fflate');
  const entradas: Record<string, Uint8Array> = {};
  for (const [nombre, contenido] of Object.entries(archivos)) {
    entradas[nombre] = typeof contenido === 'string' ? strToU8(contenido) : contenido;
  }
  const comprimido = zipSync(entradas, { level: 6 });
  return new Blob([comprimido as unknown as BlobPart], { type: 'application/zip' });
}
