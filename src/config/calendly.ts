/**
 * Integración con Calendly — reuniones agendadas por un lead, convertidas
 * en `Meeting` + avance de etapa del lead automáticamente.
 *
 * Mismo espíritu que `fathom.ts`/`paralelo.ts`: lista blanca declarada aquí,
 * nada se adivina. A diferencia de Fathom (que resuelve el cliente por
 * palabra clave en el título porque una sola llave ve TODA la cuenta),
 * Calendly se conecta por cliente — un cliente habilitado aquí corresponde a
 * una organización/cuenta de Calendly con su propio Personal Access Token y
 * signing key.
 *
 * Para habilitar un cliente nuevo: agrega su fila aquí (necesita sus propias
 * `CALENDLY_PERSONAL_ACCESS_TOKEN_<CLIENTE>` / `CALENDLY_SIGNING_KEY_<CLIENTE>`
 * si llega a haber más de un cliente — hoy con uno solo basta con las env
 * vars sin sufijo, ver `api/calendly/webhook.ts`).
 */

export interface CalendlyCliente {
  /** Cliente de Project360, tal cual está escrito allí. */
  cliente: string;
  clientId: string;
  nota: string;
}

export const CALENDLY_CLIENTES: CalendlyCliente[] = [
  {
    cliente: 'Alejo Luengas',
    clientId: 'e102eb72-232e-4884-b116-3cc473ed150e',
    nota: 'Habilitado 2026-10-08. Único closer agendando por Calendly hoy.',
  },
];

/** `external_id` de una reunión creada desde un invitee de Calendly. */
export const externalIdInviteeCalendly = (inviteeUri: string): string => `calendly:${inviteeUri}`;
