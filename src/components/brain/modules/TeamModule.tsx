import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Pencil, Save, X, AlertTriangle, TrendingUp, TrendingDown, Minus, Trophy,
  Briefcase, Megaphone, Wand2, Palette, Users as UsersIcon, Wrench, Film, PhoneCall, HeartHandshake,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip as RTooltip, Legend,
} from 'recharts';
import type { Client } from '@/types/client';
import type { KpiDef, KpiHealth, RoleAssignment, RoleDef, TeamRoleSlug } from '@/types/team';
import { ROLE_DEFS, evaluateKpi, progressToTarget } from '@/types/team';
import { useTeamStore } from '@/store/useTeamStore';
import { useClientStore } from '@/store/useClientStore';
import { toast } from '@/store/useToastStore';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';

const HEALTH_STYLE: Record<KpiHealth, { bg: string; text: string; ring: string }> = {
  green:  { bg: 'rgba(16,185,129,0.15)', text: '#10B981', ring: 'rgba(16,185,129,0.4)' },
  yellow: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', ring: 'rgba(245,158,11,0.4)' },
  red:    { bg: 'rgba(239,68,68,0.15)',  text: '#EF4444', ring: 'rgba(239,68,68,0.4)' },
};

const ROLE_ICON: Record<TeamRoleSlug, typeof Briefcase> = {
  project_manager: Briefcase,
  strategist: Briefcase,
  media_buyer: Megaphone,
  copywriter: Wand2,
  designer: Palette,
  community: UsersIcon,
  funnel_builder: Wrench,
  editor: Film,
  closer: PhoneCall,
  onboarding: HeartHandshake,
};

