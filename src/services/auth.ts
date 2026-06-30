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

/** Contexto resuelto del usuario: qué tipo es y qué puede ver. */
export interface UserContext {
  role: 'owner' | 'member';
  agencyId: string | null;
  clientAccess: { clientId: string; accessLevel: 'viewer' | 'editor' } | null;
}

/**
 * Determina quién es el usuario logueado:
 *   1. Si es owner de una agencia → role 'owner' (ve todo lo suyo, como hasta hoy).
 *   2. Si NO, pero está en team_members.user_id → role 'member' (ve 1 cliente).
 *   3. Si no es ninguno → 'owner' sin agencia (estado neutro, como antes).
 * La consulta a team_members la protege la policy `team_members_client_read`
 * de la migración 018 (un miembro solo lee su propia fila vía is_client_member).
 */
export async function resolveUserContext(userId: string): Promise<UserContext> {
  if (!supabase) return { role: 'owner', agencyId: null, clientAccess: null };

  // 1. ¿Es dueño de una agencia?
  const { data: agency } = await supabase
    .from('agencies')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();
  if (agency?.id) return { role: 'owner', agencyId: agency.id, clientAccess: null };

  // 2. ¿Es miembro del equipo de algún cliente?
  const { data: member } = await supabase
    .from('team_members')
    .select('client_id, access_level')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (member?.client_id) {
    return {
      role: 'member',
      agencyId: null,
      clientAccess: {
        clientId: member.client_id as string,
        accessLevel: member.access_level === 'viewer' ? 'viewer' : 'editor',
      },
    };
  }

  // 3. Sin contexto reconocido — neutro.
  return { role: 'owner', agencyId: null, clientAccess: null };
}
