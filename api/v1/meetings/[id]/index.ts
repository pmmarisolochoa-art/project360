/**
 * /api/v1/meetings/:id
 *
 *   GET → una reunión por id (read:meetings)
 *
 * Igual que en tareas: inexistente, de otra agencia o privada devuelven todas
 * 404. Y tampoco incluye transcripción ni notas — ver el comentario de
 * `meetings/index.ts`.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../../_lib/auth';

export const config = { runtime: 'edge' };

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function obtener(ctx: Contexto): Promise<Response> {
  const id = ctx.segmentos[ctx.segmentos.length - 1] ?? '';
  if (!ES_UUID.test(id)) {
    return error(CODIGOS.DATOS_INVALIDOS, 'El id de la reunión debe ser un uuid válido.', 400);
  }

  const { data, error: e } = await ctx.admin.rpc('api_reunion_obtener', {
    p_agencia: ctx.agenciaId,
    p_id: id,
  });

  if (e) return errorInterno('GET /meetings/:id', e);

  const reunion = Array.isArray(data) ? data[0] : null;
  if (!reunion) {
    return error(CODIGOS.NO_ENCONTRADO, 'Reunión no encontrada.', 404);
  }

  return exito({ reunion });
}

export default proteger({
  GET: { scope: 'read:meetings', ejecutar: obtener },
});
