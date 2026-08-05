/**
 * /api/v1/tasks/:id
 *
 *   GET → una tarea por id (read:tasks)
 *
 * Si la tarea no existe, es de otra agencia o es privada, la respuesta es la
 * MISMA: 404. Devolver 403 para una tarea ajena confirmaría que ese id existe,
 * y eso ya es información que no le debemos a nadie.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../../_lib/auth';

export const config = { runtime: 'edge' };

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function obtener(ctx: Contexto): Promise<Response> {
  // `/api/v1/tasks/<id>` → el id es el último segmento.
  const id = ctx.segmentos[ctx.segmentos.length - 1] ?? '';

  // Se valida la forma antes de consultar: un id que no es uuid haría fallar
  // a Postgres con un 22P02, y ese error terminaría siendo un 500 por algo
  // que en realidad es culpa de quien llama.
  if (!ES_UUID.test(id)) {
    return error(CODIGOS.DATOS_INVALIDOS, 'El id de la tarea debe ser un uuid válido.', 400);
  }

  const { data, error: e } = await ctx.admin.rpc('api_tarea_obtener', {
    p_agencia: ctx.agenciaId,
    p_id: id,
  });

  if (e) return errorInterno('GET /tasks/:id', e);

  const tarea = Array.isArray(data) ? data[0] : null;
  if (!tarea) {
    return error(CODIGOS.NO_ENCONTRADO, 'Tarea no encontrada.', 404);
  }

  return exito({ tarea });
}

export default proteger({
  GET: { scope: 'read:tasks', ejecutar: obtener },
});
