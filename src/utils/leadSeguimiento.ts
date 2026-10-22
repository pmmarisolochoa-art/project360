import type { Lead, LeadEvent } from '@/types/lead';

/**
 * Contadores básicos de seguimiento del Pipeline (founder, 08-oct-2026,
 * inspirados en el tablero "Gestión de leads" de otra agencia): de un
 * vistazo, quién llegó y a quién hay que empujar hoy.
 *
 * Los tres primeros son hechos directos (columnas existentes). "Sin
 * respuesta" es una HEURÍSTICA sobre inactividad — no es un estado que
 * alguien declare, se documenta como tal para que no se lea como un dato
 * exacto. No se agregó ninguna columna nueva a `leads`: todo sale de
 * columnas y `lead_events` ya existentes.
 *
 * La atribución de campaña / costo por lead-agenda (como en el tablero de
 * referencia) queda fuera a propósito — fase aparte, pendiente de cruzar con
 * gasto real de Meta Ads.
 */

export interface ContadoresSeguimiento {
  sinContactar: number;
  sinDueño: number;
  noShow: number;
  sinRespuesta: number;
}

export type SeguimientoFlag = keyof ContadoresSeguimiento;

const RE_NO_SHOW = /no\s*asisti|no-?show/i;

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Las banderas de seguimiento de UN lead — misma lógica exacta que
 * `calcularContadoresSeguimiento` usa para contar, extraída aquí para que el
 * Pipeline pueda FILTRAR por la misma regla con la que ya cuenta (clic en
 * "Sin respuesta" → ver justo esos leads, no una cifra suelta sin forma de
 * llegar a ellos — founder, 21-oct-2026).
 */
export function flagsDeSeguimiento(
  lead: Lead,
  eventosDelLead: LeadEvent[],
  ahoraMs: number,
  diasSinRespuesta: number,
): Set<SeguimientoFlag> {
  const flags = new Set<SeguimientoFlag>();
  if (!lead.setterId && !lead.closerId) flags.add('sinDueño');
  if (lead.resultado && RE_NO_SHOW.test(sinAcentos(lead.resultado))) flags.add('noShow');

  if (lead.etapa === 'nuevo') {
    const yaContactado = eventosDelLead.some((e) => e.etapaNueva === 'contactado');
    if (!yaContactado) flags.add('sinContactar');
  }

  if (lead.etapa === 'contactado') {
    const ultimo = eventosDelLead.reduce<LeadEvent | null>((max, e) => (!max || e.createdAt > max.createdAt ? e : max), null);
    const desde = ultimo ? new Date(ultimo.createdAt).getTime() : new Date(lead.createdAt).getTime();
    const umbralMs = diasSinRespuesta * 86400000;
    if (ahoraMs - desde > umbralMs) flags.add('sinRespuesta');
  }

  return flags;
}

function agruparEventosPorLead(events: LeadEvent[]): Map<string, LeadEvent[]> {
  const eventosPorLead = new Map<string, LeadEvent[]>();
  for (const e of events) {
    const lista = eventosPorLead.get(e.leadId) ?? [];
    lista.push(e);
    eventosPorLead.set(e.leadId, lista);
  }
  return eventosPorLead;
}

/** `diasSinRespuesta`: a partir de cuántos días contactado-sin-avance se cuenta como "sin respuesta". */
export function calcularContadoresSeguimiento(
  leads: Lead[],
  events: LeadEvent[],
  ahoraISO: string = new Date().toISOString(),
  diasSinRespuesta = 5,
): ContadoresSeguimiento {
  const eventosPorLead = agruparEventosPorLead(events);
  const ahora = new Date(ahoraISO).getTime();

  const contadores: ContadoresSeguimiento = { sinContactar: 0, sinDueño: 0, noShow: 0, sinRespuesta: 0 };
  for (const l of leads) {
    const flags = flagsDeSeguimiento(l, eventosPorLead.get(l.id) ?? [], ahora, diasSinRespuesta);
    for (const f of flags) contadores[f]++;
  }
  return contadores;
}
