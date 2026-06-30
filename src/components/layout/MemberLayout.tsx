import { Outlet, useNavigate } from 'react-router-dom';
import { Sparkles, LogOut } from 'lucide-react';
import { signOut } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { useClientStore } from '@/store/useClientStore';

/**
 * Layout para usuarios tipo MIEMBRO (equipo/cliente — Capa 3).
 * Barra superior mínima, sin sidebar de agencia: el miembro solo ve
 * el cerebro de SU cliente. Toda la navegación entre módulos vive
 * dentro de ClientBrainPage (BrainNav).
 */
export function MemberLayout() {
  const navigate = useNavigate();
  const reset = useAuthStore((s) => s.reset);
  const accessLevel = useAuthStore((s) => s.clientAccess?.accessLevel);
  const clientId = useAuthStore((s) => s.clientAccess?.clientId);
  const client = useClientStore((s) => s.clients.find((c) => c.id === clientId));

  const handleLogout = async () => {
    await signOut();
    reset();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full flex-col bg-bg-base text-text-primary">
      <header
        className="flex items-center justify-between gap-3 px-5 py-3 border-b"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-accent shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="heading text-sm font-bold leading-tight truncate">
              {client?.name ?? 'Tu espacio'}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
              {accessLevel === 'viewer' ? 'Vista de seguimiento' : 'Espacio de equipo'} · Project360
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40 transition focus-ring"
        >
          <LogOut className="h-3.5 w-3.5" /> Salir
        </button>
      </header>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
