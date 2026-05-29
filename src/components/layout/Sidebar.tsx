import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Calendar,
  UsersRound,
  Settings,
  Sparkles,
  Package,
  Link as LinkIcon,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useClientStore } from '@/store/useClientStore';
import { healthFromMetrics } from '@/utils/metricsCalculator';

const nav = [
  { to: '/', label: 'Dashboard Macro', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clientes', icon: Users, end: false },
  { to: '/agenda', label: 'Agenda Global', icon: Calendar, end: false },
  { to: '/team', label: 'Equipo', icon: UsersRound, end: false },
  { to: '/settings', label: 'Configuración', icon: Settings, end: false },
];

const globalNav = [
  { to: '/repositorio/entregables', label: 'Entregables', icon: Package },
  { to: '/repositorio/links',       label: 'Links',       icon: LinkIcon },
  { to: '/agente-sop',              label: 'Agente SOP',  icon: ClipboardCheck },
];

export function Sidebar() {
  const clients = useClientStore((s) => s.clients);
  // Salud global del portafolio: peor estado entre clientes activos
  const worstHealth = clients.reduce<'green' | 'yellow' | 'red'>((acc, c) => {
    const h = healthFromMetrics(c.metrics.roas, c.metrics.progressPercent, c.metrics.pendingTasksToday);
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
    <aside className="flex w-64 flex-col bg-bg-surface border-r border-border-subtle">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border-subtle">
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
          <div className="heading text-sm font-bold leading-tight">SALES BRAIN</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Operating System</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-all focus-ring',
                isActive
                  ? 'bg-bg-elevated text-text-primary shadow-glow-accent/40 border border-border-default'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-2">
        <div className="text-[9px] uppercase tracking-[0.22em] text-text-muted px-3 mb-1.5">Repositorios globales</div>
        <div className="space-y-1">
          {globalNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[10px] px-3 py-2 text-xs transition-all focus-ring',
                  isActive
                    ? 'bg-bg-elevated text-text-primary border border-border-default'
                    : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
                )
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="m-3 surface p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('h-2 w-2 rounded-full', healthDot)} />
          <span className="text-[11px] uppercase tracking-wider text-text-muted">Salud global</span>
        </div>
        <div className="text-sm text-text-primary">{healthLabel}</div>
        <div className="text-[11px] text-text-muted mt-1">{clients.length} clientes activos</div>
      </div>
    </aside>
  );
}
