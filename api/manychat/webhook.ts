/**
 * Webhook de ManyChat — atribución automática de leads por "palabra clave"
 * de cada pieza de contenido (migración 067, 24-nov-2026).
 *
 * Hasta ahora un lead que entraba por DM se marcaba A MANO con la pieza de
 * origen en Ventas. Con esto, cada pieza puede tener su propia palabra clave
 * (`content_pieces.manychat_keyword`) y el flujo de ManyChat que escucha esa
 * palabra llama a esta URL — la atribución queda automática y exacta.
 *
 * CONTRATO (lo definimos nosotros — se configura como paso "External Request"
 * dentro del flujo de ManyChat que dispara con la palabra clave):
 *
 *   POST /api/manychat/webhook?clientId=<uuid>&secret=<MANYCHAT_WEBHOOK_SECRET>
 *   Body JSON: {
 *     keyword: string,        // la palabra que activó el flujo
 *     subscriberId: string,   // id de ManyChat del contacto — es el external_id, idempotente
 *     nombre?: string,
 *     instagram?: string,     // handle de Instagram, sin "@"
 *     telefono?: string,
 *     whatsapp?: string,
 *   }
 *
 * - `keyword` se compara sin importar mayúsculas/espacios contra las piezas
 *   del cliente — si ninguna pieza tiene esa palabra, se responde 404
 *   (visible, no se traga el error: evita que alguien crea que ya quedó
 *   conectado cuando en realidad nadie configuró la palabra en la pieza).
 * - El lead entra por `api_lead_crear` (misma función de la API pública v1
 *   y de los webhooks de Meta Lead Ads / Calendly), con
 *   `origin_content_piece_id` apuntando a la pieza encontrada y `fuente`
 *   derivada de su formato (reel/story/carrusel; el resto cae en 'dm').
 *
 * Requiere en Vercel: MANYCHAT_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY,
 *   VITE_SUPABASE_URL.
 */

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

interface Cuerpo {
  keyword?: string;
  subscriberId?: string;
  nombre?: string;
  instagram?: string;
  telefono?: string;
  whatsapp?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return texto('Solo POST.', 405);

  const url = new URL(req.url);
  const secretEsperado = process.env.MANYCHAT_WEBHOOK_SECRET;
  if (!secretEsperado) return texto('Webhook sin configurar (falta MANYCHAT_WEBHOOK_SECRET).', 503);
  if (!igualSeguro(url.searchParams.get('secret') ?? '', secretEsperado)) {
    return texto('Secreto inválido.', 401);
  }

  const clientId = url.searchParams.get('clientId');
  if (!clientId) return texto('Falta clientId en la URL.', 400);

  let cuerpo: Cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return texto('JSON inválido.', 400);
  }

  const keyword = (cuerpo.keyword ?? '').trim();
  const subscriberId = (cuerpo.subscriberId ?? '').trim();
  if (!keyword || !subscriberId) return texto('Faltan keyword o subscriberId.', 400);

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return texto('Falta configuración de Supabase.', 500);
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: cliente } = await admin.from('clients').select('agency_id').eq('id', clientId).maybeSingle();
  if (!cliente) return texto('Cliente no encontrado.', 404);

  // Comparación en JS (no `.ilike` en la query): la palabra clave puede traer
  // caracteres que SQL LIKE interpreta como comodín ('%', '_') y rompería la
  // búsqueda en vez de solo no encontrar nada.
  const { data: piezas } = await admin
    .from('content_pieces')
    .select('id, format, manychat_keyword')
    .eq('client_id', clientId)
    .not('manychat_keyword', 'is', null);

  const pieza = (piezas ?? []).find(
    (p: { manychat_keyword: string | null }) => (p.manychat_keyword ?? '').trim().toLowerCase() === keyword.toLowerCase(),
  );

  if (!pieza) {
    console.warn('[manychat] palabra clave sin pieza asociada', { clientId, keyword });
    return texto(`La palabra "${keyword}" no está asignada a ninguna pieza de este cliente.`, 404);
  }

  const fuente =
    pieza.format === 'reel' ? 'reel' :
    pieza.format === 'story' ? 'story' :
    pieza.format === 'carousel' ? 'carrusel' : 'dm';

  const { data: leadId, error } = await admin.rpc('api_lead_crear', {
    p_agencia: cliente.agency_id,
    p_client_id: clientId,
    p_nombre: cuerpo.nombre?.trim() || cuerpo.instagram?.trim() || 'Contacto ManyChat',
    p_telefono: cuerpo.telefono ?? null,
    p_fuente: fuente,
    p_external_id: subscriberId,
    p_instagram: cuerpo.instagram ?? null,
    p_whatsapp: cuerpo.whatsapp ?? null,
    p_origin_content_piece_id: pieza.id,
  });

  if (error) {
    console.error('[manychat] api_lead_crear falló', error);
    return texto('No se pudo crear el lead.', 500);
  }

  return json({ ok: true, leadId, contentPieceId: pieza.id });
}

function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function texto(msg: string, status: number): Response {
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain' } });
}

function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
