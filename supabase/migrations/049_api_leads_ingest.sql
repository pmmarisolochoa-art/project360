-- 049 — API pública: ingesta de leads (ManyChat / WhatsApp / cualquier
-- integración server-to-server).
--
-- Mismo patrón que `api_tarea_crear` (migración 033): función `security
-- definer` que recibe el `agencia_id` de la API key y hace el aislamiento
-- DENTRO de la base — la service key de Supabase se salta RLS, así que el
-- filtro no puede vivir solo en el middleware de `api/v1`.
--
-- Idempotente por (client_id, external_id) — ManyChat puede reintentar un
-- webhook que ya se procesó (timeout, reenvío) y no debe duplicar el lead.
-- Ya existe el índice único `leads_external_id_idx` de la migración 047.
--
-- Aditiva e idempotente — segura de correr varias veces.

-- ── 1. Nuevo scope, TAMBIÉN en el CHECK de api_keys ────────────────────────
-- La trampa de siempre (documentada en 043): si se agrega en TypeScript y no
-- aquí, emitir una llave con este permiso falla con un error críptico.
alter table public.api_keys drop constraint if exists api_keys_scopes_validos;
alter table public.api_keys add constraint api_keys_scopes_validos
  check (scopes <@ array[
    'read:tasks', 'write:tasks',
    'read:meetings', 'write:meetings',
    'read:clients', 'read:team', 'read:ropre', 'read:deliverables',
    'write:leads'
  ]::text[]);

-- ── 2. api_lead_crear ────────────────────────────────────────────────────
create or replace function public.api_lead_crear(
  p_agencia    uuid,
  p_client_id  uuid,
  p_nombre     text,
  p_telefono   text default null,
  p_email      text default null,
  p_fuente     text default 'otro',
  p_perfil_rol text default null,
  p_external_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- El cliente debe pertenecer a la agencia de la key — igual que en
  -- api_tarea_crear: sin esto, mandando el uuid de un cliente ajeno se le
  -- escribirían leads.
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
    client_id, nombre, telefono, email, fuente, perfil_rol, etapa, external_id
  ) values (
    p_client_id,
    p_nombre,
    nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    coalesce(nullif(p_fuente, ''), 'otro'),
    nullif(trim(coalesce(p_perfil_rol, '')), ''),
    'nuevo',
    p_external_id
  )
  returning id into v_id;

  -- Mismo gesto que hace la app al crear un lead a mano: el registro queda
  -- en el viaje del lead, no solo en el estado actual.
  insert into public.lead_events (lead_id, etapa_nueva, nota, actor_nombre)
  values (v_id, 'nuevo', 'Registrado por API', 'API');

  return v_id;
end;
$$;

comment on function public.api_lead_crear is
  'API v1: crea lead. Idempotente por (client_id, external_id). Agrega el evento inicial del viaje del lead.';

revoke all on function public.api_lead_crear(uuid, uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.api_lead_crear(uuid, uuid, text, text, text, text, text, text)
  to service_role;

-- ── 3. Comprobación (correr aparte) ─────────────────────────────────────────
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'api_keys_scopes_validos';
--   ↑ debe incluir 'write:leads'.
--
--   select proname from pg_proc where proname = 'api_lead_crear';
--   ↑ debe salir.
