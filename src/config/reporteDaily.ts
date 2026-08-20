/**
 * Configuración del reporte de la Daily (plantilla 1 de Ikigai).
 *
 * Vive en código y no en la base porque cambia poco y hay que poder leerlo de
 * un vistazo. Editar aquí y todo el reporte lo respeta.
 */

import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';

/**
 * Las áreas de la sección 2 del reporte, en el orden en que salen.
 *
 * `persona` es solo una pista para la IA: la ayuda a atribuir lo que se dijo
 * cuando en la reunión se nombra a alguien y no al área ("Roberto va a montar
 * la página" → Operaciones). NO se usa para asignar nada.
 */
export const AREAS_DAILY: Array<{ area: string; persona?: string }> = [
  { area: 'Operaciones', persona: 'Roberto' },
  { area: 'Comercial', persona: 'Luis' },
  { area: 'Tráfico', persona: 'David Castaño' },
  { area: 'Project Management', persona: 'Marisol' },
  { area: 'IA / App Ikigai' },
];

/**
 * ¿Esta reunión se reporta con la plantilla de Daily?
 *
 * De momento se decide por el nombre, y es un apaño consciente: no existe un
 * tipo de reunión "daily" en la app, y los tipos que hay (`management`,
 * `general`) también los usan otras reuniones internas. Contra los datos reales
 * funciona — Paralelo las nombra "Daily sprint Ikigai" y "Daily planeación
 * semana Ikigai".
 *
 * El arreglo de verdad es poder elegir la plantilla al crear la reunión. Se
 * hará cuando estén las cinco; montar el selector con una sola sería decidir a
 * ciegas cómo se agrupan.
 *
 * Se exige además que sea del cliente-agencia: una reunión de cliente que se
 * llame "daily" no es esta reunión.
 */
export function esDaily(client: Pick<Client, 'isAgency'>, meeting: Pick<Meeting, 'title'>): boolean {
  return !!client.isAgency && /\bdail(y|ies)\b/i.test(meeting.title ?? '');
}

/** Cuántos días atrás se busca la daily anterior para el seguimiento. */
export const VENTANA_DAILY_ANTERIOR_DIAS = 14;
