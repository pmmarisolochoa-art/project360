-- ============================================================================
-- 043 — API v1: lectura de Clientes, Equipo, ROPRE y Entregables
-- ============================================================================
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase.
-- ⚠️  NO borra ni modifica datos: solo CREA cuatro funciones de lectura.
-- ⚠️  No cambia ninguna policy. Un miembro del equipo sigue viendo lo mismo.
--
-- POR QUÉ
-- La API pública solo expone Tareas y Agenda. La aplicación de Ikigai va a ser
-- DONDE LA GENTE TRABAJA, y para eso necesita también saber qué clientes hay,
-- quién está en el equipo, qué dice el ROPRE y qué entregables existen.
--
-- Paso 2 de 4 del plan acordado: primero se abre LECTURA, la app lee y muestra
-- una o dos semanas sin escribir nada, y solo después se abre escritura de a
-- una cosa. Es la regla del 6-ago: la llave con escritura se emite cuando la
-- lectura ya funciona.
--
-- CÓMO (igual que la migración 033, no se inventa nada nuevo)
-- La API usa la service key, que SE SALTA RLS. Por eso los endpoints NO
-- consultan las tablas: llaman a estas funciones `security definer`, que
-- reciben el `agencia_id` de la key y filtran POR DENTRO. El aislamiento vive
-- en la base, no en JavaScript.
--
-- QUÉ NO SALE, A PROPÓSITO
--   · `clients`: NO se exponen `onboarding_data` ni `ai_brain_data`. Son la
--     inteligencia comercial del cliente (oferta, narrativa, buyer personas),
--     el dato más sensible de la base. Si algún día hace falta, va con su
--     propio permiso y su propia decisión, no de rebote.
--   · `team_members`: NO se exponen `email` ni `telefono`. Son datos de
--     contacto de personas. Mismo criterio.
--   · Entregables: NO salen los que cuelgan de una tarea PRIVADA.
--
-- Idempotente: se puede correr dos veces.
-- ============================================================================

