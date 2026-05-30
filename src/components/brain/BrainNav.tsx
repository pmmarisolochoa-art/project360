import { NavLink, useParams } from 'react-router-dom';
import {
  User, ClipboardList, TrendingUp, BarChart2, CheckSquare,
  Target, Calendar, Film, Users,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { withAlpha } from '@/utils/colorGenerator';

export interface ModuleDef {
  slug: string;
  label: string;
  fullLabel: string;
  icon: typeof User;
  index: number;
}

export const BRAIN_MODULES: ModuleDef[] = [
  { slug: 'profile',     label: 'Perfil',      fullLabel: 'Perfil & Inteligencia',  icon: User,          index: 1 },
  { slug: 'planning',    label: 'Planeación',  fullLabel: 'Planeación del proyecto',icon: ClipboardList, index: 2 },
  { slug: 'projections', label: 'Proyección',  fullLabel: 'Proyección financiera',  icon: TrendingUp,    index: 3 },
  { slug: 'metrics',     label: 'Métricas',    fullLabel: 'Métricas & Campañas',    icon: BarChart2,     index: 4 },
  { slug: 'tasks',       label: 'Tareas',      fullLabel: 'Tareas & Seguimiento',   icon: CheckSquare,   index: 5 },
  { slug: 'ropre',       label: 'ROPRE',       fullLabel: 'Sistema ROPRE',          icon: Target,        index: 6 },
  { slug: 'meetings',    label: 'Agenda',      fullLabel: 'Agenda & Reuniones',     icon: Calendar,      index: 7 },
  { slug: 'content',     label: 'Contenido',   fullLabel: 'Contenido & Redes',      icon: Film,          index: 8 },
  { slug: 'team',        label: 'Equipo',      fullLabel: 'Equipo & KPIs',          icon: Users,         index: 9 },
];

export function BrainNav({ accent }: { accent: string }) {
  const { id } = useParams();

  return (
    <nav className="sticky top-0 z-20 bg-bg-base/85 backdrop-blur-md border-b border-border-subtle">
      <div className="max-w-[1600px] mx-auto px-3 lg:px-4">
        <ul className="flex items-stretch gap-0.5 py-2 overflow-hidden">
          {BRAIN_MODULES.map((m) => (
            <li key={m.slug} className="flex-1 min-w-0">
              <NavLink
                to={`/client/${id}/${m.slug}`}
                title={m.fullLabel}
                className={({ isActive }) =>
                  cn(
                    'group w-full inline-flex items-center justify-center gap-1 rounded-[8px] px-2 py-1.5 text-[10px] whitespace-nowrap transition-all focus-ring',
                    isActive ? 'font-semibold' : 'text-text-secondary hover:text-text-primary',
                  )
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: withAlpha(accent, 0.18),
                        boxShadow: `inset 0 -2px 0 ${accent}`,
                        color: 'var(--text-primary)',
                      }
                    : undefined
                }
              >
                <m.icon className="h-3 w-3 shrink-0" />
                <span className="font-medium truncate">{m.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
