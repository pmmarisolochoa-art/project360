/**
 * Servicio del Agente PM (Nivel 1).
 *
 * - Carga la definición del agente (system prompt, modelo, ícono) desde agent_prompts.
 * - Construye el CONTEXTO del cliente leyendo los stores ya hidratados (sin red extra).
 * - Persiste y recupera el historial de conversación (agent_conversations) por cliente.
 *
 * Sin agencia_id: todo se ancla por client_id (decisión documentada).
 * Degrada con elegancia si Supabase no está disponible (dev local sin backend).
 */

import { supabase } from '@/services/supabase';
import { useClientStore } from '@/store/useClientStore';
import { useRopreStore } from '@/store/useRopreStore';
import { useProgramsStore } from '@/store/useProgramsStore';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { teamMembersForClient } from '@/store/useTeamMembersStore';
import { resolveRoleLabel } from '@/utils/roleResolver';
import type { RopreItem, RopreType } from '@/types/ropre';

export interface AgentDef {
  agente: string;
  nombreDisplay: string;
  icono: string;
  systemPrompt: string;
  modelo: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Prompt de respaldo si la BD no está disponible (dev local). Igual al seed de la mig. 016. */
const FALLBACK_PROMPTS: Record<string, AgentDef> = {
  pm: {
    agente: 'pm',
    nombreDisplay: 'Project Manager',
    icono: 'ClipboardList',
    modelo: 'claude-sonnet-4-6',
    systemPrompt:
      'Eres el Project Manager experto de esta agencia de marketing digital. ' +
      'Ayudas a gestionar el proyecto del cliente con criterio de un PM senior con 10 años ' +
      'de experiencia en performance marketing en LATAM. Respondes siempre en español, ' +
      'tono profesional pero cercano. Si te falta información, lo dices en vez de inventar. ' +
      'Antes de guardar cualquier cambio (tarea, ROPRE) pides confirmación. Eres específico y accionable.',
  },
};

/* ─────────────── Definición del agente ─────────────── */

export async function loadAgentDef(agente: string): Promise<AgentDef> {
  if (!supabase) return FALLBACK_PROMPTS[agente] ?? FALLBACK_PROMPTS.pm;
  try {
    const { data, error } = await supabase
      .from('agent_prompts')
      .select('agente, nombre_display, icono, system_prompt, modelo, activo')
      .eq('agente', agente)
      .maybeSingle();
    if (error || !data) return FALLBACK_PROMPTS[agente] ?? FALLBACK_PROMPTS.pm;
    return {
      agente: data.agente as string,
      nombreDisplay: data.nombre_display as string,
      icono: data.icono as string,
      systemPrompt: data.system_prompt as string,
      modelo: (data.modelo as string) || 'claude-sonnet-4-6',
    };
  } catch (e) {
    console.warn('[agentService] loadAgentDef falló, usando fallback', e);
    return FALLBACK_PROMPTS[agente] ?? FALLBACK_PROMPTS.pm;
  }
}

/* ─────────────── Historial de conversación ─────────────── */

export async function loadConversation(clientId: string, agente: string, limit = 20): Promise<ChatMessage[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('agent_conversations')
      .select('role, content, created_at')
      .eq('client_id', clientId)
      .eq('agente', agente)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data
      .reverse()
      .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content as string }));
  } catch (e) {
    console.warn('[agentService] loadConversation falló', e);
    return [];
  }
}

export async function saveMessage(clientId: string, agente: string, role: 'user' | 'assistant', content: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('agent_conversations').insert({ client_id: clientId, agente, role, content });
  } catch (e) {
    console.warn('[agentService] saveMessage falló', e);
  }
}

/* ─────────────── Contexto del cliente ─────────────── */

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

function trimWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  return words.length <= max ? text.trim() : words.slice(0, max).join(' ') + '…';
}

const ROPRE_LABEL: Record<RopreType, string> = {
  result: 'Resultado esperado',
  objective: 'Objetivos',
  premise: 'Premisas',
  risk: 'Riesgos',
  deliverable: 'Entregables',
};

/**
 * Construye un bloque de texto compacto con el estado del cliente para inyectar
 * en el system prompt. Lee los stores en memoria (ya hidratados por bootstrap).
 */
