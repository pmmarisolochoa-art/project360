/**
 * /api/v1/tasks/:id/status
 *
 *   PATCH → cambia el estado de una tarea (write:tasks)
 *
 * Es un endpoint deliberadamente estrecho: NO es "editar tarea". Solo puede
 * mover la columna `status`. Una integración externa con un bug no puede
 * reescribir el título, la fecha límite ni el responsable del trabajo que hizo
 * el equipo — el peor caso es una tarea en el estado equivocado, que se
 * arregla con un clic.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../../_lib/auth';
import { cambiarEstado, mensajeDeError } from '../../_lib/esquemas';

export const config = { runtime: 'edge' };

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cambiar(ctx: Contexto): Promise<Response> {
  // `/api/v1/tasks/<id>/status` → el id es el PENÚLTIMO segmento.
  const id = ctx.segmentos[ctx.segmentos.length - 2] ?? '';
  if (!ES_UUID.test(id)) {
    return error(CODIGOS.DATOS_INVALIDOS, 'El id de la tarea debe ser un uuid válido.', 400);
  }

  const parsed = cambiarEstado.safeParse(ctx.body ?? {});
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }

  const { data: anterior, error: e } = await ctx.admin.rpc('api_tarea_estado', {
    p_agencia: ctx.agenciaId,
    p_id: id,
    p_estado: parsed.data.estado,
  });

  if (e) {
    // No existe / de otra agencia / privada → los tres son 404.
    if (e.message?.includes('tarea_no_encontrada')) {
      return error(CODIGOS.NO_ENCONTRADO, 'Tarea no encontrada.', 404);
    }
    // Regla acordada con Paralelo: la revisión es nuestro proceso interno, no
    // el suyo. 409 (conflicto) y no 403, porque no es un problema de permisos:
    // es que la tarea está en un estado que no se toca desde fuera.
    if (e.message?.includes('tarea_en_revision')) {
      return error(
        CODIGOS.DATOS_INVALIDOS,
        'Esta tarea está en revisión y no puede cambiarse desde la API. Se resuelve dentro de Project360.',
        409,
      );
    }
    return errorInterno('PATCH /tasks/:id/status', e);
  }

  const { data: filas } = await ctx.admin.rpc('api_tarea_obtener', {
    p_agencia: ctx.agenciaId,
    p_id: id,
  });

  return exito({
    tarea: Array.isArray(filas) ? filas[0] : null,
    estado_anterior: anterior,
  });
}

export default proteger({
  PATCH: { scope: 'write:tasks', ejecutar: cambiar },
});
