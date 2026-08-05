/**
 * Validación de todo lo que entra a la API pública.
 *
 * Nada llega a la base sin pasar por acá. La regla es `.strict()`: si el
 * request trae un campo que no está declarado, se RECHAZA en vez de ignorarlo.
 * Ignorar campos desconocidos deja a una integración creyendo que mandó algo
 * que nunca se guardó — el fallo silencioso otra vez.
 */

import { z } from 'zod';

/**
 * Los 5 estados que acepta el CHECK de `tasks.status` en Postgres. Si esta
 * lista y la de la base se separan, el INSERT se rechaza con un error críptico:
 * la trampa que ya documentamos dos veces en este proyecto.
 */
export const ESTADOS = ['pending', 'in_progress', 'in_review', 'completed', 'blocked'] as const;

/** Prioridades del CHECK de `tasks.priority`. */
export const PRIORIDADES = ['P1', 'P2', 'P3'] as const;

/**
 * Tipos de reunión. Espejo del union `MeetingType` de src/types/meeting.ts.
 *
 * OJO: la migración 022 QUITÓ el CHECK de `meetings.type` en la base
 * justamente para que agregar un tipo no rompiera la app. O sea: la base ya no
 * valida esto, esta lista es la única defensa. Un tipo inventado entraría sin
 * queja y aparecería roto en la interfaz.
 */
export const TIPOS_REUNION = [
  'kickoff',
  'weekly_metrics',
  'content_strategy',
  'ads_review',
  'monthly_closing',
  'crisis',
  'weekly_planning',
  'ropre_strategy',
  'weekly_closing',
  'general',
  'management',
] as const;

/**
 * Texto de entrada: recorta espacios y limita el largo.
 *
 * El límite no es cosmético — sin él, un título de 2 MB entra en la base y
 * después revienta cada PDF y cada vista que lo intente pintar.
 */
const texto = (max: number) => z.string().trim().max(max);

/** uuid: la forma que espera Postgres. Un id mal formado da error 22P02. */
const uuid = z.string().uuid('El id debe ser un uuid válido.');

/** Fecha ISO. Se acepta con o sin hora; se normaliza a ISO completo. */
const fechaISO = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida. Usa formato ISO (2026-08-20 o 2026-08-20T15:00:00Z).')
  .transform((v) => new Date(v).toISOString());

// ── Filtros de listado (query string) ────────────────────────────────────────
export const filtrosTareas = z.object({
  client_id: uuid.optional(),
  status: z.enum(ESTADOS).optional(),
  desde: fechaISO.optional(),
  hasta: fechaISO.optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const filtrosReuniones = z.object({
  client_id: uuid.optional(),
  desde: fechaISO.optional(),
  hasta: fechaISO.optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Cuerpos de escritura ─────────────────────────────────────────────────────
export const crearTarea = z
  .object({
    client_id: uuid,
    titulo: texto(300).min(1, 'El título no puede estar vacío.'),
    descripcion: texto(5000).optional(),
    prioridad: z.enum(PRIORIDADES).default('P2'),
    asignado_a: texto(120).optional(),
    fecha_limite: fechaISO.optional(),
    etiqueta: texto(60).optional(),
    /**
     * El id de la tarea en la plataforma externa. Es lo que permite que un
     * reintento no cree una tarea duplicada: la función SQL lo usa como
     * llave de idempotencia.
     */
    external_id: texto(120).optional(),
  })
  .strict();

export const cambiarEstado = z
  .object({
    estado: z.enum(ESTADOS, {
      errorMap: () => ({ message: `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}.` }),
    }),
  })
  .strict();

export const crearReunion = z
  .object({
    client_id: uuid,
    titulo: texto(300).min(1, 'El título no puede estar vacío.'),
    tipo: z.enum(TIPOS_REUNION, {
      errorMap: () => ({ message: `Tipo inválido. Valores permitidos: ${TIPOS_REUNION.join(', ')}.` }),
    }),
    programada_en: fechaISO,
    duracion_min: z.coerce.number().int().min(5).max(600).default(30),
    agenda: texto(5000).optional(),
    enlace_videollamada: z.string().trim().url('El enlace debe ser una URL válida.').max(500).optional(),
  })
  .strict();

/**
 * Convierte los errores de Zod en un mensaje corto y legible.
 * No expone la estructura interna: solo qué campo está mal y por qué.
 */
export function mensajeDeError(e: z.ZodError): string {
  return e.issues
    .slice(0, 4)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join(' · ');
}