export function buildClientContext(clientId: string): string {
  const client = useClientStore.getState().getClient(clientId);
  if (!client) return 'No se encontró el cliente.';

  const tasks = useClientStore.getState().tasksByClient(clientId);
  const meetings = useClientStore.getState().meetingsByClient(clientId);
  const ropre = useRopreStore.getState().byClient(clientId);
  const programs = useProgramsStore.getState().byClient(clientId);
  const funnels = useFunnelLaunchStore.getState().byClient(clientId);
  const members = teamMembersForClient(clientId);

  const L: string[] = [];

  // — Identidad —
  const ident = client.onboardingData?.identity;
  const brain = client.aiBrainData ?? {};
  L.push(`# CLIENTE: ${client.name}`);
  L.push(`Industria: ${client.industry || '—'} · Tipo de proyecto: ${client.projectType || '—'} · Estado: ${client.status}`);
  if (ident?.founderName) L.push(`Founder/contacto: ${ident.founderName}${ident.country ? ` (${ident.country})` : ''}`);
  if (ident?.website) L.push(`Web: ${ident.website}`);
  if (brain.executiveSummary) L.push(`Resumen ejecutivo: ${trimWords(brain.executiveSummary, 80)}`);
  if (brain.irresistibleOffer) L.push(`Oferta: ${trimWords(brain.irresistibleOffer, 60)}`);
  if (brain.brandArchitecture?.mission) L.push(`Misión de marca: ${trimWords(brain.brandArchitecture.mission, 40)}`);

  // — Buyer personas —
  if (brain.buyerPersonas?.length) {
    L.push('\n## Buyer persona');
    brain.buyerPersonas.slice(0, 2).forEach((p) => {
      L.push(`- ${p.name}: ${trimWords(p.description || '', 30)}`);
      if (p.pains?.length) L.push(`  Dolores: ${p.pains.slice(0, 3).join('; ')}`);
      if (p.desires?.length) L.push(`  Deseos: ${p.desires.slice(0, 3).join('; ')}`);
    });
  }

  // — Programa / embudo activo —
  if (programs.length) {
    L.push('\n## Programa activo');
    programs.slice(0, 2).forEach((pr) => {
      const dToEvent = daysUntil(pr.fechaEvento);
      L.push(`- ${pr.nombre} (${pr.tipo}, estado ${pr.estado})` +
        (pr.fechaEvento ? ` · evento ${pr.fechaEvento}${dToEvent != null ? ` (faltan ${dToEvent} días)` : ''}` : ''));
    });
  }
  if (funnels.length) {
    const f = funnels[0];
    const phases = useFunnelLaunchStore.getState().phasesByFunnel(f.id);
    const dToEvent = daysUntil(f.eventDate);
    L.push(`Embudo: ${f.name} (${f.status})` +
      (f.eventDate ? ` · evento ${f.eventDate.slice(0, 10)}${dToEvent != null ? ` (faltan ${dToEvent} días)` : ''}` : '') +
      (phases.length ? ` · ${phases.length} fases` : ''));
  }

  // — ROPRE —
  if (ropre.length) {
    L.push('\n## ROPRE actual');
    (['result', 'objective', 'premise', 'risk', 'deliverable'] as RopreType[]).forEach((type) => {
      const items = ropre.filter((r: RopreItem) => r.type === type);
      if (!items.length) return;
      L.push(`${ROPRE_LABEL[type]}:`);
      items.slice(0, 4).forEach((r) => {
        const val = r.targetValue ? ` (meta ${r.targetValue}${r.currentValue ? `, actual ${r.currentValue}` : ''})` : '';
        const risk = r.riskLevel ? ` [riesgo ${r.riskLevel}]` : '';
        L.push(`  - ${r.title}${val}${risk}`);
      });
    });
  }

  // — Tareas —
  const now = Date.now();
  const completed = tasks.filter((t) => t.status === 'completed');
  const pending = tasks.filter((t) => t.status !== 'completed');
  const overdue = pending.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now);
  L.push(`\n## Tareas: ${tasks.length} totales · ${completed.length} completadas · ${pending.length} abiertas · ${overdue.length} vencidas`);
  const upcoming = [...pending]
    .filter((t) => t.dueDate)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 10);
  if (upcoming.length) {
    L.push('Próximas a vencer / vencidas (top 10):');
    upcoming.forEach((t) => {
      const d = daysUntil(t.dueDate);
      const role = resolveRoleLabel(t.assignedTo, clientId) ?? t.assignedTo;
      L.push(`  - [${t.priority}] ${t.title} · ${role} · ${d != null ? (d < 0 ? `vencida hace ${-d}d` : `en ${d}d`) : 's/fecha'} · ${t.status}`);
    });
  }

  // — Equipo —
  if (members.length) {
    L.push('\n## Equipo asignado');
    members.forEach((m) => {
      const mtasks = tasks.filter((t) => t.assignedTo === m.nombre || t.assignedTo === m.rol);
      const done = mtasks.filter((t) => t.status === 'completed').length;
      const pct = mtasks.length ? Math.round((done / mtasks.length) * 100) : null;
      const label = resolveRoleLabel(m.rol, clientId) ?? m.rol;
      L.push(`  - ${m.nombre || '(sin nombre)'} · ${label}` +
        (pct != null ? ` · cumplimiento ${pct}% (${done}/${mtasks.length})` : ' · sin tareas'));
    });
  }

  // — Últimas 2 reuniones (máx ~500 palabras combinadas) —
  const recent = [...meetings]
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 2);
  if (recent.length) {
    L.push('\n## Últimas reuniones');
    recent.forEach((mt) => {
      const text = mt.summary || mt.notes || mt.agenda || '';
      L.push(`- ${mt.title} (${mt.scheduledAt.slice(0, 10)}): ${text ? trimWords(text, 250) : 'sin notas'}`);
    });
  }

  return L.join('\n');
}
