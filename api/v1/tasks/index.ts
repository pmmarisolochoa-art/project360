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

  const { data: id, error: e } = await ctx.admin.rpc('api_tarea_crear', {
    p_agencia: ctx.agenciaId,
    p_client_id: t.client_id,
    p_titulo: t.titulo,
    p_descripcion: t.descripcion ?? null,
    p_prioridad: t.prioridad,
    p_asignado_a: t.asignado_a ?? null,
    p_fecha_limite: t.fecha_limite ?? null,
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
