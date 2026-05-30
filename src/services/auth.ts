import { supabase, usingRemote } from './supabase';
import type { Session } from '@supabase/supabase-js';

/**
 * Helpers para autenticación con Supabase.
 * Si no hay Supabase configurado (modo LOCAL), devuelve sesión mock para
 * que la app sea navegable sin login durante desarrollo.
 */

export interface AuthUser {
  id: string;
  email: string;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (!supabase) throw new Error('Supabase no configurado.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Login sin usuario.');
  return { id: data.user.id, email: data.user.email ?? email };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/**
 * En modo LOCAL (sin Supabase env vars) la app corre sin auth real.
 * En modo REMOTE, requiere sesión válida.
 */
export const requiresAuth = usingRemote;
