import { supabase } from './supabase';
import type { DepartmentId } from '@/config/departments';

export interface InvitePayload {
  clientId: string;
  email: string;
  nombre: string;
  rol: string;
  telefono?: string;
  accessLevel: 'editor' | 'viewer';
  departamentos: DepartmentId[];
  password: string;
  avatarColor?: string;
  funciones?: string[];
}

export interface InviteResult {
  memberId: string;
  userId: string;
  email: string;
}

/**
 * Invita a un miembro: crea su login + su acceso vía la Edge Function segura
 * (`/api/invitar-miembro`). Manda el token de la sesión del owner para que el
 * backend confirme que quien invita tiene permiso.
 */
export async function inviteMember(payload: InvitePayload): Promise<InviteResult> {
  if (!supabase) throw new Error('Sin conexión a Supabase.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo.');

  const res = await fetch('/api/invitar-miembro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<InviteResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || 'No se pudo invitar al miembro.');
  return data as InviteResult;
}
