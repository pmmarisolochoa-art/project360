/**
 * Repositorio centralizado de keywords para extracción heurística de tareas.
 *
 * Editar este archivo para mejorar la precisión de "Extraer tareas" en el
 * MeetingDrawer cuando NO hay crédito Anthropic (fallback). Todo es data-driven:
 * añade keywords a las listas sin tocar la lógica.
 *
 * Estructura:
 *  - ACTION_VERBS: verbos en infinitivo que indican que una línea es una tarea.
 *  - BULLET_REGEXES: patrones de bullets/checkboxes que delimitan tareas.
 *  - URGENCY_RULES: palabras clave → días de deadline.
 *  - ROLE_KEYWORDS: palabras clave → TeamRoleSlug.
 *  - PRIORITY_KEYWORDS: palabras clave → P1/P2/P3.
 *  - TAG_KEYWORDS: palabras clave → TaskTag.
 *
 * Cada categoría se evalúa case-insensitive con `\b` word-boundary.
 */

import type { TeamRoleSlug } from '@/types/team';
import type { TaskPriority, TaskTag } from '@/types/task';

/* ─────────────── Verbos de acción ─────────────── */
// Una línea que empiece con uno de estos (o tras un bullet) se considera tarea.
export const ACTION_VERBS: string[] = [
  // Generales
  'hacer', 'realizar', 'completar', 'terminar', 'finalizar', 'cerrar',
  'crear', 'generar', 'producir', 'preparar', 'armar', 'montar',
  'enviar', 'mandar', 'compartir', 'entregar', 'pasar',
  'revisar', 'auditar', 'verificar', 'validar', 'aprobar', 'chequear',
  'definir', 'documentar', 'aclarar', 'especificar', 'detallar',
  'investigar', 'analizar', 'estudiar', 'evaluar', 'medir', 'monitorear',
  'coordinar', 'agendar', 'organizar', 'programar', 'calendarizar',
  'llamar', 'hablar', 'contactar', 'reunirse',
  'escribir', 'redactar', 'editar', 'corregir',
  'publicar', 'postear', 'subir', 'lanzar', 'salir',
  'configurar', 'instalar', 'implementar', 'integrar', 'conectar',
  'actualizar', 'ajustar', 'optimizar', 'mejorar', 'refactorizar',
  'diseñar', 'graficar', 'maquetar', 'prototipar',
  'capacitar', 'entrenar', 'enseñar', 'explicar',
  'presentar', 'reportar', 'mostrar', 'exponer',
  'descargar', 'exportar', 'importar', 'migrar', 'respaldar',
  'grabar', 'filmar', 'editar', 'producir',
  'seguir', 'dar seguimiento', 'darle seguimiento', 'hacer follow-up',
  'investigar', 'profundizar',
  // Marketing-specific
  'pautar', 'segmentar', 'audiencia', 'lookalike',
  'a/b test', 'testear', 'probar',
  'escalar', 'pausar', 'duplicar',
];

/* ─────────────── Patrones de bullets ─────────────── */
// Capturan el contenido tras un prefijo de bullet (grupo 1 = contenido).
export const BULLET_REGEXES: RegExp[] = [
  /^[-*•▪◦]\s+(.+)$/, // -, *, •, ▪, ◦
  /^\d+[.)]\s+(.+)$/, // 1., 1)
  /^\[\s?\]\s+(.+)$/i, // [ ]
  /^[☐□]\s+(.+)$/, // checkboxes unicode
  /^✅\s+(.+)$/, // ya marcadas (también las tomamos como tareas posibles)
  /^→\s+(.+)$/, // flechas como bullet
  /^>\s+(.+)$/, // blockquote como bullet
];

/* ─────────────── Reglas de urgencia ─────────────── */
// Match en el texto completo (case-insensitive). El primero que matchea gana.
export interface UrgencyRule {
  pattern: RegExp;
  dueInDays: number;
  priority?: TaskPriority; // opcional — también sube prioridad
}

export const URGENCY_RULES: UrgencyRule[] = [
  // P1 — Urgente (1-2 días)
  { pattern: /\b(urgente|asap|ya|hoy|ahora|crisis|emergencia|inmediato|inmediatamente|prioridad\s+alta|alta\s+prioridad|p1)\b/i, dueInDays: 2, priority: 'P1' },
  { pattern: /\bmañana\b/i, dueInDays: 1, priority: 'P1' },
  // P1 — Esta semana
  { pattern: /\b(esta\s+semana|antes\s+del\s+viernes|antes\s+del\s+jueves|fin\s+de\s+semana)\b/i, dueInDays: 5, priority: 'P1' },
  // P2 — Normal (próxima semana)
  { pattern: /\b(próxima\s+semana|la\s+otra\s+semana|en\s+una\s+semana|en\s+\d+\s+días?)\b/i, dueInDays: 7, priority: 'P2' },
  // P3 — Baja (mediano plazo)
  { pattern: /\b(sin\s+prisa|cuando\s+puedas|cuando\s+haya\s+tiempo|próximo\s+mes|baja\s+prioridad|prioridad\s+baja|backlog|nice\s+to\s+have|p3)\b/i, dueInDays: 21, priority: 'P3' },
  { pattern: /\b(en\s+dos\s+semanas|quincena)\b/i, dueInDays: 14, priority: 'P3' },
];

