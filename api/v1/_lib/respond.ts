/**
 * Forma de las respuestas de la API pública y cabeceras de seguridad.
 *
 * TODA respuesta sale por acá — las buenas y las malas. Es lo que garantiza
 * que una app externa nunca reciba dos formatos distintos, y que ninguna
 * respuesta se vaya sin sus cabeceras.
 *
 * REGLA DE ORO DE LOS ERRORES
 * Hacia afuera, el mensaje es genérico y estable. El detalle (el error de
 * Postgres, el stack) se escribe en el log del servidor y NO viaja. Un mensaje
 * como "column tasks.foo does not exist" le regala a un atacante el mapa de la
 * base de datos.
 */

/**
 * Cabeceras que van en toda respuesta.
 *
 * Sin `Access-Control-Allow-Origin` a propósito: esta API es de servidor a
 * servidor. Sin esa cabecera, el navegador BLOQUEA cualquier intento de
 * llamarla con JavaScript desde una página web — que es justo lo que queremos,
 * porque para llamarla desde el navegador habría que poner la API key en el
 * código de la página, o sea, publicarla.
 */
export const HEADERS_SEGURIDAD: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  // No adivines el tipo de contenido: si digo JSON, trátalo como JSON.
  'X-Content-Type-Options': 'nosniff',
  // Nadie puede meter estas respuestas en un iframe.
  'X-Frame-Options': 'DENY',
  // Un año de HTTPS obligatorio para este dominio.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // Una respuesta JSON no carga nada: la política más restrictiva posible.
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  // Datos de clientes no se cachean en ningún proxy intermedio.
  'Cache-Control': 'no-store',
};

/** Códigos de error. Son parte del contrato público: no se renombran. */
export const CODIGOS = {
  NO_AUTENTICADO: 'no_autenticado',
  KEY_INVALIDA: 'key_invalida',
  KEY_EXPIRADA: 'key_expirada',
  PERMISO_INSUFICIENTE: 'permiso_insuficiente',
  DEMASIADAS_SOLICITUDES: 'demasiadas_solicitudes',
  NO_ENCONTRADO: 'no_encontrado',
  DATOS_INVALIDOS: 'datos_invalidos',
  METODO_NO_PERMITIDO: 'metodo_no_permitido',
  HTTPS_REQUERIDO: 'https_requerido',
  PAYLOAD_MUY_GRANDE: 'payload_muy_grande',
  ERROR_INTERNO: 'error_interno',
} as const;

export type Codigo = (typeof CODIGOS)[keyof typeof CODIGOS];

export function exito(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { ...HEADERS_SEGURIDAD, ...extra },
  });
}

/**
 * Error hacia afuera. `mensaje` tiene que ser seguro de leer por un extraño:
 * explica qué hacer, nunca cómo está construido el sistema por dentro.
 */
export function error(
  code: Codigo,
  mensaje: string,
  status: number,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ success: false, error: { code, message: mensaje } }), {
    status,
    headers: { ...HEADERS_SEGURIDAD, ...extra },
  });
}

/**
 * Error interno. El detalle va al log del servidor y NUNCA a la respuesta.
 * Devuelve siempre el mismo texto, sin importar qué falló.
 */
export function errorInterno(contexto: string, e: unknown): Response {
  console.error(`[api/v1] ${contexto}`, e);
  return error(
    CODIGOS.ERROR_INTERNO,
    'Ocurrió un error procesando la solicitud. Si persiste, contacta al administrador.',
    500,
  );
}
