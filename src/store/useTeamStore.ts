import { create } from 'zustand';
import type { RoleAssignment, TeamRoleSlug } from '@/types/team';
import { ROLE_DEFS } from '@/types/team';
import { TeamRepo } from '@/services/repositories';

const upsertTimers = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleUpsert(a: RoleAssignment) {
  const key = `${a.clientId}:${a.roleSlug}`;
  const existing = upsertTimers.get(key);
  if (existing) clearTimeout(existing);
  upsertTimers.set(key, setTimeout(() => {
    upsertTimers.delete(key);
    void TeamRepo.upsert(a).catch((e) => console.warn('[team.upsert]', key, e));
  }, 500));
}

interface TeamState {
  assignments: RoleAssignment[];
  // Histórico mock de cumplimiento semanal por rol — usado en gráfica del dashboard.
  weeklyCompliance: Record<TeamRoleSlug, number[]>;
  ensureForClient: (clientId: string) => void;
  update: (clientId: string, roleSlug: TeamRoleSlug, patch: Partial<RoleAssignment>) => void;
  forClient: (clientId: string) => RoleAssignment[];
}

const NAMES_BY_ROLE: Record<TeamRoleSlug, string> = {
  project_manager: 'Sin asignar',
  strategist: 'Marisol Ochoa',
  media_buyer: 'Diego Ramírez',
  copywriter: 'Camila Mora',
  designer: 'Laura Mejía',
  community: 'Sebastián Vega',
  funnel_builder: 'Andrés Torres',
  editor: 'Sin asignar',
  closer: 'Sin asignar',
  onboarding: 'Sin asignar',
};

function defaultBottleneck(role: TeamRoleSlug): string {
  return ({
    project_manager: '',
    strategist: '',
    media_buyer: 'Esperando acceso al Business Manager del cliente.',
    copywriter: '',
    designer: 'Atrasada en la entrega de creatividades del drop.',
    community: '',
    funnel_builder: '',
    editor: '',
    closer: '',
    onboarding: '',
  } as Record<TeamRoleSlug, string>)[role];
}

function hash(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Genera valores mock determinísticos de KPIs por (cliente, rol) para que
 * el dashboard se vea poblado y consistente entre re-renders.
 */
function seedKpiValues(clientId: string, roleSlug: TeamRoleSlug): Record<string, number> {
  const def = ROLE_DEFS.find((r) => r.slug === roleSlug)!;
  const base = hash(`${clientId}:${roleSlug}`);
  const out: Record<string, number> = {};
  def.kpis.forEach((k, i) => {
    const noise = ((base + i * 17) % 100) / 100; // 0..1
    if (k.direction === 'higher_better') {
      // 60%–110% del target
      out[k.key] = Math.round(k.target * (0.6 + noise * 0.55) * 100) / 100;
    } else {
      // 0.85x–1.6x del target (lower_better → valor MAYOR es peor)
      out[k.key] = Math.round(k.target * (0.85 + noise * 0.75) * 100) / 100;
    }
  });
  return out;
}

function seedWeekly(role: TeamRoleSlug): number[] {
  const base = hash(role);
  return [0, 1, 2, 3].map((w) => 60 + ((base + w * 23) % 35));
}

export const useTeamStore = create<TeamState>((set, get) => ({
  assignments: [],
  weeklyCompliance: {
    project_manager: seedWeekly('project_manager'),
    strategist: seedWeekly('strategist'),
    media_buyer: seedWeekly('media_buyer'),
    copywriter: seedWeekly('copywriter'),
    designer: seedWeekly('designer'),
    community: seedWeekly('community'),
    funnel_builder: seedWeekly('funnel_builder'),
    editor: seedWeekly('editor'),
    closer: seedWeekly('closer'),
    onboarding: seedWeekly('onboarding'),
  },
  ensureForClient: (clientId) => {
    const existing = get().assignments.filter((a) => a.clientId === clientId);
    if (existing.length === ROLE_DEFS.length) return;
    const toCreate: RoleAssignment[] = ROLE_DEFS
      .filter((r) => !existing.find((a) => a.roleSlug === r.slug))
      .map((r) => ({
        clientId,
        roleSlug: r.slug,
        memberName: NAMES_BY_ROLE[r.slug],
        bottleneck: defaultBottleneck(r.slug),
        weeklyAchievements: '',
        kpiValues: seedKpiValues(clientId, r.slug),
      }));
    set((s) => ({ assignments: [...s.assignments, ...toCreate] }));
    // Persist los nuevos a Supabase (sin debounce — primera vez)
    toCreate.forEach((a) => void TeamRepo.upsert(a).catch((e) => console.warn('[team.upsert:initial]', e)));
  },
  update: (clientId, roleSlug, patch) => {
    set((s) => ({
      assignments: s.assignments.map((a) =>
        a.clientId === clientId && a.roleSlug === roleSlug ? { ...a, ...patch } : a,
      ),
    }));
    const updated = get().assignments.find((a) => a.clientId === clientId && a.roleSlug === roleSlug);
    if (updated) scheduleUpsert(updated);
  },
  forClient: (clientId) => get().assignments.filter((a) => a.clientId === clientId),
}));