/* ─────────────── Keywords → Rol ─────────────── */
// Match en el texto. La primera regla cuyo pattern matchea define el rol.
export interface RoleKeywordRule {
  pattern: RegExp;
  role: TeamRoleSlug;
}

export const ROLE_KEYWORDS: RoleKeywordRule[] = [
  // Media Buyer (ADS / pauta / campañas)
  {
    pattern: /\b(ads?|anuncios?|campañas?|pauta|meta\s+ads|facebook\s+ads|google\s+ads|tiktok\s+ads|youtube\s+ads|cpa|cpl|cpm|cpc|roas|ctr|cvr|budget|presupuesto\s+publicitario|segmentación|lookalike|audiencias?|retargeting|conversiones|píxel|pixel|business\s+manager|bm)\b/i,
    role: 'media_buyer',
  },
  // Copywriter
  {
    pattern: /\b(copy|copywriting|texto|textos|guion|guión|caption|hook|email|newsletter|asunto|subject\s+line|cta|llamado\s+a\s+la\s+acción|argumento|story\s*telling|storytelling|redacción|copia)\b/i,
    role: 'copywriter',
  },
  // Designer
  {
    pattern: /\b(diseño|diseñar|creatividad(?:es)?|gráfico|gráfica|visual|mockup|prototipo|figma|canva|photoshop|illustrator|after\s+effects|premiere|video|reel|reels|edición\s+de\s+video|thumbnail|portada|cover|key\s+visual|kv)\b/i,
    role: 'designer',
  },
  // Funnel Builder
  {
    pattern: /\b(funnel|embudo|landing|landing\s+page|sales\s+page|checkout|carrito|integración|automatización|zapier|make|n8n|webhook|api|tracking|gtm|tag\s+manager|analytics|ga4|hotjar|clarity|formulario|opt-?in)\b/i,
    role: 'funnel_builder',
  },
  // Community
  {
    pattern: /\b(comunidad|community|manychat|dm|mensaje\s+directo|inbox|comentarios?|engagement|respuesta\s+a\s+clientes|atención\s+al\s+cliente|whatsapp|telegram|instagram\s+stories|stories|moderación)\b/i,
    role: 'community',
  },
  // Strategist (catch-all estratégico)
  {
    pattern: /\b(estrategia|estratégico|plan|planeación|planeamiento|roadmap|okr|kpi|brief|brifing|brieff?ing|cliente|reunión|junta|propuesta|cotización|onboarding|kickoff|reporte|reporting|insight|análisis\s+estratégico|benchmark|competencia|posicionamiento|ropre)\b/i,
    role: 'strategist',
  },
];

/* ─────────────── Keywords → Etiqueta (TaskTag) ─────────────── */
export interface TagKeywordRule {
  pattern: RegExp;
  tag: TaskTag;
}

export const TAG_KEYWORDS: TagKeywordRule[] = [
  { pattern: /\b(ads?|anuncios?|campañas?|pauta|meta\s+ads|google\s+ads|roas|cpa|cpl)\b/i, tag: 'ads' },
  { pattern: /\b(contenido|post|reel|reels|stories|carrusel|publicación|tiktok|instagram|youtube|blog|video|copy|caption)\b/i, tag: 'content' },
  { pattern: /\b(reunión|junta|meeting|call|llamada|videollamada|zoom|meet)\b/i, tag: 'meeting' },
  { pattern: /\b(entregable|deliverable|entrega|enviar\s+al\s+cliente|aprobación)\b/i, tag: 'deliverable' },
  { pattern: /\b(ropre|reporte\s+operativo|reporte\s+semanal|reporte\s+mensual)\b/i, tag: 'ropre' },
  { pattern: /\b(estrategia|plan|planeación|brief|okr|kpi|benchmark|análisis\s+estratégico|roadmap|onboarding|kickoff)\b/i, tag: 'strategy' },
];

/* ─────────────── Keywords → Prioridad explícita ─────────────── */
// Estas marcan prioridad SIN cambiar dueInDays (las urgencias ya lo hacen).
export interface PriorityKeywordRule {
  pattern: RegExp;
  priority: TaskPriority;
}

export const PRIORITY_KEYWORDS: PriorityKeywordRule[] = [
  { pattern: /\b(crítico|critical|bloqueante|blocker|p1)\b/i, priority: 'P1' },
  { pattern: /\b(importante|p2)\b/i, priority: 'P2' },
  { pattern: /\b(opcional|nice\s+to\s+have|backlog|p3|cuando\s+puedas)\b/i, priority: 'P3' },
];

/* ─────────────── Configuración general ─────────────── */
export const EXTRACTION_CONFIG = {
  maxTasks: 8,
  minLineLength: 8,
  maxLineLength: 220,
  defaultDueInDays: 7,
  defaultPriority: 'P2' as TaskPriority,
  defaultTag: 'other' as TaskTag,
};
