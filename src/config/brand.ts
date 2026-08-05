/**
 * Identidad visible de ESTA instancia de la plataforma.
 *
 * "Sales Brain OS" es el producto general; "Ikigai Agencia" es la instancia que
 * opera hoy. Todo el texto de marca que ve el usuario sale de aquí para que
 * renombrar (o white-labelear a otra agencia el día de mañana) sea una sola
 * línea y no una cacería por toda la app.
 *
 * OJO: esto es SOLO texto visible. El nombre del repositorio, las variables de
 * entorno y los identificadores internos siguen siendo project360.
 */
export const BRAND = {
  /** Nombre corto, en mayúsculas — logo del sidebar y encabezados. */
  name: 'IKIGAI AGENCIA',
  /** Subtítulo bajo el logo. */
  subtitle: 'OPERATING SYSTEM',
  /** Nombre en formato normal — frases, PDFs, pies de página. */
  label: 'Ikigai Agencia',
} as const;
