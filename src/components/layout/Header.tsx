import { Bell, Plus, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { Button } from '@/components/ui/Button';
import { GlobalSearch } from '@/components/search/GlobalSearch';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useAppStore((s) => s.currentUser);
  const unread = useNotificationStore((s) => s.notifications.filter((n) => !n.isRead).length);

  return (
    <header
      className="relative z-30 h-16 flex items-center justify-between gap-2 px-3 sm:px-6 border-b backdrop-blur-md"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0 max-w-md">
        {/* Hamburguesa — solo móvil */}
        <button
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="lg:hidden h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition focus-ring"
        >
          <Menu className="h-5 w-5" />
        </button>
        <GlobalSearch className="flex-1 min-w-0" />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link to="/onboarding">
          {/* Texto completo en ≥sm; solo ícono en móvil */}
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} className="hidden sm:inline-flex">
            Nuevo cliente
          </Button>
          <Button size="sm" aria-label="Nuevo cliente" className="sm:hidden px-2.5">
            <Plus className="h-4 w-4" />
          </Button>
        </Link>

        <button
          aria-label="Notificaciones"
          className="relative h-10 w-10 inline-flex items-center justify-center rounded-[10px] bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition focus-ring"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-status-danger text-[10px] font-bold text-white flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2.5 sm:pl-3 sm:border-l border-border-subtle">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-accent flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.[0] ?? 'U'}
          </div>
          <div className="text-right hidden md:block">
            <div className="text-sm text-text-primary leading-tight">{user?.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              {user?.role === 'owner' ? 'Estratega Principal' : user?.role}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