export function TeamModule({ client }: { client: Client }) {
  const accent = client.primaryColor;
  const ensureForClient = useTeamStore((s) => s.ensureForClient);
  const allAssignments = useTeamStore((s) => s.assignments);
  const tasks = useClientStore((s) => s.tasks);

  useEffect(() => { ensureForClient(client.id); }, [client.id, ensureForClient]);

  const assignments = useMemo(
    () => allAssignments.filter((a) => a.clientId === client.id),
    [allAssignments, client.id],
  );

  return (
    <div className="space-y-4">
      <GlobalDashboard
        client={client}
        assignments={assignments}
        tasks={tasks.filter((t) => t.clientId === client.id)}
        accent={accent}
      />
      <div className="space-y-3">
        {ROLE_DEFS.map((def) => {
          const assignment = assignments.find((a) => a.roleSlug === def.slug);
          if (!assignment) return null;
          return (
            <RoleCard
              key={def.slug}
              def={def}
              assignment={assignment}
              accent={accent}
              tasks={tasks.filter((t) => t.clientId === client.id && t.assignedTo === assignment.memberName)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Dashboard global del equipo ───────────────────────── */

function GlobalDashboard({
  client, assignments, tasks, accent,
}: {
  client: Client;
  assignments: RoleAssignment[];
  tasks: Array<{ id: string; status: string; isDelayed: boolean; assignedTo: string }>;
  accent: string;
}) {
  const weekly = useTeamStore((s) => s.weeklyCompliance);

  const roleHealth = useMemo(() => {
    return ROLE_DEFS.map((def) => {
      const a = assignments.find((x) => x.roleSlug === def.slug);
      if (!a) return { def, health: 'red' as KpiHealth, score: 0 };
      const evals = def.kpis.map((k) => evaluateKpi(a.kpiValues[k.key] ?? 0, k));
      const score = (evals.filter((e) => e === 'green').length / def.kpis.length) * 100;
      const reds = evals.filter((e) => e === 'red').length;
      const yellows = evals.filter((e) => e === 'yellow').length;
      const health: KpiHealth = reds >= 2 ? 'red' : reds === 1 || yellows >= 3 ? 'yellow' : 'green';
      return { def, assignment: a, health, score };
    });
  }, [assignments]);

  const teamComplianceRate = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'completed').length;
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }, [tasks]);

  const activeBottlenecks = assignments
    .filter((a) => a.bottleneck.trim().length > 0)
    .map((a) => ({
      role: ROLE_DEFS.find((r) => r.slug === a.roleSlug)!,
      member: a.memberName,
      text: a.bottleneck,
    }));

  // Miembro con más carga activa (más tareas no completadas asignadas).
  const memberLoad = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.status === 'completed') continue;
      counts.set(t.assignedTo, (counts.get(t.assignedTo) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null;
  }, [tasks]);

  // Miembro con peor cumplimiento (menos % tareas completadas).
  const worstMember = useMemo(() => {
    const stats = new Map<string, { done: number; total: number }>();
    for (const t of tasks) {
      const s = stats.get(t.assignedTo) ?? { done: 0, total: 0 };
      s.total++;
      if (t.status === 'completed') s.done++;
      stats.set(t.assignedTo, s);
    }
    let worst: { name: string; rate: number } | null = null;
    for (const [name, s] of stats.entries()) {
      if (s.total < 3) continue; // ignora miembros con muy pocas tareas
      const rate = s.done / s.total;
      if (!worst || rate < worst.rate) worst = { name, rate: Math.round(rate * 100) };
    }
    return worst;
  }, [tasks]);

  // Datos para gráfica de cumplimiento por rol (últimas 4 semanas)
  const chartData = ['Sem -3', 'Sem -2', 'Sem -1', 'Actual'].map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const def of ROLE_DEFS) {
      row[def.title] = weekly[def.slug][i] ?? 0;
    }
    return row;
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Avatares con salud */}
      <div className="surface p-5 xl:col-span-2">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h3 className="heading text-base font-bold">Salud del equipo · {client.name}</h3>
            <p className="text-[11px] text-text-muted">{ROLE_DEFS.length} roles · semáforo según KPIs del rol</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Cumplimiento global</div>
            <div className="kpi-number" style={{ color: accent }}>{teamComplianceRate}%</div>
          </div>
        </header>

        {/* Mini-stats: carga y peor cumplimiento */}
        {(memberLoad || worstMember || activeBottlenecks.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            {memberLoad && (
              <div className="rounded-md border border-border-subtle bg-bg-base/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Mayor carga activa</div>
                <div className="text-xs text-text-primary mt-0.5"><strong>{memberLoad.name}</strong> · {memberLoad.count} tarea{memberLoad.count === 1 ? '' : 's'}</div>
              </div>
            )}
            {worstMember && (
              <div className="rounded-md border border-status-danger/30 bg-status-danger/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-status-danger">Peor cumplimiento</div>
                <div className="text-xs text-text-primary mt-0.5"><strong>{worstMember.name}</strong> · {worstMember.rate}% completado</div>
              </div>
            )}
            {activeBottlenecks.length > 0 && (
              <div className="rounded-md border border-status-warning/30 bg-status-warning/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-status-warning">Bloqueos activos</div>
                <div className="text-xs text-text-primary mt-0.5"><strong>{activeBottlenecks.length}</strong> en todo el equipo</div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-5 gap-2.5">
          {roleHealth.map(({ def, assignment, health }, i) => {
            const Icon = ROLE_ICON[def.slug];
            const style = HEALTH_STYLE[health];
            return (
              <motion.div
                key={def.slug}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-[10px] border p-3 text-center"
                style={{ borderColor: style.ring, background: style.bg }}
              >
                <div className="relative mx-auto h-10 w-10 mb-2">
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
                  >
                    {(assignment?.memberName ?? '?')[0]}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-bg-surface"
                    style={{ background: style.text, boxShadow: `0 0 8px ${style.text}` }}
                  />
                </div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted truncate flex items-center gap-1 justify-center">
                  <Icon className="h-2.5 w-2.5" /> {def.title}
                </div>
                <div className="text-[11px] text-text-primary mt-0.5 truncate">{assignment?.memberName}</div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Cuellos de botella */}
      <div className="surface p-5">
        <header className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-status-warning" />
          <h3 className="heading text-base font-bold">Cuellos de botella</h3>
        </header>
        {activeBottlenecks.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-6 italic">Sin bloqueos activos.</div>
        ) : (
          <ul className="space-y-2">
            {activeBottlenecks.map((b, i) => (
              <li key={i} className="rounded-[10px] border border-status-warning/30 bg-status-warning/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-status-warning mb-1">
                  {b.role.title} · {b.member}
                </div>
                <div className="text-sm text-text-primary leading-snug">{b.text}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Gráfica cumplimiento por rol */}
      <div className="surface p-5 xl:col-span-3">
        <header className="flex items-center justify-between mb-3">
          <h3 className="heading text-base font-bold">Cumplimiento por rol · últimas 4 semanas</h3>
          <span className="text-[11px] text-text-muted">% de KPIs en verde</span>
        </header>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#6B6B80" fontSize={11} />
              <YAxis stroke="#6B6B80" fontSize={11} domain={[0, 100]} />
              <RTooltip
                contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#A0A0B4' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {ROLE_DEFS.map((def, i) => (
                <Bar
                  key={def.slug}
                  dataKey={def.title}
                  fill={['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#A855F7'][i] ?? '#94A3B8'}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Card por rol (expandible) ───────────────────────── */

function RoleCard({
  def, assignment, accent, tasks,
}: {
  def: RoleDef;
  assignment: RoleAssignment;
  accent: string;
  tasks: Array<{ id: string; title: string; priority: string; dueDate: string; status: string; isDelayed: boolean }>;
}) {
  const update = useTeamStore((s) => s.update);
  const [expanded, setExpanded] = useState(true);
  const [editingBottleneck, setEditingBottleneck] = useState(false);
  const [editingAchievements, setEditingAchievements] = useState(false);
  const [bottleneckDraft, setBottleneckDraft] = useState(assignment.bottleneck);
  const [achievementsDraft, setAchievementsDraft] = useState(assignment.weeklyAchievements);

  const Icon = ROLE_ICON[def.slug];

  const evaluations = def.kpis.map((k) => ({ kpi: k, value: assignment.kpiValues[k.key] ?? 0, health: evaluateKpi(assignment.kpiValues[k.key] ?? 0, k) }));
  const reds = evaluations.filter((e) => e.health === 'red').length;
  const yellows = evaluations.filter((e) => e.health === 'yellow').length;
  const roleHealth: KpiHealth = reds >= 2 ? 'red' : reds === 1 || yellows >= 3 ? 'yellow' : 'green';
  const healthStyle = HEALTH_STYLE[roleHealth];

  const urgentTasks = [...tasks]
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))
    .slice(0, 3);

  return (
    <section className="surface overflow-hidden">
      <header
        className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-base"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
            >
              {assignment.memberName[0]}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-surface"
              style={{ background: healthStyle.text, boxShadow: `0 0 8px ${healthStyle.text}` }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-text-muted" />
              <h3 className="heading text-base font-bold truncate">{def.title}</h3>
              <span
                className="text-[10px] uppercase tracking-wider rounded-full border px-1.5 py-0.5"
                style={{ background: healthStyle.bg, color: healthStyle.text, borderColor: healthStyle.ring }}
              >
                {roleHealth === 'green' ? 'Saludable' : roleHealth === 'yellow' ? 'Atención' : 'Crítico'}
              </span>
            </div>
            <div className="text-xs text-text-secondary">
              {assignment.memberName} · {def.fullTitle}
            </div>
          </div>
        </div>
        <button className="text-text-muted hover:text-text-primary" aria-label={expanded ? 'Colapsar' : 'Expandir'}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </header>

      {expanded && (
        <div className="border-t border-border-subtle">
          {/* KPIs */}
          <div className="p-5">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
              KPIs del rol
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {evaluations.map(({ kpi, value, health }) => (
                <KpiCell key={kpi.key} kpi={kpi} value={value} health={health} accent={accent} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-t border-border-subtle">
            {/* Funciones */}
            <div className="p-5 lg:border-r border-border-subtle">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
                Funciones del rol
              </div>
              <ul className="space-y-1.5 text-xs text-text-secondary">
                {def.functions.map((f, i) => (
                  <li key={i} className="flex gap-1.5 leading-snug">
                    <span style={{ color: accent }}>›</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tareas activas */}
            <div className="p-5 lg:border-r border-border-subtle">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
                Tareas activas más urgentes
              </div>
              {urgentTasks.length === 0 ? (
                <div className="text-xs text-text-muted italic">Sin tareas activas asignadas.</div>
              ) : (
                <ul className="space-y-1.5">
                  {urgentTasks.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-md border border-border-subtle bg-bg-base/30 p-2 text-xs"
                      style={t.isDelayed ? { borderColor: 'rgba(239,68,68,0.4)' } : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <Badge tone={t.priority === 'P1' ? 'danger' : t.priority === 'P2' ? 'warning' : 'neutral'}>
                          {t.priority}
                        </Badge>
                        <span className="text-text-primary leading-tight line-clamp-1">{t.title}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Notas: bottleneck + logros */}
            <div className="p-5 space-y-4">
              <NotesField
                label="Cuello de botella"
                icon={<AlertTriangle className="h-3.5 w-3.5 text-status-warning" />}
                value={assignment.bottleneck}
                draft={bottleneckDraft}
                editing={editingBottleneck}
                onStartEdit={() => { setBottleneckDraft(assignment.bottleneck); setEditingBottleneck(true); }}
                onCancel={() => setEditingBottleneck(false)}
                onSave={() => {
                  update(assignment.clientId, def.slug, { bottleneck: bottleneckDraft });
                  toast.success('Cuello de botella actualizado');
                  setEditingBottleneck(false);
                }}
                onChange={setBottleneckDraft}
                accent={accent}
                placeholder="¿Qué está frenando a este rol?"
                emptyText="Sin bloqueos registrados."
              />
              <NotesField
                label="Logros de la semana"
                icon={<Trophy className="h-3.5 w-3.5 text-status-success" />}
                value={assignment.weeklyAchievements}
                draft={achievementsDraft}
                editing={editingAchievements}
                onStartEdit={() => { setAchievementsDraft(assignment.weeklyAchievements); setEditingAchievements(true); }}
                onCancel={() => setEditingAchievements(false)}
                onSave={() => {
                  update(assignment.clientId, def.slug, { weeklyAchievements: achievementsDraft });
                  toast.success('Logros guardados');
                  setEditingAchievements(false);
                }}
                onChange={setAchievementsDraft}
                accent={accent}
                placeholder="Wins de esta semana…"
                emptyText="Aún sin registro semanal."
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── Sub-componentes ───────────────────────── */

function KpiCell({
  kpi, value, health, accent,
}: {
  kpi: KpiDef;
  value: number;
  health: KpiHealth;
  accent: string;
}) {
  const style = HEALTH_STYLE[health];
  const progress = progressToTarget(value, kpi);
  // Tendencia mock: ±5–25% basado en hash del key
  const seed = kpi.key.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const delta = (((seed % 30) - 15) / 100); // -0.15..+0.15
  const trendUp = delta > 0.02;
  const trendDown = delta < -0.02;

  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-text-muted line-clamp-1" title={kpi.label}>
          {kpi.label}
        </span>
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ background: style.text, boxShadow: `0 0 8px ${style.text}` }}
        />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="kpi-number" style={{ color: style.text, fontSize: '1.5rem' }}>
          {formatValue(value, kpi)}
        </span>
        {trendUp && <TrendingUp className="h-3.5 w-3.5 text-status-success" />}
        {trendDown && <TrendingDown className="h-3.5 w-3.5 text-status-danger" />}
        {!trendUp && !trendDown && <Minus className="h-3.5 w-3.5 text-text-muted" />}
      </div>
      <div className="text-[10px] text-text-muted mt-1">
        Meta: {formatValue(kpi.target, kpi)}
      </div>
      <div className="mt-2 h-1 rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0.5)})` }}
        />
      </div>
    </div>
  );
}

function formatValue(v: number, kpi: KpiDef): string {
  const formatted = v % 1 === 0 ? v.toString() : v.toFixed(2);
  if (!kpi.unit) return formatted;
  if (kpi.unit === '$') return `$${formatted}`;
  return `${formatted}${kpi.unit.startsWith('/') ? '' : kpi.unit.startsWith('%') ? '' : ''}${kpi.unit}`;
}

function NotesField({
  label, icon, value, draft, editing, onStartEdit, onCancel, onSave, onChange, accent, placeholder, emptyText,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  draft: string;
  editing: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (v: string) => void;
  accent: string;
  placeholder: string;
  emptyText: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1.5">
          {icon} {label}
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <button onClick={onCancel} className="h-6 w-6 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated">
              <X className="h-3 w-3 mx-auto" />
            </button>
            <button onClick={onSave} className="h-6 w-6 rounded-md text-status-success hover:bg-status-success/15">
              <Save className="h-3 w-3 mx-auto" />
            </button>
          </div>
        ) : (
          <button onClick={onStartEdit} className="text-[10px] text-text-muted hover:text-text-primary inline-flex items-center gap-1">
            <Pencil className="h-2.5 w-2.5" /> Editar
          </button>
        )}
      </div>
      {editing ? (
        <Textarea
          rows={3}
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(value !== draft && '')}
        />
      ) : (
        <div className="text-xs text-text-secondary leading-relaxed min-h-[3rem]">
          {value || <span className="italic text-text-muted">{emptyText}</span>}
        </div>
      )}
      {/* Punto cromático que conecta visualmente con el accent del cliente */}
      <span className="sr-only" style={{ color: accent }}>accent ref</span>
    </div>
  );
}
