import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CheckSquare,
  UserCheck,
  FolderOpen,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { BRAND } from '@/config/brand';
import { useClientStore } from '@/store/useClientStore';
import { useAuthStore, administra } from '@/store/useAuthStore';
import { avanceForClient } from '@/utils/avance';
import { healthFromMetrics } from '@/utils/metricsCalculator';
import { isActiveClient } from '@/types/client';

/**
 * Capa 0 — navegación de la agencia. EXACTAMENTE 7 ítems, sin secciones extra.
 *
 * Lo que se fue y a dónde:
 *  · "Repositorios Globales" (Entregables + Links) → fusionado en /links-entregables
 *  · "Agente SOP"                                  → vive dentro de Configuración
 *  · Acceso directo al Espacio de Agencia          → se entra por Clientes
 */
const nav = [
  { to: '/dashboard',        label: 'Dashboard',           icon: LayoutDashboard, end: false },
  { to: '/clientes',         label: 'Clientes',            icon: Users,           end: false },
  { to: '/agenda-global',    label: 'Agenda Global',       icon: CalendarDays,    end: false },
  { to: '/tareas',           label: 'Tareas',              icon: CheckSquare,     end: false },
  { to: '/equipo',           label: 'Equipo',              icon: UserCheck,       end: false },
  { to: '/links-entregables',label: 'Links y Entregables', icon: FolderOpen,      end: false },
  { to: '/configuracion',    label: 'Configuración',       icon: Settings,        end: false },
];

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const clients = useClientStore((s) => s.clients);
  const tasks = useClientStore((s) => s.tasks);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  // Dirección no ve Configuración: eso es administrar la cuenta (llaves de API,
  // integraciones), no dirigir el negocio. La ruta tampoco existe para ellos
  // —ver AppRouter—, así que esconder el enlace no es la única barrera.
  const navItems = administra(role) ? nav : nav.filter((n) => n.to !== '/configuracion');

  // Nombre visible: lo que haya antes de la @ del correo, capitalizado.
  const handle = (user?.email ?? '').split('@')[0] ?? '';
  const userName = handle
    ? handle.charAt(0).toUpperCase() + handle.slice(1)
    : 'Sin sesión';
  const userInitials = (userName.match(/\b[A-Za-zÁÉÍÓÚÑ]/g) ?? ['?']).slice(0, 2).join('').toUpperCase();
  // Salud global del portafolio: peor estado entre clientes reales (sin agencia).
  const worstHealth = clients.reduce<'green' | 'yellow' | 'red'>((acc, c) => {
    if (c.isAgency) return acc;
    const h = healthFromMetrics(c.metrics.roas, avanceForClient(tasks, c.id), c.metrics.pendingTasksToday);
    if (h === 'red') return 'red';
    if (h === 'yellow' && acc !== 'red') return 'yellow';
    return acc;
  }, 'green');

  const healthDot = {
    green: 'bg-status-success shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    yellow: 'bg-status-warning shadow-[0_0_12px_rgba(245,158,11,0.6)]',
    red: 'bg-status-danger shadow-[0_0_12px_rgba(239,68,68,0.6)]',
  }[worstHealth];

  const healthLabel = {
    green: 'Portafolio saludable',
    yellow: 'Atención requerida',
    red: 'Acción urgente',
  }[worstHealth];

  return (
    <>
      {/* Backdrop — solo móvil, cuando el menú está abierto */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={cn(
          'flex w-64 flex-col border-r z-50',
          // Móvil: cajón deslizable fijo. Escritorio (lg+): columna fija normal.
          'fixed inset-y-0 left-0 transform transition-transform duration-200 lg:static lg:transform-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      >
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-lg bg-gradient-accent blur-md opacity-60" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-accent">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        </motion.div>
        <div>
          <div className="heading text-sm font-bold leading-tight">{BRAND.name}</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted">{BRAND.subtitle}</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-all focus-ring',
                isActive ? 'font-medium' : 'text-text-secondary hover:text-text-primary',
              )
            }
            style={({ isActive }) =>
              isActive
                ? { background: 'var(--sidebar-item-active-bg)', color: 'var(--sidebar-item-active-text)' }
                : undefined
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="m-3 surface p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('h-2 w-2 rounded-full', healthDot)} />
          <span className="text-[11px] uppercase tracking-wider text-text-muted">Salud global</span>
        </div>
        <div className="text-sm text-text-primary">{healthLabel}</div>
        <div className="text-[11px] text-text-muted mt-1">{clients.filter(isActiveClient).length} clientes activos</div>
      </div>

      {/* Pie: quién está logueado. */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-t"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-accent text-[11px] font-bold text-white">
          {userInitials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-text-primary">{userName}</div>
          <div className="text-[10px] text-text-muted">{role === 'owner' ? 'Dueña de agencia' : 'Equipo'}</div>
        </div>
      </div>
      </aside>
    </>
  );
}
