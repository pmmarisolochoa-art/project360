import { useMemo } from 'react';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { useClientStore } from '@/store/useClientStore';
import { ROLE_DEFS, evaluateKpi } from '@/types/team';
import type { KpiHealth } from '@/types/team';
import type { TeamMember } from '@/types/teamMember';

/**
 * Cálculo centralizado de KPIs del equipo de un cliente (Sprint E · Sección 3C).
 * Lo usan el módulo Equipo, el dashboard y los informes — para no duplicar queries.
 */

export interface MemberKpiRow {
  key: string;
  label: string;
  unit?: string;
  target: number | null;
  value: number | null;   // null = sin dato / no numérico
  textValue?: string;     // para KPIs tipo texto
  health: KpiHealth | null;
  measure: 'auto' | 'manual';
  custom: boolean;
}

export interface MemberKpiSummary {
  member: TeamMember;
  rows: MemberKpiRow[];
  score: number;          // % de KPIs en verde (solo numéricos)
  health: KpiHealth;
}

/** % de tareas del miembro completadas a tiempo (no retrasadas). */
export function autoTaskRate(
  memberName: string,
  tasks: Array<{ assignedTo: string; status: string; isDelayed: boolean }>,
): number | null {
  const mine = tasks.filter((t) => t.assignedTo === memberName);
  if (mine.length === 0) return null;
  const onTime = mine.filter((t) => t.status === 'completed' && !t.isDelayed).length;
  return Math.round((onTime / mine.length) * 100);
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v.trim() === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function computeMemberKpis(
  member: TeamMember,
  tasks: Array<{ assignedTo: string; status: string; isDelayed: boolean }>,
): MemberKpiSummary {
  const roleDef = ROLE_DEFS.find((r) => r.slug === member.rol);
  const rows: MemberKpiRow[] = [];

  // KPIs del rol (valores manuales; tasks_on_time se puede calcular auto).
  for (const def of roleDef?.kpis ?? []) {
    const manual = num(member.kpis.values[def.key]);
    const isAutoKey = def.key === 'tasks_on_time';
    const value = manual ?? (isAutoKey ? autoTaskRate(member.nombre, tasks) : null);
    rows.push({
      key: def.key,
      label: def.label,
      unit: def.unit,
      target: def.target,
      value,
      health: value != null ? evaluateKpi(value, def) : null,
      measure: isAutoKey && manual == null ? 'auto' : 'manual',
      custom: false,
    });
  }

  // KPIs personalizados.
  for (const c of member.kpis.custom) {
    if (c.type === 'text') {
      rows.push({
        key: c.key, label: c.label, target: null, value: null,
        textValue: member.kpis.values[c.key] ?? '', health: null, measure: c.measure, custom: true,
      });
      continue;
    }
    const target = num(c.target);
    const value = c.measure === 'auto'
      ? autoTaskRate(member.nombre, tasks)
      : num(member.kpis.values[c.key]);
    let health: KpiHealth | null = null;
    if (value != null && target != null) {
      health = value >= target ? 'green' : value >= target * 0.8 ? 'yellow' : 'red';
    }
    rows.push({
      key: c.key, label: c.label, unit: c.type === 'percent' ? '%' : undefined,
      target, value, health, measure: c.measure, custom: true,
    });
  }

  const numeric = rows.filter((r) => r.health != null);
  const greens = numeric.filter((r) => r.health === 'green').length;
  const reds = numeric.filter((r) => r.health === 'red').length;
  const yellows = numeric.filter((r) => r.health === 'yellow').length;
  const score = numeric.length ? Math.round((greens / numeric.length) * 100) : 0;
  const health: KpiHealth = reds >= 2 ? 'red' : reds === 1 || yellows >= 3 ? 'yellow' : 'green';

  return { member, rows, score, health };
}

export function useTeamKPIs(clientId: string): MemberKpiSummary[] {
  const members = useTeamMembersStore((s) => s.members);
  const tasks = useClientStore((s) => s.tasks);
  return useMemo(() => {
    const clientTasks = tasks.filter((t) => t.clientId === clientId);
    return members
      .filter((m) => m.clientId === clientId)
      .map((m) => computeMemberKpis(m, clientTasks));
  }, [members, tasks, clientId]);
}
