/**
 * Acciones que el Agente PM puede proponer y, con aprobación del usuario, ejecutar.
 *
 * El agente emite un bloque [ACCION]{json}[/ACCION] al final de su respuesta.
 * El frontend lo detecta, lo remueve del texto visible y lo muestra como una
 * tarjeta de confirmación. Al confirmar, se ejecuta reutilizando los stores
 * existentes (addTask / useRopreStore.add / addMeeting) — sin duplicar lógica.
 */

import { genId } from '@/utils/id';
import { useClientStore } from '@/store/useClientStore';
import { useRopreStore } from '@/store/useRopreStore';
import type { Task, TaskPriority } from '@/types/task';
import type { RopreItem, RopreType, RiskLevel } from '@/types/ropre';
import type { Meeting, MeetingType } from '@/types/meeting';

/** Instrucción que se añade al final del system prompt para activar el protocolo. */
export const ACTION_PROTOCOL = `

PROTOCOLO DE ACCIONES:
Cuando quieras proponer una acción concreta (crear una tarea, actualizar el ROPRE,
o agendar una reunión), incluye AL FINAL de tu respuesta un bloque exactamente así:

[ACCION]
{
  "tipo": "crear_tarea" | "actualizar_ropre" | "crear_reunion",
  "datos": { ... }
}
[/ACCION]

Formato de "datos" según el tipo:
- crear_tarea: { "titulo": string, "descripcion"?: string, "rol"?: string, "prioridad"?: "P1"|"P2"|"P3", "vence_en_dias"?: number }
- actualizar_ropre: { "tipo": "result"|"objective"|"premise"|"risk"|"deliverable", "titulo": string, "descripcion"?: string, "nivel_riesgo"?: "low"|"medium"|"high", "meta"?: string }
- crear_reunion: { "titulo": string, "tipo"?: string, "en_dias"?: number, "notas"?: string }

El usuario verá ese bloque como una tarjeta de confirmación, no como texto.
Solo incluye el bloque cuando realmente propongas guardar algo. Nunca lo incluyas
en respuestas puramente informativas, y nunca guardes nada sin que el usuario confirme.`;

export type ActionTipo = 'crear_tarea' | 'actualizar_ropre' | 'crear_reunion';

export interface AgentAction {
  tipo: ActionTipo;
  datos: Record<string, unknown>;
}

const VALID_TIPOS: ActionTipo[] = ['crear_tarea', 'actualizar_ropre', 'crear_reunion'];

/**
 * Extrae el bloque [ACCION]...[/ACCION] de la respuesta del agente.
 * Devuelve el texto visible (sin el bloque) y la acción parseada (o null).
 */
export function parseAgentAction(raw: string): { visibleText: string; action: AgentAction | null } {
  const match = raw.match(/\[ACCION\]\s*([\s\S]*?)\s*\[\/ACCION\]/i);
  if (!match) return { visibleText: raw.trim(), action: null };

  const visibleText = raw.replace(match[0], '').trim();
  try {
    // Tolera fences ```json dentro del bloque.
    const jsonStr = match[1].replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(jsonStr) as AgentAction;
    if (!parsed || !VALID_TIPOS.includes(parsed.tipo) || typeof parsed.datos !== 'object') {
      return { visibleText, action: null };
    }
    return { visibleText, action: { tipo: parsed.tipo, datos: parsed.datos ?? {} } };
  } catch {
    return { visibleText, action: null };
  }
}

/** Título legible para la tarjeta de confirmación. */
export function actionTitle(tipo: ActionTipo): string {
  switch (tipo) {
    case 'crear_tarea': return 'Crear tarea';
    case 'actualizar_ropre': return 'Actualizar ROPRE';
    case 'crear_reunion': return 'Agendar reunión';
  }
}

function str(datos: Record<string, unknown>, key: string): string | undefined {
  const v = datos[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
function num(datos: Record<string, unknown>, key: string): number | undefined {
  const v = datos[key];
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/**
 * Ejecuta la acción confirmada reutilizando los stores existentes.
 * Devuelve un mensaje de éxito para el toast.
 */
export function executeAction(action: AgentAction, clientId: string): { ok: boolean; message: string } {
  const d = action.datos;

  if (action.tipo === 'crear_tarea') {
    const titulo = str(d, 'titulo');
    if (!titulo) return { ok: false, message: 'La tarea necesita un título.' };
    const prioridad = (str(d, 'prioridad') as TaskPriority) || 'P2';
    const venceEnDias = num(d, 'vence_en_dias') ?? 3;
    const task: Task = {
      id: genId(),
      clientId,
      title: titulo,
      description: str(d, 'descripcion'),
      status: 'pending',
      priority: (['P1', 'P2', 'P3'] as string[]).includes(prioridad) ? prioridad : 'P2',
      assignedTo: str(d, 'rol') || 'project_manager',
      dueDate: isoInDays(venceEnDias),
      startDate: new Date().toISOString(),
      isDelayed: false,
      delayDays: 0,
      tag: 'other',
      createdAt: new Date().toISOString(),
    };
    useClientStore.getState().addTask(task);
    return { ok: true, message: '✅ Tarea creada' };
  }

  if (action.tipo === 'actualizar_ropre') {
    const titulo = str(d, 'titulo');
    const tipo = str(d, 'tipo') as RopreType | undefined;
    const VALID: RopreType[] = ['result', 'objective', 'premise', 'risk', 'deliverable'];
    if (!titulo || !tipo || !VALID.includes(tipo)) {
      return { ok: false, message: 'El ítem ROPRE necesita tipo y título válidos.' };
    }
    const item: RopreItem = {
      id: genId(),
      clientId,
      type: tipo,
      title: titulo,
      description: str(d, 'descripcion'),
      riskLevel: tipo === 'risk' ? ((str(d, 'nivel_riesgo') as RiskLevel) || 'medium') : undefined,
      status: tipo === 'deliverable' ? 'todo' : undefined,
      targetValue: str(d, 'meta'),
      createdAt: new Date().toISOString(),
    };
    useRopreStore.getState().add(item);
    return { ok: true, message: '✅ ROPRE actualizado' };
  }

  if (action.tipo === 'crear_reunion') {
    const titulo = str(d, 'titulo');
    if (!titulo) return { ok: false, message: 'La reunión necesita un título.' };
    const enDias = num(d, 'en_dias') ?? 7;
    const tipoRaw = str(d, 'tipo');
    const VALID_MT: MeetingType[] = [
      'kickoff', 'weekly_metrics', 'content_strategy', 'ads_review',
      'monthly_closing', 'crisis', 'weekly_planning', 'ropre_strategy',
      'weekly_closing', 'general', 'management',
    ];
    const meeting: Meeting = {
      id: genId(),
      clientId,
      title: titulo,
      type: (tipoRaw && VALID_MT.includes(tipoRaw as MeetingType) ? tipoRaw : 'weekly_metrics') as MeetingType,
      scheduledAt: isoInDays(enDias),
      durationMin: 45,
      participants: [],
      notes: str(d, 'notas'),
    };
    useClientStore.getState().addMeeting(meeting);
    return { ok: true, message: '✅ Reunión agendada' };
  }

  return { ok: false, message: 'Acción no reconocida.' };
}
