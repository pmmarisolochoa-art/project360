-- 050 — Leads: score/banda/ruta de calificación externa.
--
-- Founder, 30-sep-2026, sobre el Sheet real que alimenta el formulario de
-- Alejo (RPM Method): cada lead trae un score, una banda (rojo/amarillo/
-- verde/parcial) y una ruta (sprint/academy/method) ya calculados por SU
-- formulario de calificación externo.
--
-- Los tres van como texto/numeric libre, sin CHECK — no se normalizan a un
-- enum nuestro: cada cliente con su propio formulario trae su propia escala,
-- y forzarla a categorías inventadas por nosotros sería el mismo error que
-- "NO SE INVENTAN DATOS" ya prohíbe en el import de clientes.
--
-- Aditiva e idempotente.

alter table public.leads add column if not exists score numeric;
alter table public.leads add column if not exists banda text;
alter table public.leads add column if not exists ruta text;

comment on column public.leads.score is
  'Score de calificación del formulario externo del cliente (ej. 0-100). Texto/número libre, sin escala fija.';
comment on column public.leads.banda is
  'Banda de calificación del formulario externo (ej. rojo/amarillo/verde). Texto libre, cada cliente define la suya.';
comment on column public.leads.ruta is
  'Ruta/producto sugerido por el formulario externo (ej. sprint/academy/method). Texto libre.';

-- `api_lead_crear` (migración 049) también recibe score/banda/ruta — un lead
-- que entra por ManyChat/WhatsApp con su propio formulario de calificación
-- debe poder traerlos igual que uno importado por CSV.
--
-- OJO: `create or replace` NO sustituye una función cuando cambia la lista de
-- parámetros — Postgres la trata como una función distinta (sobrecarga) y
-- deja viva la de 8 parámetros de la 049. Con las dos existiendo, una llamada
-- con solo los 8 parámetros originales queda AMBIGUA (las dos firmas calzan
-- por los defaults) y el endpoint empieza a fallar. Se borra la vieja primero.
drop function if exists public.api_lead_crear(uuid, uuid, text, text, text, text, text, text);

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
  p_ruta       text default null
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
    score, banda, ruta
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
    nullif(trim(coalesce(p_ruta, '')), '')
  )
  returning id into v_id;

  insert into public.lead_events (lead_id, etapa_nueva, nota, actor_nombre)
  values (v_id, 'nuevo', 'Registrado por API', 'API');

  return v_id;
end;
$$;

comment on function public.api_lead_crear is
  'API v1: crea lead. Idempotente por (client_id, external_id). Agrega el evento inicial del viaje del lead.';

-- La firma cambió (3 parámetros nuevos): revocar/otorgar sobre la firma VIEJA
-- fallaría porque ya no existe con esos 8 parámetros tras el `create or
-- replace` de arriba — hay que apuntar a la firma de 11.
revoke all on function public.api_lead_crear(uuid, uuid, text, text, text, text, text, text, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.api_lead_crear(uuid, uuid, text, text, text, text, text, text, numeric, text, text)
  to service_role;
