/**
 * /api/v1/clients
 *
 *   GET → lista los clientes de la agencia de la key   (read:clients)
 *
 * LO QUE NO DEVUELVE, Y ES A PROPÓSITO
 * `api_clientes_listar` deja fuera `onboarding_data` y `ai_brain_data`: el
 * negocio del cliente, su oferta, su narrativa de marca y sus buyer personas.
 * Es la inteligencia comercial más sensible de la base, y ninguna integración
 * de gestión la necesita para funcionar. Si algún día hiciera falta, sería un
 * permiso aparte y una decisión consciente, no algo que viaja de regalo.
 *
 * Sí devuelve el cliente que representa a la agencia (`es_agencia = true`),
 * marcado como tal: existe de verdad y aloja las reuniones y tareas internas.
 * Quien llame decide si lo muestra como un cliente más o lo trata aparte.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../_lib/auth';
import { filtrosClientes, mensajeDeError } from '../_lib/esquemas';

export const config = { runtime: 'edge' };

async function listar(ctx: Contexto): Promise<Response> {
  const parsed = filtrosClientes.safeParse(Object.fromEntries(ctx.params));
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const f = parsed.data;

  const { data, error: e } = await ctx.admin.rpc('api_clientes_listar', {
    p_agencia: ctx.agenciaId,
    p_status: f.status ?? null,
    p_limite: f.limite,
    p_offset: f.offset,
  });

  if (e) return errorInterno('GET /clients', e);

  const filas = (data ?? []) as unknown[];
  return exito({
    clientes: filas,
    paginacion: { limite: f.limite, offset: f.offset, hay_mas: filas.length === f.limite },
  });
}

export default proteger({
  GET: { scope: 'read:clients', ejecutar: listar },
});
