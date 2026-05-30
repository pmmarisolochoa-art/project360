import { Bell, Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { Button } from '@/components/ui/Button';

export function Header() {
  const user = useAppStore((s) => s.currentUser);
  const unread = useNotificationStore((s) => s.notifications.filter((n) => !n.isRead).length);

  return (
    <header
      className="h-16 flex items-center justify-between px-6 border-b backdrop-blur-md"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }}
    >
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="search"
            placeholder="Buscar cliente, tarea, reunión…"
            className="w-full h-10 pl-10 pr-3 rounded-[10px] border text-sm text-text-primary focus-ring"
            style={{
              background: 'var(--header-search-bg)',
              borderColor: 'var(--header-search-border)',
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link to="/onboarding">
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
            Nuevo cliente
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

        <div className="flex items-center gap-2.5 pl-3 border-l border-border-subtle">
          <div className="h-9 w-9 rounded-full bg-gradient-accent flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.[0] ?? 'U'}
          </div>
          <div className="text-right">
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
