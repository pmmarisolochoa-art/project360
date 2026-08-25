/**
 * /api/v1/deliverables
 *
 *   GET → entregables y links de la agencia de la key   (read:deliverables)
 *
 * Un entregable es un enlace a donde vive el trabajo de verdad (normalmente
 * Drive), con quién lo subió y en qué estado está. Puede colgar de una tarea
 * (`task_id`) o ir suelto.
 *
 * LO QUE NO DEVUELVE
 * Los entregables de una tarea PRIVADA. La tarea no se puede leer por esta API,
 * así que su entregable tampoco: sería la misma fuga por otra puerta. El filtro
 * vive dentro de `api_entregables_listar`, en la base, no aquí.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../_lib/auth';
import { filtrosEntregables, mensajeDeError } from '../_lib/esquemas';

export const config = { runtime: 'edge' };

async function listar(ctx: Contexto): Promise<Response> {
  const parsed = filtrosEntregables.safeParse(Object.fromEntries(ctx.params));
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const f = parsed.data;

  const { data, error: e } = await ctx.admin.rpc('api_entregables_listar', {
    p_agencia: ctx.agenciaId,
    p_client_id: f.client_id ?? null,
    p_estado: f.estado ?? null,
    p_limite: f.limite,
    p_offset: f.offset,
  });

  if (e) return errorInterno('GET /deliverables', e);

  const filas = (data ?? []) as unknown[];
  return exito({
    entregables: filas,
    paginacion: { limite: f.limite, offset: f.offset, hay_mas: filas.length === f.limite },
  });
}

export default proteger({
  GET: { scope: 'read:deliverables', ejecutar: listar },
});
