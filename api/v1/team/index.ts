/**
 * /api/v1/team
 *
 *   GET → fichas del equipo de la agencia de la key   (read:team)
 *
 * UNA PERSONA SALE VARIAS VECES, Y NO ES UN ERROR
 * En Project360 una persona tiene una ficha POR CLIENTE, porque su rol puede
 * cambiar según el cliente. Se devuelve así —el modelo real— y quien llame
 * agrupa por `nombre` si lo necesita. Aplanarlo aquí escondería de qué cliente
 * es cada asignación, que es justo el dato que hace falta.
 *
 * LO QUE NO DEVUELVE
 * Ni `email` ni `telefono`: son datos de contacto de personas, y ninguna
 * integración de gestión los necesita. Tampoco el `user_id`; solo se dice SI la
 * persona tiene cuenta (`tiene_usuario`), que es lo único accionable.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../_lib/auth';
import { filtrosEquipo, mensajeDeError } from '../_lib/esquemas';

export const config = { runtime: 'edge' };

async function listar(ctx: Contexto): Promise<Response> {
  const parsed = filtrosEquipo.safeParse(Object.fromEntries(ctx.params));
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const f = parsed.data;

  const { data, error: e } = await ctx.admin.rpc('api_equipo_listar', {
    p_agencia: ctx.agenciaId,
    p_client_id: f.client_id ?? null,
    p_limite: f.limite,
    p_offset: f.offset,
  });

  if (e) return errorInterno('GET /team', e);

  const filas = (data ?? []) as unknown[];
  return exito({
    equipo: filas,
    paginacion: { limite: f.limite, offset: f.offset, hay_mas: filas.length === f.limite },
  });
}

export default proteger({
  GET: { scope: 'read:team', ejecutar: listar },
});
