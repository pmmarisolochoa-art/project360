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

const RE_NO_SHOW = /no\s*asisti|no-?show/i;

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** `diasSinRespuesta`: a partir de cuántos días contactado-sin-avance se cuenta como "sin respuesta". */
export function calcularContadoresSeguimiento(
  leads: Lead[],
  events: LeadEvent[],
  ahoraISO: string = new Date().toISOString(),
  diasSinRespuesta = 5,
): ContadoresSeguimiento {
  const eventosPorLead = new Map<string, LeadEvent[]>();
  for (const e of events) {
    const lista = eventosPorLead.get(e.leadId) ?? [];
    lista.push(e);
    eventosPorLead.set(e.leadId, lista);
  }

  const ahora = new Date(ahoraISO).getTime();
  const umbralMs = diasSinRespuesta * 86400000;

  let sinContactar = 0;
  let sinDueño = 0;
  let noShow = 0;
  let sinRespuesta = 0;

  for (const l of leads) {
    if (!l.setterId && !l.closerId) sinDueño++;
    if (l.resultado && RE_NO_SHOW.test(sinAcentos(l.resultado))) noShow++;

    const propios = eventosPorLead.get(l.id) ?? [];

    if (l.etapa === 'nuevo') {
      const yaContactado = propios.some((e) => e.etapaNueva === 'contactado');
      if (!yaContactado) sinContactar++;
    }

    if (l.etapa === 'contactado') {
      const ultimo = propios.reduce<LeadEvent | null>((max, e) => (!max || e.createdAt > max.createdAt ? e : max), null);
      const desde = ultimo ? new Date(ultimo.createdAt).getTime() : new Date(l.createdAt).getTime();
      if (ahora - desde > umbralMs) sinRespuesta++;
    }
  }

  return { sinContactar, sinDueño, noShow, sinRespuesta };
}
