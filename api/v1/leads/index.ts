/**
 * /api/v1/leads
 *
 *   POST → crea un lead (write:leads)
 *
 * Pensado para integraciones server-to-server que capturan leads en vivo
 * (ManyChat, un backend de WhatsApp, cualquier formulario que pueda guardar
 * un secreto) — no para el navegador de un visitante, que expondría la key.
 * El formulario de la landing que hoy vuelca a un Excel se cubre aparte, con
 * la importación CSV del cerebro del cliente (mismo patrón que importar
 * clientes).
 *
 * No hay GET a propósito todavía: el listado de leads no tiene un consumidor
 * externo pedido — agregarlo sin uso sería la misma trampa de `fasesEmbudo`
 * (construir "por si acaso").
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../_lib/auth';
import { crearLead, mensajeDeError } from '../_lib/esquemas';

export const config = { runtime: 'edge' };

async function crear(ctx: Contexto): Promise<Response> {
  const parsed = crearLead.safeParse(ctx.body ?? {});
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const l = parsed.data;

  const { data: id, error: e } = await ctx.admin.rpc('api_lead_crear', {
    p_agencia: ctx.agenciaId,
    p_client_id: l.client_id,
    p_nombre: l.nombre,
    p_telefono: l.telefono ?? null,
    p_email: l.email ?? null,
    p_fuente: l.fuente,
    p_perfil_rol: l.perfil_rol ?? null,
    p_external_id: l.external_id ?? null,
    p_score: l.score ?? null,
    p_banda: l.banda ?? null,
    p_ruta: l.ruta ?? null,
  });

  if (e) {
    // Mismo trato que /tasks: "no existe" y "no es tuyo" se ven igual desde
    // afuera. 400, no 403 — no le regalamos a quien llama la diferencia.
    if (e.message?.includes('cliente_no_encontrado')) {
      return error(
        CODIGOS.NO_ENCONTRADO,
        'No existe un cliente con ese client_id, o no pertenece a esta cuenta.',
        400,
      );
    }
    return errorInterno('POST /leads', e);
  }

  return exito({ lead: { id } }, 201);
}

export default proteger({
  POST: { scope: 'write:leads', ejecutar: crear },
});
