import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getCurrentSession, onAuthChange, requiresAuth, resolveUserContext } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Guarda las rutas autenticadas. Si no hay Supabase configurado,
 * deja pasar todo (modo dev local). Si lo hay, exige sesión válida
 * y redirige a /login.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const setAgencyId = useAuthStore((s) => s.setAgencyId);
  const setRole = useAuthStore((s) => s.setRole);
  const setClientAccess = useAuthStore((s) => s.setClientAccess);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);
  const [ready, setReady] = useState(!requiresAuth);
  const location = useLocation();

  useEffect(() => {
    if (!requiresAuth) {
      setReady(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const session = await getCurrentSession();
      if (cancelled) return;
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        await hydrateContext(session.user.id, setAgencyId, setRole, setClientAccess);
      } else {
        reset();
      }
      setLoading(false);
      setReady(true);
    })();

    const unsubscribe = onAuthChange((session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        void hydrateContext(session.user.id, setAgencyId, setRole, setClientAccess);
      } else {
        reset();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setUser, setAgencyId, setRole, setClientAccess, setLoading, reset]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bg-base">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }

  // Rutas públicas (sin auth): /login y portal cliente.
  const isPublicRoute = location.pathname === '/login' || location.pathname.startsWith('/client-portal/');
  if (requiresAuth && !user && !isPublicRoute) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

async function hydrateContext(
  userId: string,
  setAgencyId: (id: string | null) => void,
  setRole: (r: 'owner' | 'member' | null) => void,
  setClientAccess: (c: { clientId: string; accessLevel: 'viewer' | 'editor' } | null) => void,
): Promise<void> {
  try {
    const ctx = await resolveUserContext(userId);
    setRole(ctx.role);
    setAgencyId(ctx.agencyId);
    setClientAccess(ctx.clientAccess);
  } catch (e) {
    console.warn('[auth] No se pudo resolver el contexto del usuario', e);
    setRole('owner');
    setAgencyId(null);
    setClientAccess(null);
  }
}
