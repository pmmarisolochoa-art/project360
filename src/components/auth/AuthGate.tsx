import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getCurrentSession, onAuthChange, requiresAuth } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/services/supabase';

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
        await hydrateAgencyId(session.user.id, setAgencyId);
      } else {
        reset();
      }
      setLoading(false);
      setReady(true);
    })();

    const unsubscribe = onAuthChange((session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        void hydrateAgencyId(session.user.id, setAgencyId);
      } else {
        reset();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setUser, setAgencyId, setLoading, reset]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bg-base">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (requiresAuth && !user && location.pathname !== '/login') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

async function hydrateAgencyId(userId: string, setAgencyId: (id: string | null) => void): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('agencies')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    setAgencyId(data?.id ?? null);
  } catch (e) {
    console.warn('[auth] No se pudo cargar agency_id', e);
    setAgencyId(null);
  }
}
