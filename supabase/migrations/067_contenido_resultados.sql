-- Medir por RESULTADOS, no por cantidad de publicaciones (founder, 24-nov-2026).
--
-- (1) Palabra clave de ManyChat por pieza — cierra el hueco real de
--     atribución: hasta ahora un lead se marcaba a mano con la pieza de
--     origen; con esto, el webhook de ManyChat (api/manychat/webhook.ts)
--     resuelve la pieza automáticamente por su palabra clave.
-- (2) `ad_spend` manual en content_piece_metrics — para piezas orgánicas que
--     además se impulsaron con pauta (boost), de ahí sale el ROAS por pieza.
--     Sigue el mismo patrón "manual hoy" del resto del panel de métricas.
-- (3) `api_lead_crear` gana 3 parámetros opcionales (instagram, whatsapp,
--     origin_content_piece_id) — la misma función que ya usa la API pública
--     v1 y los webhooks de Meta Lead Ads / Calendly. Son opcionales con
--     default null: ninguna llamada existente se rompe.

alter table public.content_pieces
  add column if not exists manychat_keyword text;

-- Funcional + parcial: dos piezas del mismo cliente no pueden compartir
-- palabra (ManyChat enruta por coincidencia exacta — una ambigüedad ahí
-- mandaría el lead a la pieza equivocada). Insensible a mayúsculas.
create unique index if not exists idx_content_pieces_manychat_keyword
  on public.content_pieces (client_id, lower(manychat_keyword))
  where manychat_keyword is not null;

alter table public.content_piece_metrics
  add column if not exists ad_spend numeric;

-- `create or replace` NO sustituye una función cuando cambia la lista de
-- parámetros (ver migración 050) — hay que borrar la firma vieja exacta
-- antes de crear la nueva, o quedan las dos vivas y una llamada con solo
-- los parámetros originales se vuelve ambigua.
drop function if exists public.api_lead_crear(uuid, uuid, text, text, text, text, text, text, numeric, text, text);

create or replace function public.api_lead_crear(
  p_agencia    uuid,
  p_client_id  uuid,
  p_nombre     text,
  p_telefono   text default null,
  p_email      text default null,
  p_fuente     text default 'otro',
  p_perfil_rol text default null,
  p_external_id text default null,
  p_score      numeric default null,
  p_banda      text default null,
  p_ruta       text default null,
  p_instagram  text default null,
  p_whatsapp   text default null,
  p_origin_content_piece_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.clients
    where id = p_client_id and agency_id = p_agencia
  ) then
    raise exception 'cliente_no_encontrado' using errcode = 'P0002';
  end if;

  if p_external_id is not null then
    select id into v_id
    from public.leads
    where client_id = p_client_id and external_id = p_external_id
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.leads (
    client_id, nombre, telefono, email, fuente, perfil_rol, etapa, external_id,
    score, banda, ruta, instagram, whatsapp_usuario, origin_content_piece_id
  ) values (
    p_client_id,
    p_nombre,
    nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    coalesce(nullif(p_fuente, ''), 'otro'),
    nullif(trim(coalesce(p_perfil_rol, '')), ''),
    'nuevo',
    p_external_id,
    p_score,
    nullif(trim(coalesce(p_banda, '')), ''),
    nullif(trim(coalesce(p_ruta, '')), ''),
    nullif(trim(coalesce(p_instagram, '')), ''),
    nullif(trim(coalesce(p_whatsapp, '')), ''),
    p_origin_content_piece_id
  )
  returning id into v_id;

  insert into public.lead_events (lead_id, etapa_nueva, nota, actor_nombre)
  values (v_id, 'nuevo', 'Registrado por API', 'API');

  return v_id;
end;
$$;

comment on function public.api_lead_crear is
  'API v1 + webhooks (Meta Lead Ads, Calendly, ManyChat): crea lead. Idempotente por (client_id, external_id). Agrega el evento inicial del viaje del lead.';

-- La firma cambió (3 parámetros nuevos): revocar/otorgar sobre la firma VIEJA
-- fallaría porque ya no existe con esos 11 parámetros tras el `create or
-- replace` de arriba — hay que apuntar a la firma de 14.
revoke all on function public.api_lead_crear(uuid, uuid, text, text, text, text, text, text, numeric, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.api_lead_crear(uuid, uuid, text, text, text, text, text, text, numeric, text, text, text, text, uuid)
  to service_role;
