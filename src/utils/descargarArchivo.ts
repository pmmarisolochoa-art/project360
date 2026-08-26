/**
 * Descargar un archivo generado en el navegador.
 *
 * Existe porque la primera versión de la exportación no descargaba NADA, sin
 * error ni aviso, y el motivo eran dos detalles que la app ya tenía resueltos
 * en otro sitio (`downloadMeetingReportPdf`):
 *
 *   1. El enlace tiene que estar DENTRO del documento cuando se le hace clic.
 *      Un `<a>` suelto en memoria funciona a veces y otras no hace nada.
 *   2. `URL.revokeObjectURL` no se puede llamar en el mismo instante que el
 *      clic: la descarga aún no ha leído el blob y se cancela en silencio.
 *
 * Es exactamente el patrón de los dos traductores de fila: dos maneras de
 * hacer lo mismo, una al día y otra al mes, y la que se usa poco se queda
 * atrás. Una sola función, y quien la corrija lo corrige para todos.
 */
export function descargarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
