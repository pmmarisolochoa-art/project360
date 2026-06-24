/**
 * Puente entre el chat del Agente PM y las funciones IA que YA EXISTEN.
 *
 * El chat es un canal ADICIONAL para llegar a las mismas funciones (extracción
 * de tareas de reunión, etc.) — NO reemplaza los botones del MeetingDrawer, que
 * siguen funcionando igual. Aquí solo detectamos la intención en el mensaje del
 * usuario y reutilizamos exactamente el mismo backend.
 *
 * Si ningún tool aplica, devuelve null y el chat sigue con el LLM normal.
 */

import { useClientStore } from '@/store/useClientStore';
import { extractTasksFromNotes } from '@/services/claudeApi';
import { ROLE_DEFS } from '@/types/team';
import type { AgentAction } from '@/services/agentActions';

export interface ToolResult {
  text: string;
  actions: AgentAction[];
}

const ROLE_SLUGS = ROLE_DEFS.map((r) => r.slug);

/** Intención: "extrae / genera las tareas de la reunión". */
function wantsMeetingTaskExtraction(text: string): boolean {
  const t = text.toLowerCase();
  const verb = /(extrae|extraer|saca|sacar|genera|generar|crea|crear)/.test(t);
  const tasks = /tareas?/.test(t);
  const meeting = /(reuni[oó]n|junta|meeting|llamada|transcripci[oó]n|minuta|notas)/.test(t);
  return verb && tasks && meeting;
}

async function runMeetingTaskExtraction(clientId: string): Promise<ToolResult> {
  const client = useClientStore.getState().getClient(clientId);
  const meetings = useClientStore.getState().meetingsByClient(clientId);

  // La reunión más reciente que tenga transcripción o notas con contenido.
  const candidate = [...meetings]
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .find((m) => (m.transcription && m.transcription.trim()) || (m.notes && m.notes.trim()));

  if (!client || !candidate) {
    return {
      text: 'No encontré una reunión con transcripción o notas para extraer tareas. ' +
        'Sube la grabación o agrega notas en la reunión y vuelve a pedírmelo.',
      actions: [],
    };
  }

  const source = candidate.transcription?.trim() || candidate.notes?.trim() || '';
  const extracted = await extractTasksFromNotes({
    clientName: client.name,
    industry: client.industry,
    meetingType: candidate.type,
    notes: source,
    agenda: candidate.agenda,
    availableRoles: ROLE_SLUGS,
  });

  if (!extracted.length) {
    return { text: `Revisé "${candidate.title}" pero no encontré tareas accionables claras.`, actions: [] };
  }

  const actions: AgentAction[] = extracted.map((t) => ({
    tipo: 'crear_tarea',
    datos: {
      titulo: t.title,
      rol: t.responsibleRole,
      prioridad: t.priority ?? 'P2',
      vence_en_dias: t.dueInDays,
    },
  }));

  return {
    text: `Extraje ${actions.length} tarea(s) de "${candidate.title}" (${candidate.scheduledAt.slice(0, 10)}). ` +
      'Revísalas y confirma las que quieras crear:',
    actions,
  };
}

/**
 * Intenta resolver el mensaje con una función existente.
 * Devuelve null si no aplica ningún tool (el chat seguirá con el LLM).
 */
export async function tryAgentTool(clientId: string, userText: string): Promise<ToolResult | null> {
  if (wantsMeetingTaskExtraction(userText)) {
    return runMeetingTaskExtraction(clientId);
  }
  return null;
}
