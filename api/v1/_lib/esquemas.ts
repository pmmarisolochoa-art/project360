/**
 * Validación de todo lo que entra a la API pública.
 *
 * Nada llega a la base sin pasar por acá. La regla es `.strict()`: si el
 * request trae un campo que no está declarado, se RECHAZA en vez de ignorarlo.
 * Ignorar campos desconocidos deja a una integración creyendo que mandó algo
 * que nunca se guardó — el fallo silencioso otra vez.
 */

import { z } from 'zod';
// Ruta relativa: `api/` compila con su propio tsconfig, sin el atajo `@/`.
import { TASK_TAGS } from '../../../src/types/task';

/**
 * Los 5 estados que acepta el CHECK de `tasks.status` en Postgres. Si esta
 * lista y la de la base se separan, el INSERT se rechaza con un error críptico:
 * la trampa que ya documentamos dos veces en este proyecto.
 */
export const ESTADOS = ['pending', 'in_progress', 'in_review', 'completed', 'blocked'] as const;

/**
 * Las 7 etiquetas válidas. NO se copian aquí: se importan de `types/task.ts`,
 * que es la fuente única. Una lista repetida es una lista que algún día se
 * separa — y ya nos pasó dos veces con los CHECK de Postgres.
 *
 * Antes este campo aceptaba TEXTO LIBRE de 60 caracteres. Como el SLA se busca
 * por etiqueta, un "Ads " con mayúscula o con espacio entraba sin queja y esa
 * tarea quedaba fuera de toda medición de tiempos, en silencio.
 */
export const ETIQUETAS = TASK_TAGS;

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
 * Texto de entrada: limpia, recorta espacios y limita el largo.
 *
 * SOBRE "SANITIZAR": la inyección SQL aquí no es posible por construcción. La
 * API no arma consultas concatenando texto — llama funciones de Postgres con
 * parámetros, así que un valor como `'; drop table tasks; --` se guarda como
 * lo que es: un título feo. No hay nada que escapar.
 *
 * Lo que sí hay que limpiar son los caracteres de control:
 *
 *   · El byte nulo (`\u0000`) NO se puede guardar en una columna `text` de
 *     Postgres. Un JSON que lo traiga hace fallar el INSERT con un error
 *     críptico (22P05) que se vería como un 500 nuestro cuando en realidad es
 *     un dato malo de quien llama.
 *   · El resto de caracteres de control no se ven pero rompen la interfaz, los
 *     PDF y los correos. Se quitan sin avisar: no aportan nada y nadie los
 *     escribe a propósito.
 *
 * El límite de largo tampoco es cosmético — sin él, un título de 2 MB entra en
 * la base y después revienta cada PDF y cada vista que lo intente pintar.
 */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const limpiar = (s: string) => s.replace(CONTROL, '').trim();

/**
 * `min` va como parámetro y no encadenado con `.min()` porque después del
 * `.transform()` el esquema ya no es un `ZodString` y ese método no existe.
 * Además así el largo se mide sobre el texto YA limpio: un título hecho solo
 * de caracteres invisibles cuenta como vacío, que es lo correcto.
 */
const texto = (max: number, min = 0) =>
  z
    .string()
    .transform(limpiar)
    .refine((v) => v.length >= min, { message: 'No puede estar vacío.' })
    .refine((v) => v.length <= max, { message: `Máximo ${max} caracteres.` });

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
/* ── Filtros de las lecturas nuevas (Paso 2) ─────────────────────────────── */

export const filtrosClientes = z.object({
  status: z.enum(['onboarding', 'planning', 'active', 'paused', 'completed']).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const filtrosEquipo = z.object({
  client_id: uuid.optional(),
  limite: z.coerce.number().int().min(1).max(300).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const filtrosRopre = z.object({
  client_id: uuid.optional(),
  tipo: z.enum(['result', 'objective', 'premise', 'risk', 'deliverable']).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const filtrosEntregables = z.object({
  client_id: uuid.optional(),
  estado: texto(40).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const crearTarea = z
  .object({
    client_id: uuid,
    titulo: texto(300, 1),
    descripcion: texto(5000).optional(),
    prioridad: z.enum(PRIORIDADES).default('P2'),
    asignado_a: texto(120).optional(),
    fecha_limite: fechaISO.optional(),
    etiqueta: z
      .enum(ETIQUETAS, {
        errorMap: () => ({ message: `Etiqueta inválida. Valores permitidos: ${ETIQUETAS.join(', ')}.` }),
      })
      .optional(),
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
    titulo: texto(300, 1),
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
