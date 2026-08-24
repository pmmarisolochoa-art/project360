import { useMemo } from 'react';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { useClientStore } from '@/store/useClientStore';
import { seEntregoATiempo } from '@/utils/vencidas';
import { ROLE_DEFS, evaluateKpi } from '@/types/team';
import type { KpiHealth, KpiDef } from '@/types/team';
import type { TeamMember } from '@/types/teamMember';
import type { TaskStatus } from '@/types/task';

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
  targetOverridden?: boolean;   // la meta fue editada por cliente (≠ default del rol)
}

/** Resultado de KPI capturado al completar una tarea, atribuido a la persona. */
export interface MemberTaskKpi {
  taskTitle: string;
  nombre: string;         // kpiNombre de la tarea (ej. "Leads captados")
  meta?: string;          // kpiMeta
  resultado: string;      // kpiResultado registrado al completar
  health: KpiHealth | null;
}

export interface MemberKpiSummary {
  member: TeamMember;
  rows: MemberKpiRow[];
  taskKpis: MemberTaskKpi[];   // resultados que vienen de tareas completadas
  score: number;          // % de KPIs en verde (KPIs del rol/custom + resultados de tareas)
  health: KpiHealth;
}

/**
 * % de ENTREGAS del miembro que llegaron dentro del plazo pactado.
 *
 * CORREGIDO 24-ago-2026. Antes se dividia entre TODAS sus tareas, incluidas las
 * abiertas que aun no vencian — asi que no medía puntualidad sino avance: quien
 * nunca habia incumplido un plazo pero tenia 10 tareas en curso salia con un
 * porcentaje bajo, y el KPI calificaba mal a gente que trabajaba bien.
 *
 * Ahora el denominador son las tareas ENTREGADAS. Las abiertas no puntuan ni a
 * favor ni en contra: todavia no hay entrega que juzgar.
 *
 * La puntualidad se decide comparando `completedAt` con `dueDate`, no leyendo
 * `isDelayed` — esa marca depende de que alguien tuviera la app abierta cuando
 * la tarea se paso de fecha. Ver `utils/vencidas.ts`.
 *
 * `null` = todavia no ha entregado nada, asi que no hay nada que medir.
 */
export function autoTaskRate(
  memberName: string,
  tasks: Array<Pick<KpiTask, 'assignedTo' | 'status' | 'dueDate' | 'completedAt'>>,
): number | null {
  const entregadas = tasks.filter((t) => t.assignedTo === memberName && t.status === 'completed');
  if (entregadas.length === 0) return null;
  const aTiempo = entregadas.filter((t) => seEntregoATiempo(t) === true).length;
  return Math.round((aTiempo / entregadas.length) * 100);
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v.trim() === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Devuelve un KpiDef con la meta sobreescrita por cliente, escalando los umbrales
 * (red/yellow) en proporción para que el semáforo siga siendo coherente.
 * Si la meta original es 0 (ej. "bloqueos abiertos") no se puede escalar: se
 * conservan los umbrales originales con la nueva meta.
 */
function applyTargetOverride(def: KpiDef, newTarget: number): KpiDef {
  if (def.target === 0 || newTarget === def.target) return { ...def, target: newTarget };
  const ratio = newTarget / def.target;
  const scale = (t?: number) => (t === undefined ? undefined : Math.round(t * ratio * 100) / 100);
  return { ...def, target: newTarget, redThreshold: scale(def.redThreshold), yellowThreshold: scale(def.yellowThreshold) };
}

/**
 * Semáforo de un resultado de tarea vs su meta. Misma lógica que el módulo Tareas:
 * numéricos → verde si alcanza/supera la meta, amarillo si no; sin meta numérica
 * pero con resultado registrado → verde. Sin resultado → null.
 */
function taskKpiHealth(meta: string | undefined, resultado: string): KpiHealth | null {
  if (!resultado.trim()) return null;
  const m = num(meta);
  const r = num(resultado);
  if (m != null && r != null) return r >= m ? 'green' : 'yellow';
  return 'green';
}

type KpiTask = {
  assignedTo: string;
  status: TaskStatus;
  /** Necesarios para medir puntualidad por fechas y no por la marca guardada. */
  dueDate: string;
  completedAt?: string;
  isDelayed: boolean;
  title?: string;
  kpiNombre?: string;
  kpiMeta?: string;
  kpiResultado?: string;
};

export function computeMemberKpis(
  member: TeamMember,
  tasks: KpiTask[],
): MemberKpiSummary {
  const roleDef = ROLE_DEFS.find((r) => r.slug === member.rol);
  const rows: MemberKpiRow[] = [];

  // KPIs del rol (valores manuales; tasks_on_time se puede calcular auto).
  for (const baseDef of roleDef?.kpis ?? []) {
    const override = num(member.kpis.targets?.[baseDef.key]);
    const targetOverridden = override != null && override !== baseDef.target;
    const def = targetOverridden ? applyTargetOverride(baseDef, override) : baseDef;
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
      targetOverridden,
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

  // Resultados de tareas completadas atribuidas a la persona (por nombre o rol).
  const taskKpis: MemberTaskKpi[] = tasks
    .filter((t) =>
      (t.assignedTo === member.nombre || t.assignedTo === member.rol) &&
      t.status === 'completed' && !!t.kpiNombre && !!t.kpiResultado)
    .map((t) => ({
      taskTitle: t.title ?? '',
      nombre: t.kpiNombre as string,
      meta: t.kpiMeta,
      resultado: t.kpiResultado as string,
      health: taskKpiHealth(t.kpiMeta, t.kpiResultado as string),
    }));

  // Score y salud: combinan KPIs del rol/custom + resultados de tareas.
  const healthVals: KpiHealth[] = [
    ...rows.filter((r) => r.health != null).map((r) => r.health as KpiHealth),
    ...taskKpis.filter((t) => t.health != null).map((t) => t.health as KpiHealth),
  ];
  const greens = healthVals.filter((h) => h === 'green').length;
  const reds = healthVals.filter((h) => h === 'red').length;
  const yellows = healthVals.filter((h) => h === 'yellow').length;
  const score = healthVals.length ? Math.round((greens / healthVals.length) * 100) : 0;
  const health: KpiHealth = reds >= 2 ? 'red' : reds === 1 || yellows >= 3 ? 'yellow' : 'green';

  return { member, rows, taskKpis, score, health };
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
