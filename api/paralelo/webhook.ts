/**
 * Webhook de Paralelo — de momento SOLO ESCUCHA Y ANOTA.
 *
 * Paralelo confirmó (19-ago) que su plataforma manda webhooks, y pidió una URL
 * vacía que registre lo que llega. Con ese registro sabremos qué mandan y con
 * qué forma, y a partir de ahí se escribe la integración de verdad.
 *
 * POR QUÉ NO HACE NADA MÁS, A PROPÓSITO:
 * escribir tareas o reuniones ahora significaría adivinar su formato. Ya
 * sabemos cómo acaba eso — sus `dueDate` son prosa y sus responsables son
 * etiquetas de diarización. Primero se mira lo que llega; después se decide.
 * Un webhook que interpreta mal y escribe es mucho peor que uno que no escribe.
 *
 * SEGURIDAD:
 *   - Es una URL pública en internet. Va protegida con un secreto compartido
 *     (`PARALELO_WEBHOOK_SECRET`), que viaja en la URL porque es lo que un
 *     tercero puede configurar sin trabajo. Sin él, cualquiera podría llenar la
 *     bitácora.
 *   - Se compara en tiempo constante para no filtrar el secreto carácter a
 *     carácter con los tiempos de respuesta.
 *   - Escribe con la llave de servicio en UNA tabla que no alimenta nada, y que
 *     tiene RLS encendido sin policies: no se lee desde la app.
 *   - El cuerpo se corta a 256 KB. Una bitácora no debe poder llenar la base.
 *
 * Requiere en Vercel: PARALELO_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY,
 *   VITE_SUPABASE_URL.
 */

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

/** Más allá de esto, el cuerpo se guarda recortado. */
const MAX_BYTES = 256 * 1024;

/** Cabeceras que nunca se guardan: traerían credenciales a la bitácora. */
const CABECERAS_SENSIBLES = new Set(['authorization', 'cookie', 'x-api-key', 'proxy-authorization']);

export default async function handler(req: Request): Promise<Response> {
  // Paralelo puede probar la URL con GET antes de configurarla. Se responde
  // algo claro en vez de un 405 que parezca que está rota.
  if (req.method === 'GET') {
    return texto('Webhook de Project360 activo. Manda un POST con tu payload y quedará registrado.', 200);
  }
  if (req.method !== 'POST') return texto('Solo POST.', 405);

  const url = new URL(req.url);
  const secreto = process.env.PARALELO_WEBHOOK_SECRET;
  if (!secreto) return texto('Webhook sin configurar (falta PARALELO_WEBHOOK_SECRET).', 503);

  const recibido = url.searchParams.get('token') ?? req.headers.get('x-webhook-token') ?? '';
  if (!igualSeguro(recibido, secreto)) return texto('Token inválido.', 401);

  const crudo = await req.text();
  const bytes = crudo.length;
  const cuerpoTexto = bytes > MAX_BYTES ? crudo.slice(0, MAX_BYTES) : crudo;

  // Si no es JSON no se descarta: se guarda el texto igual. Enterarse de que
  // mandan algo que no esperábamos es justamente el objetivo de esta bitácora.
  let cuerpo: unknown = null;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    cuerpo = null;
  }

  const cabeceras: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (!CABECERAS_SENSIBLES.has(k.toLowerCase())) cabeceras[k] = v;
  });

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return texto('Falta configuración de Supabase.', 500);

  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.from('paralelo_webhook_log').insert({
    metodo: req.method,
    ruta: url.pathname + (url.search ? '?(con token)' : ''),
    cabeceras,
    cuerpo,
    cuerpo_texto: cuerpoTexto,
    bytes,
    ip: req.headers.get('x-forwarded-for') ?? null,
  });

  // Si no se pudo anotar, se dice con un 500: un webhook que responde 200 sin
  // haber guardado nada hace que el otro lado crea que llegó, y el registro que
  // estamos construyendo saldría con huecos invisibles.
  if (error) return texto(`No se pudo registrar: ${error.message}`, 500);

  return texto('Recibido.', 200);
}

/**
 * Comparación en tiempo constante. Con un `===` normal, el tiempo de respuesta
 * delata cuántos caracteres del secreto se acertaron y permite adivinarlo.
 */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function texto(mensaje: string, status: number): Response {
  return new Response(mensaje, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
