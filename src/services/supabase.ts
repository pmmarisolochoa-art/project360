import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Trim para defender contra newlines/whitespace que Vercel/Vite pueden incluir
// al copiar valores largos a env vars (causa "Invalid value" en fetch).
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/**
 * Devuelve el cliente Supabase si hay credenciales en el env,
 * o null para que los repositorios caigan en modo local (seed in-memory).
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null;

export const usingRemote = !!supabase;
