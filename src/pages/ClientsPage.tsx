import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, Grid3x3, List as ListIcon } from 'lucide-react';
import { useClientStore } from '@/store/useClientStore';
import { ClientCard } from '@/components/dashboard/ClientCard';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { ClientStatus, ProjectType } from '@/types/client';

const STATUS_LABEL: Record<ClientStatus, string> = {
  onboarding: 'Onboarding',
  planning: 'Planificación',
  active: 'Activo',
  paused: 'En pausa',
  completed: 'Completado',
};

const STATUS_TONE: Record<ClientStatus, 'neutral' | 'success' | 'warning' | 'info' | 'accent'> = {
  onboarding: 'info',
  planning: 'accent',
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
};

const PROJECT_LABEL: Record<ProjectType, string> = {
  ecommerce: 'E-commerce',
  launch: 'Lanzamiento',
  evergreen: 'Evergreen',
  personal_brand: 'Marca personal',
  other: 'Otro',
};

export function ClientsPage() {
  const navigate = useNavigate();
  const clients = useClientStore((s) => s.clients);
  const tasks = useClientStore((s) => s.tasks);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fProject, setFProject] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !c.industry.toLowerCase().includes(q.toLowerCase())) return false;
        if (fStatus && c.status !== fStatus) return false;
        if (fProject && c.projectType !== fProject) return false;
        return true;
      }),
    [clients, q, fStatus, fProject],
  );

  const totalPending = useMemo(
    () => tasks.filter((t) => t.status !== 'completed').length,
    [tasks],
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-1.5">
            Portafolio · Vista global
          </div>
          <h1 className="heading text-3xl lg:text-4xl font-bold">
            <span className="gradient-text">Clientes</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1.5">
            {clients.length} cerebros · {totalPending} tareas pendientes en total
          </p>
        </div>
        <Link to="/onboarding">
          <Button>
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        </Link>
      </header>

      <div className="surface p-3 flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o industria…"
            className="pl-9"
          />
        </div>
        <Select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className="min-w-[160px]"
          options={[
            { value: '', label: 'Todos los estados' },
            ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })),
          ]}
        />
        <Select
          value={fProject}
          onChange={(e) => setFProject(e.target.value)}
          className="min-w-[180px]"
          options={[
            { value: '', label: 'Todos los proyectos' },
            ...Object.entries(PROJECT_LABEL).map(([v, l]) => ({ value: v, label: l })),
          ]}
        />
        <div className="inline-flex rounded-md border border-border-default overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={`h-9 px-3 inline-flex items-center gap-1.5 text-xs ${view === 'grid' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Grid3x3 className="h-3.5 w-3.5" /> Grid
          </button>
          <button
            onClick={() => setView('list')}
            className={`h-9 px-3 inline-flex items-center gap-1.5 text-xs border-l border-border-default ${view === 'list' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            <ListIcon className="h-3.5 w-3.5" /> Lista
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface p-10 text-center text-sm text-text-muted">
          Sin clientes con esos filtros.
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <ClientCard key={c.id} client={c} index={i} />
          ))}
        </div>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted border-b border-border-default bg-bg-elevated/40">
                <th className="py-2 pl-4 pr-3">Cliente</th>
                <th className="py-2 pr-3">Industria</th>
                <th className="py-2 pr-3">Proyecto</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3 text-right">ROAS</th>
                <th className="py-2 pr-3 text-right">Tareas hoy</th>
                <th className="py-2 pr-3 text-right">Avance</th>
                <th className="py-2 pr-4 text-right">Inv. mes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/client/${c.id}`)}
                  className="border-b border-border-subtle/30 cursor-pointer hover:bg-bg-elevated/20"
                >
                  <td className="py-2.5 pl-4 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.primaryColor }} />
                      <span className="text-text-primary font-medium">{c.name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-text-secondary">{c.industry}</td>
                  <td className="py-2.5 pr-3 text-xs text-text-secondary">{PROJECT_LABEL[c.projectType]}</td>
                  <td className="py-2.5 pr-3"><Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge></td>
                  <td className="py-2.5 pr-3 text-xs text-right text-text-primary">{c.metrics.roas?.toFixed(2) ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-xs text-right text-text-primary">{c.metrics.pendingTasksToday}</td>
                  <td className="py-2.5 pr-3 text-xs text-right text-text-primary">{c.metrics.progressPercent}%</td>
                  <td className="py-2.5 pr-4 text-xs text-right text-text-primary">
                    ${(c.metrics.invertedThisMonth ?? c.monthlyAdsBudget).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-text-muted">
        {filtered.length} de {clients.length} cliente{clients.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}
