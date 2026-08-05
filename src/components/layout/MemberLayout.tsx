import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { Sparkles, LogOut, LayoutGrid, Sun, Moon } from 'lucide-react';
import { signOut } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { BRAND } from '@/config/brand';
import { GlobalSearch } from '@/components/search/GlobalSearch';

/**
 * Layout para usuarios tipo MIEMBRO (equipo — Capa 1, multi-cliente).
 * Barra superior mínima con acceso a "Mi espacio" (dashboard personal) y
 * salir. El miembro no ve la operación de agencia; navega su propio trabajo
 * y, desde ahí, entra a los cerebros de sus clientes.
 */
export function MemberLayout() {
  const navigate = useNavigate();
  const reset = useAuthStore((s) => s.reset);
  const email = useAuthStore((s) => s.user?.email);
  const name = useAuthStore((s) => s.clientAccesses[0]?.nombre);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

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
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-accent shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="heading text-sm font-bold leading-tight">{BRAND.name}</div>
          </div>
          <NavLink
            to="/mi-espacio"
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs transition ${
                isActive ? 'bg-bg-elevated/60 text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary'
              }`
            }
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Mi espacio
          </NavLink>
        </div>
        <GlobalSearch className="hidden md:block flex-1 max-w-md" />
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-right min-w-0 hidden sm:block">
            <div className="text-xs text-text-primary truncate max-w-[180px]">{name || email}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Equipo</div>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
            className="inline-flex items-center justify-center h-9 w-9 rounded-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40 transition focus-ring"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated/40 transition focus-ring"
          >
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
