/**
 * El middleware de la API pública. TODA llamada pasa por acá antes de tocar
 * un solo dato.
 *
 * Los pasos corren en este orden y cualquiera que falle corta la llamada:
 *
 *   1. ¿Es HTTPS?                → si no, 400
 *   2. ¿Viene la API key?        → si no, 401
 *   3. ¿La key es válida y viva? → si no, 401
 *   4. ¿Tiene el permiso?        → si no, 403
 *   5. ¿Se pasó del límite?      → si sí, 429
 *   6. Ejecuta y registra la llamada en el audit log
 *
 * El aislamiento por agencia (el paso más importante de todos) NO está aquí:
 * está en las funciones SQL `security definer` de la migración 033, a las que
 * este middleware les entrega el `agencia_id` de la key. La razón es que la
 * service key de Supabase se SALTA las policies de RLS, así que si el filtro
 * viviera solo en este archivo, un bug acá sería suficiente para servir datos
 * de otra agencia. Con el filtro dentro de la base, no alcanza.
 */

import { createClient } from '@supabase/supabase-js';
import { hashKey, pareceKeyValida, type Scope } from './keys';
import { CODIGOS, error, errorInterno, exito, HEADERS_SEGURIDAD } from './respond';

function crearAdmin(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export type Admin = ReturnType<typeof crearAdmin>;

/** Lo que el endpoint recibe una vez superados todos los controles. */
export interface Contexto {
  admin: Admin;
  /** El aislamiento: se pasa a cada función SQL. Nunca sale del servidor. */
  agenciaId: string;
  keyId: string;
  scopes: string[];
  /** Body ya parseado y validado en tamaño (solo POST/PATCH). */
  body: unknown;
  /** Parámetros de la URL. */
  params: URLSearchParams;
  /** Segmento final de la ruta, para /tasks/:id. Cadena vacía si no hay. */
  id: string;
}

/** Máximo del cuerpo de un request: 100 KB. */
const MAX_BODY_BYTES = 100 * 1024;

/** Ventana del rate limit. */
const VENTANA_SEGUNDOS = 60;

interface Opciones {
  /** Métodos que acepta este endpoint. */
  metodos: string[];
  /** Permiso necesario. Sin él, la llamada muere en el paso 4. */
  scope: Scope;
  /** La lógica del endpoint. Solo corre si todo lo anterior pasó. */
  ejecutar: (ctx: Contexto) => Promise<Response>;
}

/**
 * Envuelve un endpoint con todos los controles.
 *
 * El endpoint que se le pasa NUNCA ve una llamada sin autenticar, sin permiso
 * o pasada de límite: para cuando corre, todo eso ya se resolvió.
 */
export function proteger(opts: Opciones) {
  return async function handler(req: Request): Promise<Response> {
    const inicio = Date.now();
    const url = new URL(req.url);

    // Contexto de auditoría. Se va llenando; se escribe al final pase lo que pase.
    let keyId: string | null = null;
    let agenciaId: string | null = null;
    let bodyParaLog: unknown = null;

    const registrar = (res: Response, admin: Admin | null) => {
      if (!admin) return;
      // El log es best-effort: si falla, la respuesta igual se entrega. Perder
      // una línea de auditoría es malo; tumbar la API por eso, peor.
      void admin
        .from('api_requests')
        .insert({
          api_key_id: keyId,
          agencia_id: agenciaId,
          metodo: req.method,
          endpoint: url.pathname,
          status_code: res.status,
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
          request_body: bodyParaLog,
          response_time_ms: Date.now() - inicio,
        })
        .then(({ error: e }) => {
          if (e) console.error('[api/v1] no se pudo registrar la llamada', e);
        });
    };

    try {
      // ── CORS: la API es de servidor a servidor ────────────────────────────
      // Se responde al preflight sin permitir ningún origen. Un navegador que
      // pregunte "¿puedo llamarte desde esta web?" recibe un no.
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: HEADERS_SEGURIDAD });
      }

      if (!opts.metodos.includes(req.method)) {
        return error(
          CODIGOS.METODO_NO_PERMITIDO,
          `Este endpoint solo acepta ${opts.metodos.join(', ')}.`,
          405,
          { Allow: opts.metodos.join(', ') },
        );
      }

      // ── PASO 1: HTTPS obligatorio ─────────────────────────────────────────
      // Vercel ya redirige todo a HTTPS, pero esto no depende de esa
      // configuración: si alguien la cambia, la API sigue protegida. Una API
      // key viajando por HTTP se lee en cualquier punto del camino.
      const proto = req.headers.get('x-forwarded-proto');
      if (proto && proto !== 'https') {
        return error(CODIGOS.HTTPS_REQUERIDO, 'Esta API solo acepta conexiones HTTPS.', 400);
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey) {
        return errorInterno('falta configuración del servidor', 'env vars ausentes');
      }
      const admin = crearAdmin(supabaseUrl, serviceKey);

      // ── PASO 2: ¿viene la API key? ────────────────────────────────────────
      const cabecera = req.headers.get('authorization') ?? '';
      const key = cabecera.replace(/^Bearer\s+/i, '').trim();
      if (!key) {
        const res = error(
          CODIGOS.NO_AUTENTICADO,
          'Falta la API key. Mándala en la cabecera: Authorization: Bearer pk_live_…',
          401,
        );
        registrar(res, admin);
        return res;
      }

      // ── PASO 3: validar la key ────────────────────────────────────────────
      // Se descarta por forma antes de consultar la base: así una avalancha de
      // basura no se convierte en una avalancha de queries.
      if (!pareceKeyValida(key)) {
        const res = error(CODIGOS.KEY_INVALIDA, 'API key inválida.', 401);
        registrar(res, admin);
        return res;
      }

      const hash = await hashKey(key);
      const { data: fila, error: errKey } = await admin
        .from('api_keys')
        .select('id, agencia_id, scopes, rate_limit, activa, expira_en')
        .eq('key_hash', hash)
        .maybeSingle();

      if (errKey) {
        const res = errorInterno('consultando la key', errKey);
        registrar(res, admin);
        return res;
      }

      // Mismo mensaje para "no existe" y para "revocada": distinguirlos le
      // diría a un atacante cuándo acertó una key que alguna vez fue real.
      if (!fila || fila.activa !== true) {
        const res = error(CODIGOS.KEY_INVALIDA, 'API key inválida.', 401);
        registrar(res, admin);
        return res;
      }

      keyId = fila.id as string;
      agenciaId = fila.agencia_id as string;

      // La expiración sí se distingue: el dueño legítimo necesita saber que
      // su key venció, y saberlo no le sirve de nada a un atacante.
      if (fila.expira_en && new Date(fila.expira_en as string) < new Date()) {
        const res = error(
          CODIGOS.KEY_EXPIRADA,
          'Esta API key expiró. Genera una nueva desde Configuración → API y Desarrolladores.',
          401,
        );
        registrar(res, admin);
        return res;
      }

      const scopes = (fila.scopes as string[]) ?? [];

      // ── PASO 4: ¿tiene el permiso? ────────────────────────────────────────
      if (!scopes.includes(opts.scope)) {
        const res = error(
          CODIGOS.PERMISO_INSUFICIENTE,
          `Esta API key no tiene el permiso "${opts.scope}".`,
          403,
        );
        registrar(res, admin);
        return res;
      }

      // ── PASO 5: rate limiting ─────────────────────────────────────────────
      // Se cuenta en Postgres, no en memoria: cada llamada puede caer en una
      // instancia distinta de la función y las instancias mueren solas, así
      // que un contador en memoria dejaría pasar tráfico de más sin avisar.
      const desde = new Date(Date.now() - VENTANA_SEGUNDOS * 1000).toISOString();
      const { count, error: errCount } = await admin
        .from('api_requests')
        .select('id', { count: 'exact', head: true })
        .eq('api_key_id', keyId)
        .gte('created_at', desde);

      if (errCount) {
        // Si el conteo falla, se deja pasar y se loguea. Bloquear a todo el
        // mundo porque la tabla de auditoría tuvo un hipo sería peor.
        console.error('[api/v1] no se pudo contar el rate limit', errCount);
      } else if ((count ?? 0) >= (fila.rate_limit as number)) {
        const res = error(
          CODIGOS.DEMASIADAS_SOLICITUDES,
          'Superaste el límite de llamadas por minuto. Espera un momento e intenta de nuevo.',
          429,
          { 'Retry-After': String(VENTANA_SEGUNDOS) },
        );
        registrar(res, admin);
        return res;
      }

      // ── Body: tamaño y forma ──────────────────────────────────────────────
      let body: unknown = null;
      if (req.method === 'POST' || req.method === 'PATCH') {
        const declarado = Number(req.headers.get('content-length') ?? '0');
        if (declarado > MAX_BODY_BYTES) {
          const res = error(CODIGOS.PAYLOAD_MUY_GRANDE, 'El cuerpo del request es demasiado grande (máx. 100 KB).', 413);
          registrar(res, admin);
          return res;
        }

        const crudo = await req.text();
        // Se vuelve a medir sobre el texto real: `content-length` lo pone quien
        // llama, así que creerle sin verificar sería confiar en el atacante.
        if (new TextEncoder().encode(crudo).length > MAX_BODY_BYTES) {
          const res = error(CODIGOS.PAYLOAD_MUY_GRANDE, 'El cuerpo del request es demasiado grande (máx. 100 KB).', 413);
          registrar(res, admin);
          return res;
        }

        try {
          body = crudo ? JSON.parse(crudo) : null;
        } catch {
          const res = error(CODIGOS.DATOS_INVALIDOS, 'El cuerpo del request no es JSON válido.', 400);
          registrar(res, admin);
          return res;
        }
        bodyParaLog = body;
      }

      // ── PASO 6: ejecutar y registrar ──────────────────────────────────────
      const partes = url.pathname.split('/').filter(Boolean);
      const ctx: Contexto = {
        admin,
        agenciaId,
        keyId,
        scopes,
        body,
        params: url.searchParams,
        id: partes[partes.length - 1] ?? '',
      };

      const res = await opts.ejecutar(ctx);

      // Marca de uso, para que en el panel se vea qué keys siguen vivas.
      void admin
        .from('api_keys')
        .update({ ultimo_uso: new Date().toISOString() })
        .eq('id', keyId)
        .then(({ error: e }) => {
          if (e) console.error('[api/v1] no se pudo marcar ultimo_uso', e);
        });

      registrar(res, admin);
      return res;
    } catch (e) {
      // Red de última instancia: cualquier excepción no prevista sale como un
      // 500 genérico. Sin esto, un error inesperado podría devolver un stack
      // trace con rutas de archivos y nombres de tablas.
      return errorInterno(`${req.method} ${url.pathname}`, e);
    }
  };
}

/** Reexport para que los endpoints importen todo de un solo sitio. */
export { exito, error, errorInterno, CODIGOS };
