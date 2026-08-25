/**
 * /api/v1/ropre
 *
 *   GET → items ROPRE de la agencia de la key   (read:ropre)
 *
 * QUÉ ES ROPRE
 * El marco de planeación por cliente: **R**esultados, **O**bjetivos,
 * **P**remisas, **R**iesgos y **E**ntregables. El campo `tipo` es literalmente
 * una de esas cinco letras (`result`, `objective`, `premise`, `risk`,
 * `deliverable`), y se puede filtrar por él.
 *
 * Un riesgo trae su mitigación emparejada, y un entregable trae su fecha y su
 * responsable. Si un entregable se promovió a tarea, `tarea_id` dice cuál.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../_lib/auth';
import { filtrosRopre, mensajeDeError } from '../_lib/esquemas';

export const config = { runtime: 'edge' };

async function listar(ctx: Contexto): Promise<Response> {
  const parsed = filtrosRopre.safeParse(Object.fromEntries(ctx.params));
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const f = parsed.data;

  const { data, error: e } = await ctx.admin.rpc('api_ropre_listar', {
    p_agencia: ctx.agenciaId,
    p_client_id: f.client_id ?? null,
    p_tipo: f.tipo ?? null,
    p_limite: f.limite,
    p_offset: f.offset,
  });

  if (e) return errorInterno('GET /ropre', e);

  const filas = (data ?? []) as unknown[];
  return exito({
    items: filas,
    paginacion: { limite: f.limite, offset: f.offset, hay_mas: filas.length === f.limite },
  });
}

export default proteger({
  GET: { scope: 'read:ropre', ejecutar: listar },
});
