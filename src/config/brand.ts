/**
 * Identidad visible de ESTA instancia de la plataforma.
 *
 * Todo el texto de marca que ve el usuario sale de aquí, para que renombrar
 * —o white-labelear a otra agencia— sea una sola línea y no una cacería por
 * toda la app. Hoy se comprobó que funciona: volver de "Ikigai Agencia" a
 * "Project360" fue exactamente este archivo y nada más.
 *
 * HISTORIA (26-ago-2026): la instancia se llamó "Ikigai Agencia" desde el
 * 5-ago, mientras Ikigai era el único usuario. Ikigai se muda a su propia
 * plataforma, así que la app vuelve a su nombre de producto y queda lista para
 * la siguiente agencia.
 *
 * OJO: esto es SOLO texto visible. El nombre del repositorio, las variables de
 * entorno y los identificadores internos siempre fueron project360.
 */
export const BRAND = {
  /** Nombre corto, en mayúsculas — logo del sidebar y encabezados. */
  name: 'PROJECT360',
  /** Subtítulo bajo el logo. */
  subtitle: 'OPERATING SYSTEM',
  /** Nombre en formato normal — frases, PDFs, pies de página. */
  label: 'Project360',
} as const;
