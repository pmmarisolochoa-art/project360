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

/** Acceso de un miembro a un cliente. */
export interface ClientAccessCtx {
  clientId: string;
  accessLevel: 'viewer' | 'editor';
  teamMemberId: string;
  nombre: string;
  rol: string;
  departamentos: string[];
  /** Coordinador: ve TODAS las tareas del cliente (no solo las suyas). */
  veTodasTareas: boolean;
}

/** Contexto resuelto del usuario: qué tipo es y qué puede ver. */
export interface UserContext {
  role: 'owner' | 'member';
  agencyId: string | null;
  /** Todos los clientes del miembro (multi-cliente). Vacío para owner. */
  clientAccesses: ClientAccessCtx[];
}

/**
 * Determina quién es el usuario logueado:
 *   1. Si es owner de una agencia → role 'owner' (ve todo lo suyo, como hasta hoy).
 *   2. Si NO, pero está en team_members.user_id → role 'member'. Un miembro
 *      puede tener VARIAS filas (una por cliente): se devuelven todas.
 *   3. Si no es ninguno → 'owner' sin agencia (estado neutro, como antes).
 * La consulta a team_members la protege la policy `team_members_client_read`
 * de la migración 018 (el miembro solo lee filas de sus clientes).
 */
export async function resolveUserContext(userId: string): Promise<UserContext> {
  if (!supabase) return { role: 'owner', agencyId: null, clientAccesses: [] };

  // 1. ¿Es dueño de una agencia?
  const { data: agency } = await supabase
    .from('agencies')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();
  if (agency?.id) return { role: 'owner', agencyId: agency.id, clientAccesses: [] };

  // 2. ¿Es miembro del equipo de uno o más clientes?
  const { data: members } = await supabase
    .from('team_members')
    .select('id, client_id, access_level, nombre, rol, departamentos, ve_todas_tareas')
    .eq('user_id', userId);
  if (members && members.length > 0) {
    return {
      role: 'member',
      agencyId: null,
      clientAccesses: members
        .filter((m) => m.client_id)
        .map((m) => ({
          clientId: m.client_id as string,
          accessLevel: m.access_level === 'viewer' ? 'viewer' : 'editor',
          teamMemberId: m.id as string,
          nombre: (m.nombre as string) ?? '',
          rol: (m.rol as string) ?? '',
          departamentos: Array.isArray(m.departamentos) ? (m.departamentos as string[]) : [],
          veTodasTareas: m.ve_todas_tareas === true,
        })),
    };
  }

  // 3. Sin contexto reconocido — neutro.
  return { role: 'owner', agencyId: null, clientAccesses: [] };
}
