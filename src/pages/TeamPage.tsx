import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users as UsersIcon, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useClientStore } from '@/store/useClientStore';
import { useTeamStore } from '@/store/useTeamStore';
import { ROLE_DEFS, evaluateKpi, type TeamRoleSlug, type KpiHealth } from '@/types/team';
import { Badge } from '@/components/ui/Badge';

const HEALTH_COLOR: Record<KpiHealth, string> = {
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
};

export function TeamPage() {
  const clients = useClientStore((s) => s.clients);
  const ensureForClient = useTeamStore((s) => s.ensureForClient);
  const assignments = useTeamStore((s) => s.assignments);
  const weeklyCompliance = useTeamStore((s) => s.weeklyCompliance);
  const [selectedRole, setSelectedRole] = useState<TeamRoleSlug | 'all'>('all');

  useEffect(() => {
    clients.forEach((c) => ensureForClient(c.id));
  }, [clients, ensureForClient]);

  const roleStats = useMemo(() => {
    return ROLE_DEFS.map((role) => {
      const roleAssignments = assignments.filter((a) => a.roleSlug === role.slug);
      let green = 0, yellow = 0, red = 0;
      roleAssignments.forEach((a) => {
        role.kpis.forEach((k) => {
          const v = a.kpiValues[k.key];
          if (v === undefined) return;
          const h = evaluateKpi(v, k);
          if (h === 'green') green++;
          else if (h === 'yellow') yellow++;
          else red++;
        });
      });
      const total = green + yellow + red;
      const healthPct = total === 0 ? 0 : Math.round(((green + yellow * 0.5) / total) * 100);
      const bottlenecks = roleAssignments.filter((a) => a.bottleneck.trim().length > 0);
      return { role, healthPct, green, yellow, red, bottlenecks, count: roleAssignments.length };
    });
  }, [assignments]);

  const overallHealth = useMemo(() => {
    const totals = roleStats.reduce(
      (acc, r) => ({ g: acc.g + r.green, y: acc.y + r.yellow, r: acc.r + r.red }),
      { g: 0, y: 0, r: 0 },
    );
    const total = totals.g + totals.y + totals.r;
    return total === 0 ? 0 : Math.round(((totals.g + totals.y * 0.5) / total) * 100);
  }, [roleStats]);

  const allBottlenecks = useMemo(() => {
    return assignments
      .filter((a) => a.bottleneck.trim().length > 0)
      .map((a) => {
        const role = ROLE_DEFS.find((r) => r.slug === a.roleSlug)!;
        const client = clients.find((c) => c.id === a.clientId);
        return { role, client, assignment: a };
      })
      .filter((x) => x.client);
  }, [assignments, clients]);

  const complianceData = useMemo(() => {
    const weeks = ['Sem -3', 'Sem -2', 'Sem -1', 'Esta sem'];
    return weeks.map((label, w) => {
      const point: Record<string, string | number> = { week: label };
      ROLE_DEFS.forEach((r) => {
        point[r.title] = weeklyCompliance[r.slug][w] ?? 0;
      });
      return point;
    });
  }, [weeklyCompliance]);

  const filteredRoleStats = selectedRole === 'all' ? roleStats : roleStats.filter((r) => r.role.slug === selectedRole);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-1.5">
          Equipo · Vista global
        </div>
        <h1 className="heading text-3xl lg:text-4xl font-bold">
          <span className="gradient-text">Equipo</span> de la agencia
        </h1>
        <p className="text-sm text-text-secondary mt-1.5">
          {ROLE_DEFS.length} roles · {clients.length} clientes asignados · salud agregada {overallHealth}%
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={<UsersIcon className="h-4 w-4" />} label="Salud global" value={`${overallHealth}%`} tone={overallHealth >= 80 ? 'success' : overallHealth >= 60 ? 'warning' : 'danger'} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Bloqueos activos" value={allBottlenecks.length.toString()} tone={allBottlenecks.length === 0 ? 'success' : 'warning'} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Asignaciones" value={assignments.length.toString()} tone="info" />
      </div>

      <section className="surface p-5">
        <h2 className="heading text-base font-semibold mb-3">Cumplimiento semanal por rol</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={complianceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="week" stroke="var(--chart-axis)" style={{ fontSize: '11px' }} />
              <YAxis stroke="var(--chart-axis)" style={{ fontSize: '11px' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12, color: 'var(--chart-tooltip-text)' }} />
              {ROLE_DEFS.map((r, i) => {
                const colors = ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
                return <Bar key={r.slug} dataKey={r.title} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} />;
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedRole('all')}
          className={`h-8 px-3 rounded-md border text-xs ${selectedRole === 'all' ? 'border-accent-violet bg-accent-violet/10 text-text-primary' : 'border-border-subtle text-text-muted hover:text-text-primary'}`}
        >
          Todos los roles
        </button>
        {ROLE_DEFS.map((r) => (
          <button
            key={r.slug}
            onClick={() => setSelectedRole(r.slug)}
            className={`h-8 px-3 rounded-md border text-xs ${selectedRole === r.slug ? 'border-accent-violet bg-accent-violet/10 text-text-primary' : 'border-border-subtle text-text-muted hover:text-text-primary'}`}
          >
            {r.title}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filteredRoleStats.map((r, i) => (
          <motion.div
            key={r.role.slug}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="surface p-5"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="heading text-base font-semibold">{r.role.title}</h3>
                <p className="text-[11px] text-text-muted">{r.role.fullTitle}</p>
              </div>
              <Badge tone={r.healthPct >= 80 ? 'success' : r.healthPct >= 60 ? 'warning' : 'danger'}>
                {r.healthPct}% salud
              </Badge>
            </div>

            <div className="flex items-center gap-3 mb-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR.green }} />
                {r.green} ok
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR.yellow }} />
                {r.yellow} alerta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR.red }} />
                {r.red} crítico
              </span>
              <span className="text-text-muted ml-auto">{r.count} asignaciones</span>
            </div>

            {r.bottlenecks.length > 0 && (
              <div className="rounded-md border border-status-warning/30 bg-status-warning/10 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-status-warning mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Bloqueos ({r.bottlenecks.length})
                </div>
                <ul className="space-y-1">
                  {r.bottlenecks.slice(0, 3).map((b) => {
                    const c = clients.find((x) => x.id === b.clientId);
                    return (
                      <li key={`${b.clientId}-${b.roleSlug}`} className="text-[11px] text-text-secondary">
                        <span className="text-text-primary font-medium">{c?.name}</span>: {b.bottleneck}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <details className="mt-3">
              <summary className="text-[11px] text-text-muted cursor-pointer hover:text-text-primary">
                Ver funciones y KPIs del rol
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Funciones</div>
                  <ul className="space-y-0.5 text-[11px] text-text-secondary list-disc pl-4">
                    {r.role.functions.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">KPIs ({r.role.kpis.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {r.role.kpis.map((k) => (
                      <span key={k.key} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-text-secondary">
                        {k.label}: {k.target}{k.unit ?? ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </motion.div>
        ))}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'success' | 'warning' | 'danger' | 'info' }) {
  const colors: Record<typeof tone, string> = {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
  };
  return (
    <div className="surface p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-md flex items-center justify-center" style={{ background: `${colors[tone]}20`, color: colors[tone] }}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
        <div className="text-xl font-bold text-text-primary leading-tight">{value}</div>
      </div>
    </div>
  );
}
