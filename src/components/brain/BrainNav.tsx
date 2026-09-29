import { Link, useParams } from 'react-router-dom';
import {
  User, TrendingUp, BarChart2, CheckSquare,
  Calendar, Users, Rocket, Compass, LayoutGrid, DollarSign, Wallet,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { withAlpha } from '@/utils/colorGenerator';
import { useAuthStore } from '@/store/useAuthStore';
import { memberAllowedSlugs } from '@/config/departments';

/**
 * Módulos que un MIEMBRO puede ver dentro de un cliente (el resto es interno del owner).
 * ROPRE salió de aquí el 28-sep-2026: dejó de ser un módulo navegable — vive solo
 * como Informe ROPRE dentro de Reportes (mismo cambio para owner y miembro).
 */
export const MEMBER_MODULE_SLUGS = ['profile', 'tasks', 'meetings', 'team'];

export interface ModuleDef {
  slug: string;
  label: string;
  fullLabel: string;
  icon: typeof User;
  index: number;
}

export const BRAIN_MODULES: ModuleDef[] = [
  { slug: 'profile',     label: 'Perfil',      fullLabel: 'Perfil & Inteligencia',  icon: User,          index: 1 },
  { slug: 'projections', label: 'Proyección',  fullLabel: 'Proyección financiera',  icon: TrendingUp,    index: 2 },
  { slug: 'tasks',       label: 'Tareas',      fullLabel: 'Tareas & Seguimiento',   icon: CheckSquare,   index: 3 },
  { slug: 'meetings',    label: 'Agenda',      fullLabel: 'Agenda & Reuniones',     icon: Calendar,      index: 4 },
  { slug: 'team',        label: 'Equipo',      fullLabel: 'Equipo & KPIs',          icon: Users,         index: 5 },
  { slug: 'programs',    label: 'Programas',   fullLabel: 'Programas del cliente',  icon: Rocket,        index: 6 },
  { slug: 'ventas',      label: 'Ventas',      fullLabel: 'Pipeline de Ventas',     icon: DollarSign,    index: 7 },
  { slug: 'metrics',     label: 'Métricas',    fullLabel: 'Métricas & Campañas',    icon: BarChart2,     index: 8 },
  { slug: 'finanzas',    label: 'Finanzas',    fullLabel: 'Finanzas del cliente',   icon: Wallet,        index: 9 },
  // OCULTO BETA — reactivar en v2. El módulo Contenido sigue existiendo (ContentModule.tsx)
  // y su ruta funciona por navegación directa; solo se quita del nav durante el beta.
  // { slug: 'content',     label: 'Contenido',   fullLabel: 'Contenido & Redes',      icon: Film,          index: 10 },
];

/**
 * Los seis cajones (founder, 24-sep-2026): agrupan los módulos de arriba para que
 * el nav deje de ser una fila plana. `slugs` define QUÉ módulos caen en cada
 * cajón y en qué orden aparecen sus sub-tabs — la fuente de verdad sigue siendo
 * `BRAIN_MODULES` (icono, label, ruta); esto solo agrupa.
 */
export interface CajonDef {
  id: string;
  label: string;
  icon: typeof User;
  slugs: string[];
}

export const CAJONES: CajonDef[] = [
  { id: 'planeacion', label: 'Planeación', icon: Compass,    slugs: ['profile', 'projections'] },
  { id: 'management',  label: 'Management', icon: LayoutGrid, slugs: ['tasks', 'meetings', 'team', 'programs'] },
  { id: 'ventas',      label: 'Ventas',      icon: DollarSign, slugs: ['ventas'] },
  { id: 'metricas',    label: 'Métricas',    icon: BarChart2,  slugs: ['metrics'] },
  { id: 'finanzas',    label: 'Finanzas',    icon: Wallet,     slugs: ['finanzas'] },
  // 'content' oculto en beta — mismo criterio que en BRAIN_MODULES.
];

/** Fila de pestañas — reusada para los cajones (nivel 1) y los sub-módulos (nivel 2). */
function TabRow({
  items, accent, dense = false,
}: {
  items: Array<{ key: string; to: string; label: string; fullLabel: string; icon: typeof User; active: boolean }>;
  accent: string;
  dense?: boolean;
}) {
  return (
    <ul className={cn('flex items-stretch gap-0.5', dense ? 'py-1.5' : 'py-2')}>
      {items.map((it) => (
        <li key={it.key} className="flex-1 min-w-0">
          <Link
            to={it.to}
            title={it.fullLabel}
            className={cn(
              'group w-full inline-flex items-center justify-center gap-1 rounded-[8px] px-2 whitespace-nowrap transition-all focus-ring',
              dense ? 'py-1 text-[9.5px]' : 'py-1.5 text-[10px]',
              it.active ? 'font-semibold' : 'text-text-secondary hover:text-text-primary',
            )}
            style={
              it.active
                ? {
                    background: withAlpha(accent, dense ? 0.14 : 0.18),
                    boxShadow: dense ? undefined : `inset 0 -2px 0 ${accent}`,
                    color: 'var(--text-primary)',
                  }
                : undefined
            }
          >
            <it.icon className={cn('shrink-0', dense ? 'h-3 w-3' : 'h-4 w-4 md:h-3 md:w-3')} />
            {/* Móvil: solo íconos (parejos). Nombres desde md+. */}
            <span className="font-medium truncate hidden md:inline">{it.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BrainNav({ accent }: { accent: string }) {
  const { id, module } = useParams();
  const isMember = useAuthStore((s) => s.role === 'member');
  const accesses = useAuthStore((s) => s.clientAccesses);

  // El owner ve todos los módulos. El miembro ve la UNIÓN de los módulos de sus
  // departamentos en ESTE cliente. Sin departamentos asignados → set de miembro
  // por defecto (comportamiento previo, no rompe a nadie).
  let visibleSlugs = new Set(BRAIN_MODULES.map((m) => m.slug));
  if (isMember) {
    const access = id ? accesses.find((a) => a.clientId === id) : accesses[0];
    visibleSlugs = memberAllowedSlugs(access?.departamentos ?? [], MEMBER_MODULE_SLUGS);
  }
  const moduleBySlug = new Map(BRAIN_MODULES.map((m) => [m.slug, m]));

  // Cada cajón se recorta a los módulos que esta persona puede ver; uno sin
  // ninguno visible (ej. un miembro sin acceso a Ventas) desaparece del todo.
  const cajones = CAJONES
    .map((c) => ({ ...c, slugs: c.slugs.filter((s) => visibleSlugs.has(s) && moduleBySlug.has(s)) }))
    .filter((c) => c.slugs.length > 0);

  const activeCajon = cajones.find((c) => c.slugs.includes(module ?? '')) ?? cajones[0];

  const cajonItems = cajones.map((c) => ({
    key: c.id,
    to: `/client/${id}/${c.slugs[0]}`,
    label: c.label,
    fullLabel: c.label,
    icon: c.icon,
    active: c.id === activeCajon?.id,
  }));

  const subItems = (activeCajon && activeCajon.slugs.length > 1)
    ? activeCajon.slugs.map((slug) => {
        const m = moduleBySlug.get(slug)!;
        return {
          key: m.slug,
          to: `/client/${id}/${m.slug}`,
          label: m.label,
          fullLabel: m.fullLabel,
          icon: m.icon,
          active: m.slug === module,
        };
      })
    : null;

  return (
    <nav className="sticky top-0 z-20 bg-bg-base/85 backdrop-blur-md border-b border-border-subtle">
      <div className="max-w-[1600px] mx-auto px-3 lg:px-4">
        <TabRow items={cajonItems} accent={accent} />
        {subItems && (
          <div className="border-t border-border-subtle/70">
            <TabRow items={subItems} accent={accent} dense />
          </div>
        )}
      </div>
    </nav>
  );
}