-- ── 1. Clientes ─────────────────────────────────────────────────────────────
create or replace function public.api_clientes_listar(
  p_agencia uuid,
  p_status  text default null,
  p_limite  integer default 50,
  p_offset  integer default 0
)
returns table (
  id uuid, nombre text, sigla text, industria text, tipo_negocio text,
  estado text, tipo_proyecto text, color text, es_agencia boolean,
  presupuesto_ads_mensual numeric, creado_en timestamptz, actualizado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.sigla, c.industry, c.business_type,
    c.status, c.project_type, c.primary_color, coalesce(c.is_agency, false),
    c.monthly_ads_budget, c.created_at, c.updated_at
  from public.clients c
  where c.agency_id = p_agencia
    and (p_status is null or c.status = p_status)
  order by c.name asc, c.id asc
  limit  greatest(1, least(coalesce(p_limite, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.api_clientes_listar is
  'API v1: clientes de UNA agencia. NO expone onboarding_data ni ai_brain_data.';

-- ── 2. Equipo ───────────────────────────────────────────────────────────────
-- Una persona tiene una ficha POR CLIENTE, así que la misma persona aparece
-- varias veces. Se devuelve tal cual —es el modelo real— y quien llame agrupa
-- por nombre si lo necesita. Aplanarlo aquí escondería de qué cliente es cada
-- asignación, que es justo el dato.
create or replace function public.api_equipo_listar(
  p_agencia   uuid,
  p_client_id uuid default null,
  p_limite    integer default 100,
  p_offset    integer default 0
)
returns table (
  id uuid, client_id uuid, cliente text, nombre text, rol text,
  nivel_acceso text, departamentos jsonb, es_direccion boolean,
  ve_todas_tareas boolean, tiene_usuario boolean, creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tm.id, tm.client_id, c.name, tm.nombre, tm.rol,
    tm.access_level, coalesce(tm.departamentos, '[]'::jsonb), tm.es_direccion,
    tm.ve_todas_tareas,
    -- Se dice SI tiene cuenta, no CUÁL. El id de usuario no le sirve a nadie
    -- de fuera y es una pieza más que proteger.
    (tm.user_id is not null),
    tm.created_at
  from public.team_members tm
  join public.clients c on c.id = tm.client_id
  where c.agency_id = p_agencia
    and (p_client_id is null or tm.client_id = p_client_id)
  order by tm.nombre asc, c.name asc, tm.id asc
  limit  greatest(1, least(coalesce(p_limite, 100), 300))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.api_equipo_listar is
  'API v1: fichas de equipo de UNA agencia. NO expone email, telefono ni user_id.';

-- ── 3. ROPRE ────────────────────────────────────────────────────────────────
create or replace function public.api_ropre_listar(
  p_agencia   uuid,
  p_client_id uuid default null,
  p_tipo      text default null,
  p_limite    integer default 50,
  p_offset    integer default 0
)
returns table (
  id uuid, client_id uuid, cliente text, tipo text, titulo text,
  descripcion text, nivel_riesgo text, mitigacion text, estado text,
  inicia_en timestamptz, vence_en timestamptz, responsable text,
  valor_objetivo text, valor_actual text, tarea_id uuid, creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.client_id, c.name, r.type, r.title,
    r.description, r.risk_level, r.mitigation, r.status,
    r.start_date, r.due_date, r.responsible,
    r.target_value, r.current_value, r.linked_task_id, r.created_at
  from public.ropre_items r
  join public.clients c on c.id = r.client_id
  where c.agency_id = p_agencia
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_tipo is null or r.type = p_tipo)
  order by r.created_at desc, r.id asc
  limit  greatest(1, least(coalesce(p_limite, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.api_ropre_listar is
  'API v1: items ROPRE de UNA agencia (resultados, objetivos, premisas, riesgos, entregables).';

-- ── 4. Entregables ──────────────────────────────────────────────────────────
create or replace function public.api_entregables_listar(
  p_agencia   uuid,
  p_client_id uuid default null,
  p_estado    text default null,
  p_limite    integer default 50,
  p_offset    integer default 0
)
returns table (
  id uuid, client_id uuid, cliente text, task_id uuid, nombre text,
  url text, tipo text, fuente text, estado text, notas text,
  subido_por text, creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tl.id, tl.client_id, c.name, tl.task_id, tl.nombre,
    tl.url, tl.tipo, tl.fuente, tl.estado, tl.notas,
    tl.created_by_nombre, tl.created_at
  from public.task_links tl
  join public.clients c on c.id = tl.client_id
  where c.agency_id = p_agencia
    and (p_client_id is null or tl.client_id = p_client_id)
    and (p_estado is null or tl.estado = p_estado)
    -- Un entregable de una tarea PRIVADA no sale. La tarea no se puede leer por
    -- la API, así que su entregable tampoco: sería la misma fuga por otra
    -- puerta. `task_id` puede ser null (entregable suelto), y eso sí sale.
    and not exists (
      select 1 from public.tasks t
      where t.id = tl.task_id and coalesce(t.es_privada, false) = true
    )
  order by tl.created_at desc, tl.id asc
  limit  greatest(1, least(coalesce(p_limite, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.api_entregables_listar is
  'API v1: entregables/links de UNA agencia. Excluye los de tareas privadas.';

-- ── 5. Permisos ─────────────────────────────────────────────────────────────
-- Igual que la 033: solo la service key (o sea, la API) puede llamarlas. Nadie
-- las alcanza desde el navegador con su sesión.
do $$
declare f text;
begin
  foreach f in array array[
    'api_clientes_listar(uuid,text,integer,integer)',
    'api_equipo_listar(uuid,uuid,integer,integer)',
    'api_ropre_listar(uuid,uuid,text,integer,integer)',
    'api_entregables_listar(uuid,uuid,text,integer,integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ── 6. Los permisos nuevos, TAMBIÉN en la base ──────────────────────────────
-- `api_keys.scopes` tiene un CHECK con la lista de permisos válidos. Si se
-- agregan en TypeScript y no aquí, emitir una llave con el permiso nuevo falla
-- con un error críptico de Postgres.
--
-- Es la trampa que ya mordió TRES veces en este proyecto (el CHECK de
-- `tasks.origen` con 'api', el de `meetings.type`, y el de `tasks.status`). Por
-- eso se amplía ANTES de que exista el endpoint, no después.
alter table public.api_keys drop constraint if exists api_keys_scopes_validos;
alter table public.api_keys add constraint api_keys_scopes_validos
  check (scopes <@ array[
    'read:tasks', 'write:tasks',
    'read:meetings', 'write:meetings',
    -- Paso 2: solo LECTURA. La escritura de estos se abre después, de a una,
    -- y cuando la lectura ya funcione (regla del 6-ago).
    'read:clients', 'read:team', 'read:ropre', 'read:deliverables'
  ]::text[]);

-- ── 7. Comprobación (correr aparte) ─────────────────────────────────────────
--   select proname from pg_proc
--   where proname in ('api_clientes_listar','api_equipo_listar',
--                     'api_ropre_listar','api_entregables_listar');
--   ↑ deben salir las 4.
--
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'api_keys_scopes_validos';
--   ↑ debe listar los 8 permisos.
