/**
 * /api/v1/meetings
 *
 *   GET  → lista reuniones / agenda de la agencia (read:meetings)
 *   POST → crea una reunión                        (write:meetings)
 *
 * LO QUE ESTE ENDPOINT NO DEVUELVE, Y ES A PROPÓSITO
 * La función `api_reuniones_listar` deja fuera `transcription`, `notes` y
 * `extracted_tasks`. Una transcripción es lo más sensible que guarda la app
 * —la conversación literal del equipo y del cliente— y ninguna integración de
 * agenda necesita leerla. Si algún día hiciera falta, sería un permiso aparte
 * y una decisión consciente, no algo que viaja de regalo.
 */

import { proteger, exito, error, errorInterno, CODIGOS, type Contexto } from '../_lib/auth';
import { crearReunion, filtrosReuniones, mensajeDeError } from '../_lib/esquemas';

export const config = { runtime: 'edge' };

async function listar(ctx: Contexto): Promise<Response> {
  const parsed = filtrosReuniones.safeParse(Object.fromEntries(ctx.params));
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const f = parsed.data;

  const { data, error: e } = await ctx.admin.rpc('api_reuniones_listar', {
    p_agencia: ctx.agenciaId,
    p_client_id: f.client_id ?? null,
    p_desde: f.desde ?? null,
    p_hasta: f.hasta ?? null,
    p_limite: f.limite,
    p_offset: f.offset,
  });

  if (e) return errorInterno('GET /meetings', e);

  const filas = (data ?? []) as unknown[];
  return exito({
    reuniones: filas,
    paginacion: { limite: f.limite, offset: f.offset, hay_mas: filas.length === f.limite },
  });
}

async function crear(ctx: Contexto): Promise<Response> {
  const parsed = crearReunion.safeParse(ctx.body ?? {});
  if (!parsed.success) {
    return error(CODIGOS.DATOS_INVALIDOS, mensajeDeError(parsed.error), 400);
  }
  const m = parsed.data;

  const { data: id, error: e } = await ctx.admin.rpc('api_reunion_crear', {
    p_agencia: ctx.agenciaId,
    p_client_id: m.client_id,
    p_titulo: m.titulo,
    p_tipo: m.tipo,
    p_programada_en: m.programada_en,
    p_duracion_min: m.duracion_min,
    p_agenda: m.agenda ?? null,
    p_enlace: m.enlace_videollamada ?? null,
  });

  if (e) {
    if (e.message?.includes('cliente_no_encontrado')) {
      return error(
        CODIGOS.NO_ENCONTRADO,
        'No existe un cliente con ese client_id. Verifica el id con GET /api/v1/meetings.',
        400,
      );
    }
    return errorInterno('POST /meetings', e);
  }

  const { data: filas } = await ctx.admin.rpc('api_reunion_obtener', {
    p_agencia: ctx.agenciaId,
    p_id: id,
  });

  const reunion = Array.isArray(filas) ? filas[0] : null;
  return exito({ reunion: reunion ?? { id } }, 201);
}

export default proteger({
  GET: { scope: 'read:meetings', ejecutar: listar },
  POST: { scope: 'write:meetings', ejecutar: crear },
});
