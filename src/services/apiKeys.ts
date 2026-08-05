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

/** Etiquetas legibles de los permisos. Mismo orden que en la UI. */
export const SCOPE_LABELS: Record<string, string> = {
  'read:tasks': 'Leer tareas',
  'write:tasks': 'Crear tareas',
  'read:meetings': 'Leer agenda / reuniones',
  'write:meetings': 'Crear reuniones',
};
