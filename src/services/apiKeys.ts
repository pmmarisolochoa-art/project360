/**
 * Cliente del panel de API keys.
 *
 * Todo pasa por la Edge Function `/api/api-keys` en vez de hablarle a Supabase
 * directo: la llave se genera en el servidor y de ahí solo sale su hash a la
 * base. Ver el comentario de cabecera de `api/api-keys.ts`.
 */

import { supabase } from './supabase';

export interface ApiKeyRow {
  id: string;
  nombre: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  activa: boolean;
  ultimo_uso: string | null;
  expira_en: string | null;
  created_at: string;
}

export interface CrearKeyPayload {
  nombre: string;
  scopes: string[];
  rateLimit: number;
  expiracion: '30d' | '90d' | '1y' | 'nunca';
}

async function llamar<T>(init: RequestInit & { query?: string }): Promise<T> {
  if (!supabase) throw new Error('Sin conexión a Supabase.');

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo.');

  const res = await fetch(`/api/api-keys${init.query ?? ''}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(body.error ?? 'La operación falló.'));
  return body as T;
}

export async function listarApiKeys(): Promise<ApiKeyRow[]> {
  const { keys } = await llamar<{ keys: ApiKeyRow[] }>({ method: 'GET' });
  return keys;
}

/**
 * Crea una llave. El campo `key` de la respuesta es la ÚNICA vez que el
 * secreto existe fuera del servidor — si no se copia ahora, se pierde.
 */
export async function crearApiKey(
  payload: CrearKeyPayload,
): Promise<{ key: string; registro: ApiKeyRow }> {
  return llamar({ method: 'POST', body: JSON.stringify(payload) });
}

export async function revocarApiKey(id: string): Promise<void> {
  await llamar({ method: 'PATCH', query: `?id=${encodeURIComponent(id)}` });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVIDAD (audit log)
// ─────────────────────────────────────────────────────────────────────────────
// Esto SÍ se lee directo de Supabase, a diferencia de las llaves. La policy
// `api_requests_owner_read` de la migración 032 ya limita cada fila a la dueña
// de su agencia, y acá el que consulta es el navegador con la sesión de la
// usuaria — no la service key. O sea: RLS aplica de verdad y no hace falta un
// endpoint que repita el filtro.

export interface ApiRequestRow {
  id: string;
  api_key_id: string | null;
  metodo: string | null;
  endpoint: string | null;
  status_code: number | null;
  ip_address: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface ResumenActividad {
  llamadasHoy: number;
  erroresHoy: number;
  porcentajeErrores: number;
  keysActivas: number;
}

/** Alerta detectada sobre el comportamiento de una llave. */
export interface Alerta {
  tipo: 'posible_ataque' | 'rate_limit';
  keyId: string | null;
  mensaje: string;
}

function inicioDeHoy(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Últimas llamadas. `limite` acotado a 200: esta tabla crece con cada llamada
 * a la API y traerla entera colgaría el navegador el día que haya tráfico real.
 */
export async function listarActividad(filtros: {
  keyId?: string;
  soloErrores?: boolean;
  limite?: number;
} = {}): Promise<ApiRequestRow[]> {
  if (!supabase) return [];

  let q = supabase
    .from('api_requests')
    .select('id, api_key_id, metodo, endpoint, status_code, ip_address, response_time_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(filtros.limite ?? 100, 200));

  if (filtros.keyId) q = q.eq('api_key_id', filtros.keyId);
  if (filtros.soloErrores) q = q.gte('status_code', 400);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiRequestRow[];
}

/**
 * Resumen del día. Se piden CONTEOS al servidor en vez de contar las filas ya
 * traídas: si solo se trajeron 100 y hoy hubo 5.000 llamadas, contar en el
 * navegador daría un número tranquilizador y falso.
 */
export async function resumenActividad(keysActivas: number): Promise<ResumenActividad> {
  if (!supabase) return { llamadasHoy: 0, erroresHoy: 0, porcentajeErrores: 0, keysActivas };

  const desde = inicioDeHoy();
  const [total, errores] = await Promise.all([
    supabase.from('api_requests').select('id', { count: 'exact', head: true }).gte('created_at', desde),
    supabase.from('api_requests').select('id', { count: 'exact', head: true }).gte('created_at', desde).gte('status_code', 400),
  ]);

  const llamadasHoy = total.count ?? 0;
  const erroresHoy = errores.count ?? 0;
  return {
    llamadasHoy,
    erroresHoy,
    porcentajeErrores: llamadasHoy === 0 ? 0 : Math.round((erroresHoy / llamadasHoy) * 100),
    keysActivas,
  };
}

/**
 * Busca patrones sospechosos en las llamadas recientes.
 *
 * Es detección simple y a propósito: sirve para que un ataque no pase
 * inadvertido, no para frenarlo — de frenarlo se encargan el rate limit y la
 * autenticación. Su trabajo es que la founder MIRE.
 */
export function detectarAlertas(filas: ApiRequestRow[]): Alerta[] {
  const alertas: Alerta[] = [];
  // Las filas llegan de más nueva a más vieja; se agrupan por llave.
  const porKey = new Map<string, ApiRequestRow[]>();
  for (const f of filas) {
    const k = f.api_key_id ?? 'sin-key';
    if (!porKey.has(k)) porKey.set(k, []);
    porKey.get(k)!.push(f);
  }

  for (const [keyId, llamadas] of porKey) {
    // 5 rechazos de autenticación seguidos: o alguien está probando llaves, o
    // una integración quedó configurada con una llave vieja. Las dos merecen
    // que alguien lo vea.
    let seguidos = 0;
    for (const l of llamadas) {
      if (l.status_code === 401 || l.status_code === 403) seguidos++;
      else break;
    }
    if (seguidos >= 5) {
      alertas.push({
        tipo: 'posible_ataque',
        keyId: keyId === 'sin-key' ? null : keyId,
        mensaje: `${seguidos} intentos rechazados seguidos. Puede ser alguien probando llaves, o una integración con una llave revocada.`,
      });
    }

    const topes = llamadas.filter((l) => l.status_code === 429).length;
    if (topes >= 3) {
      alertas.push({
        tipo: 'rate_limit',
        keyId: keyId === 'sin-key' ? null : keyId,
        mensaje: `Chocó ${topes} veces con su límite de llamadas. Súbeselo o pídele que espacie las peticiones.`,
      });
    }
  }

  return alertas;
}

/** Etiquetas legibles de los permisos. Mismo orden que en la UI. */
export const SCOPE_LABELS: Record<string, string> = {
  'read:tasks': 'Leer tareas',
  'write:tasks': 'Crear tareas',
  'read:meetings': 'Leer agenda / reuniones',
  'write:meetings': 'Crear reuniones',
  'read:clients': 'Leer clientes',
  'read:team': 'Leer equipo',
  'read:ropre': 'Leer ROPRE',
  'read:deliverables': 'Leer entregables',
};
