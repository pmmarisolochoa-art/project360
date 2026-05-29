import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Devuelve el cliente Supabase si hay credenciales en el env,
 * o null para que los repositorios caigan en modo local (seed in-memory).
 *
 * Esto deja que la app sea navegable sin Supabase configurado
 * y migre a backend real cuando se agreguen las env vars.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null;

export const usingRemote = !!supabase;
