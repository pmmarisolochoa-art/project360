/**
 * /api/v1/tasks
 *
 *   GET  → lista tareas de la agencia de la key   (read:tasks)
 *   POST → crea una tarea                          (write:tasks)
 *
 * Ninguna de las dos consulta `tasks` directamente: llaman a las funciones
 * `api_tareas_listar` / `api_tarea_crear` de la migración 033, que reciben el
 * `agencia_id` y hacen el filtro dentro de la base. Ver el comentario de
 * cabecera de esa migración para el porqué.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../_lib/auth';
import { crearTarea, filtrosTareas, mensajeDeError } from '../_lib/esquemas';
import { fechaLimiteDesdeSLA } from '../../../src/config/taskSLA';
import { normTaskTitle } from '../../../src/utils/taskDedup';

export const config = { runtime: 'edge' };

async function listar(ctx: Contexto): Promise<Response> {
  const parsed = filtrosTareas.safeParse(Object.fromEntries(ctx.params));
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const f = parsed.data;

  const { data, error: e } = await ctx.admin.rpc('api_tareas_listar', {
    p_agencia: ctx.agenciaId,
    p_client_id: f.client_id ?? null,
    p_status: f.status ?? null,
    p_desde: f.desde ?? null,
    p_hasta: f.hasta ?? null,
    p_limite: f.limite,
    p_offset: f.offset,
  });

  if (e) return errorInterno('GET /tasks', e);

  const filas = (data ?? []) as unknown[];
  return exito({
    tareas: filas,
    paginacion: {
      limite: f.limite,
      offset: f.offset,
      // No se devuelve un total: contarlo obligaría a una segunda query sobre
      // toda la tabla en cada llamada. `hay_mas` es lo que la integración
      // necesita para saber si pedir la página siguiente.
      hay_mas: filas.length === f.limite,
    },
  });
}

async function crear(ctx: Contexto): Promise<Response> {
  const parsed = crearTarea.safeParse(ctx.body ?? {});
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const t = parsed.data;

  /**
   * ANTI-DUPLICADOS POR TÍTULO (25-ago-2026).
   *
   * Hasta hoy este guard vivía SOLO en el navegador (`dedupeExtracted`), donde
   * protege las tareas que se sacan de una reunión. Con la app de Ikigai a punto
   * de ser donde la gente trabaja, allá no hay navegador nuestro: cada reintento
   * o cada doble clic crearía una copia.
   *
   * Se compara con `normTaskTitle`, la MISMA función que usa la interfaz. No se
   * reescribe la limpieza de texto en SQL a propósito: dos copias de la misma
   * lógica en dos idiomas se separan, y ya nos costó dos bugs (11 y 14 de
   * agosto). Una sola función, aunque cueste una consulta extra.
   *
   * SE SALTA SI MANDAN `external_id`: ahí quien llama ya está gestionando la
   * identidad de la tarea, y la función SQL es idempotente por ese campo. Dos
   * tareas con el mismo título pero distinto external_id son dos compromisos
   * distintos, y decidirlo por el texto sería adivinar.
   *
   * LÍMITE CONOCIDO: mira hasta 500 tareas abiertas del cliente. Por encima de
   * eso podría no ver una. Se dice aquí en vez de fingir que es infalible.
   */
  if (!t.external_id) {
    const { data: abiertas } = await ctx.admin.rpc('api_tareas_listar', {
      p_agencia: ctx.agenciaId,
      p_client_id: t.client_id,
      p_status: null,
      p_desde: null,
      p_hasta: null,
      p_limite: 500,
      p_offset: 0,
    });
    // `titulo` y `estado` son los nombres que devuelve `api_tareas_listar`.
    const objetivo = normTaskTitle(t.titulo);
    const yaExiste = ((abiertas ?? []) as Array<{ id: string; titulo: string; estado: string }>)
      .find((x) => x.estado !== 'completed' && normTaskTitle(String(x.titulo ?? '')) === objetivo);
    if (yaExiste?.id) {
      return error(
        CODIGOS.YA_EXISTE,
        `Ya existe una tarea abierta con ese título para este cliente (${yaExiste.id}). ` +
          'Si de verdad son dos compromisos distintos, mándala con un external_id propio.',
        409,
      );
    }
  }

  const { data: id, error: e } = await ctx.admin.rpc('api_tarea_crear', {
    p_agencia: ctx.agenciaId,
    p_client_id: t.client_id,
    p_titulo: t.titulo,
    p_descripcion: t.descripcion ?? null,
    p_prioridad: t.prioridad,
    p_asignado_a: t.asignado_a ?? null,
    /**
     * Si no mandan fecha, la pone NUESTRO SLA según la etiqueta — no el
     * `now() + 7 días` de la base, que es un número inventado que no respeta
     * los tiempos acordados con los clientes.
     *
     * Es la misma decisión que se tomó el 13-ago para las tareas de Paralelo:
     * la fecha de entrega la manda nuestro acuerdo, no quien llama.
     */
    p_fecha_limite: t.fecha_limite ?? fechaLimiteDesdeSLA(t.etiqueta),
    p_etiqueta: t.etiqueta ?? null,
    p_external_id: t.external_id ?? null,
  });

  if (e) {
    // La función levanta esta excepción cuando el cliente no es de la agencia
    // de la key. Se responde 400 con un mensaje claro —y NO 403— porque desde
    // fuera "no existe" y "no es tuyo" tienen que verse igual.
    //
    // Este es el camino por el que un proyecto que existe en la app externa
    // pero no está dado de alta acá queda fuera AVISANDO, en vez de entrar
    // como fila huérfana o desaparecer en silencio.
    if (e.message?.includes('cliente_no_encontrado')) {
      return error(
        CODIGOS.NO_ENCONTRADO,
        'No existe un cliente con ese client_id. Verifica el id con GET /api/v1/tasks.',
        400,
      );
    }
    return errorInterno('POST /tasks', e);
  }

  // Se relee para devolver la fila completa: así la integración se queda con
  // todos los campos sin tener que hacer un GET después. Y si la tarea ya
  // existía (mismo external_id), devuelve la que había — la creación es
  // idempotente, un reintento no duplica.
  const { data: filas } = await ctx.admin.rpc('api_tarea_obtener', {
    p_agencia: ctx.agenciaId,
    p_id: id,
  });

  const tarea = Array.isArray(filas) ? filas[0] : null;
  return exito({ tarea: tarea ?? { id } }, 201);
}

export default proteger({
  GET: { scope: 'read:tasks', ejecutar: listar },
  POST: { scope: 'write:tasks', ejecutar: crear },
});
