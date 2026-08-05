-- 033 — API pública v1: la capa de datos.
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase, DESPUÉS de la 032.
-- ⚠️  Aditiva: crea funciones nuevas y amplía UN check. No borra ni cambia datos.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ ESTE ARCHIVO EXISTE
-- ─────────────────────────────────────────────────────────────────────────────
-- La API se conecta a Supabase con la SERVICE KEY, que se salta las policies de
-- RLS por diseño. Eso significa que las policies de la migración 030 —las que
-- protegen lo privado y separan por agencia— NO la frenan.
--
-- Si la API consultara `tasks` directamente, el único filtro sería el `.eq()`
-- escrito en JavaScript. Un `.eq()` olvidado en un endpoint = datos de otra
-- agencia servidos por internet.
--
-- Estas funciones son la respuesta. La API NO consulta las tablas: llama a
-- estas funciones pasándoles el `agencia_id` de la API key, y el filtro ocurre
-- ACÁ DENTRO, donde ningún endpoint puede olvidarlo. Para servir una fila
-- ajena habría que modificar este archivo a propósito.
--
-- TRES REGLAS QUE CUMPLEN TODAS
--   1. Filtran por agencia vía `clients.agency_id`. Siempre.
--   2. Excluyen `es_privada = true`. Siempre, sin importar el permiso.
--   3. Devuelven columnas explícitas, nunca `select *`. Una columna nueva y
--      sensible en `tasks` no se filtra sola por la API.

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO PREVIO: permitir origen = 'api'
-- ─────────────────────────────────────────────────────────────────────────────
-- La 029 dejó el CHECK de `tasks.origen` en (manual, reunion, embudo, ia). Las
-- filas creadas por la API se marcan con 'api' para poder distinguirlas —y
-- borrarlas de un golpe si una integración hace un desastre—, así que hay que
-- ampliar el CHECK ANTES de que exista el endpoint. Si no, el INSERT se
-- rechaza; es exactamente la trampa que ya nos costó caro dos veces.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'tasks_origen_check') then
    alter table public.tasks drop constraint tasks_origen_check;
  end if;
  alter table public.tasks add constraint tasks_origen_check
    check (origen in ('manual', 'reunion', 'embudo', 'ia', 'api')) not valid;
end $$;

comment on column public.tasks.origen is
  'De dónde nació: manual | reunion | embudo | ia | api.';

-- Igual para reuniones: sin esta columna no habría forma de saber cuáles creó
-- una integración externa.
alter table public.meetings
  add column if not exists origen text not null default 'manual';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meetings_origen_check') then
    alter table public.meetings add constraint meetings_origen_check
      check (origen in ('manual', 'api')) not valid;
  end if;
end $$;

comment on column public.meetings.origen is 'manual | api. Permite aislar lo que creó una integración.';

-- ─────────────────────────────────────────────────────────────────────────────
-- LECTURA
-- ─────────────────────────────────────────────────────────────────────────────

-- Tareas de una agencia. Todos los filtros son opcionales (null = no filtra).
create or replace function public.api_tareas_listar(
  p_agencia    uuid,
  p_client_id  uuid    default null,
  p_status     text    default null,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_limite     integer default 50,
  p_offset     integer default 0
)
returns table (
  id uuid, client_id uuid, cliente text, titulo text, descripcion text,
  estado text, prioridad text, asignado_a text, fecha_limite timestamptz,
  completada_en timestamptz, etiqueta text, external_id text, origen text,
  meeting_id uuid, creada_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.client_id, c.name, t.title, t.description,
    t.status, t.priority, t.assigned_to, t.due_date,
    t.completed_at, t.module_tag, t.external_id, t.origen,
    t.meeting_id, t.created_at
  from public.tasks t
  join public.clients c on c.id = t.client_id
  where c.agency_id = p_agencia            -- ← el aislamiento, no negociable
    and coalesce(t.es_privada, false) = false  -- ← lo privado nunca sale
    and (p_client_id is null or t.client_id = p_client_id)
    and (p_status    is null or t.status    = p_status)
    and (p_desde     is null or t.due_date >= p_desde)
    and (p_hasta     is null or t.due_date <= p_hasta)
  order by t.due_date asc, t.id asc          -- `t.id` desempata: sin él, el
  limit  greatest(1, least(coalesce(p_limite, 50), 200))  -- paginado puede
  offset greatest(0, coalesce(p_offset, 0));              -- repetir filas
$$;

comment on function public.api_tareas_listar is
  'API v1: tareas de UNA agencia, sin las privadas. El filtro vive acá, no en el endpoint.';

-- Una tarea por id. Devuelve 0 filas si no es de esa agencia — el endpoint lo
-- traduce a 404, nunca a 403: un 403 confirmaría que el id existe.
create or replace function public.api_tarea_obtener(p_agencia uuid, p_id uuid)
returns table (
  id uuid, client_id uuid, cliente text, titulo text, descripcion text,
  estado text, prioridad text, asignado_a text, fecha_limite timestamptz,
  completada_en timestamptz, etiqueta text, external_id text, origen text,
  meeting_id uuid, creada_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.client_id, c.name, t.title, t.description,
    t.status, t.priority, t.assigned_to, t.due_date,
    t.completed_at, t.module_tag, t.external_id, t.origen,
    t.meeting_id, t.created_at
  from public.tasks t
  join public.clients c on c.id = t.client_id
  where t.id = p_id
    and c.agency_id = p_agencia
    and coalesce(t.es_privada, false) = false;
$$;

-- Reuniones. Ojo con lo que NO devuelve: `transcription`, `notes` y
-- `extracted_tasks` se quedan fuera a propósito. Una transcripción es lo más
-- sensible que guarda la app —conversaciones literales del equipo y del
-- cliente— y ninguna integración de agenda necesita leerla.
create or replace function public.api_reuniones_listar(
  p_agencia   uuid,
  p_client_id uuid    default null,
  p_desde     timestamptz default null,
  p_hasta     timestamptz default null,
  p_limite    integer default 50,
  p_offset    integer default 0
)
returns table (
  id uuid, client_id uuid, cliente text, titulo text, tipo text,
  programada_en timestamptz, duracion_min integer, participantes jsonb,
  agenda text, enlace_videollamada text, completada boolean,
  origen text, creada_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.client_id, c.name, m.title, m.type,
    m.scheduled_at, m.duration_min, m.participants,
    m.agenda, m.video_call_link, m.completed,
    m.origen, m.created_at
  from public.meetings m
  join public.clients c on c.id = m.client_id
  where c.agency_id = p_agencia
    and coalesce(m.es_privada, false) = false
    and (p_client_id is null or m.client_id = p_client_id)
    and (p_desde     is null or m.scheduled_at >= p_desde)
    and (p_hasta     is null or m.scheduled_at <= p_hasta)
  order by m.scheduled_at asc, m.id asc
  limit  greatest(1, least(coalesce(p_limite, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.api_reuniones_listar is
  'API v1: reuniones de UNA agencia. NO expone transcripción, notas ni tareas extraídas.';

create or replace function public.api_reunion_obtener(p_agencia uuid, p_id uuid)
returns table (
  id uuid, client_id uuid, cliente text, titulo text, tipo text,
  programada_en timestamptz, duracion_min integer, participantes jsonb,
  agenda text, enlace_videollamada text, completada boolean,
  origen text, creada_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.client_id, c.name, m.title, m.type,
    m.scheduled_at, m.duration_min, m.participants,
    m.agenda, m.video_call_link, m.completed,
    m.origen, m.created_at
  from public.meetings m
  join public.clients c on c.id = m.client_id
  where m.id = p_id
    and c.agency_id = p_agencia
    and coalesce(m.es_privada, false) = false;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ESCRITURA
-- ─────────────────────────────────────────────────────────────────────────────
-- Las tres funciones que siguen son las ÚNICAS por las que la API escribe.
-- No hay ninguna de borrado: la API no borra nada, nunca.

-- Crear tarea. Si el cliente no es de la agencia, levanta excepción — el
-- endpoint la traduce a un 400 que dice "cliente no encontrado". Es el camino
-- por el que "Floppy" (que existe en Paralelo pero no acá) queda fuera con un
-- mensaje claro en vez de entrar como fila huérfana.
create or replace function public.api_tarea_crear(
  p_agencia     uuid,
  p_client_id   uuid,
  p_titulo      text,
  p_descripcion text  default null,
  p_prioridad   text  default 'P2',
  p_asignado_a  text  default 'Sin asignar',
  p_fecha_limite timestamptz default null,
  p_etiqueta    text  default null,
  p_external_id text  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- El cliente debe pertenecer a la agencia de la key. Sin esta comprobación,
  -- mandando el uuid de un cliente ajeno se le escribirían tareas.
  if not exists (
    select 1 from public.clients
    where id = p_client_id and agency_id = p_agencia
  ) then
    raise exception 'cliente_no_encontrado' using errcode = 'P0002';
  end if;

  -- Idempotencia: si ya existe una tarea de este cliente con ese external_id,
  -- se devuelve la que hay en vez de duplicar. Un reintento de la integración
  -- (timeout, reenvío) no debe llenar el tablero de copias.
  if p_external_id is not null then
    select id into v_id
    from public.tasks
    where client_id = p_client_id and external_id = p_external_id
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.tasks (
    client_id, title, description, status, priority, assigned_to,
    due_date, module_tag, external_id, origen, es_privada
  ) values (
    p_client_id,
    p_titulo,
    p_descripcion,
    'pending',                                   -- toda tarea nace pendiente
    coalesce(p_prioridad, 'P2'),
    coalesce(nullif(trim(p_asignado_a), ''), 'Sin asignar'),
    coalesce(p_fecha_limite, now() + interval '7 days'),
    p_etiqueta,
    p_external_id,
    'api',                                       -- rastro de quién la creó
    false                                        -- la API jamás crea privadas
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.api_tarea_crear is
  'API v1: crea tarea. Idempotente por external_id. Marca origen=api. Nunca privada.';

-- Cambiar SOLO el estado. No es "editar tarea": no puede tocar el título, la
-- fecha ni el responsable, así que una integración con un bug no puede
-- reescribir el trabajo del equipo.
create or replace function public.api_tarea_estado(
  p_agencia uuid,
  p_id      uuid,
  p_estado  text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual text;
begin
  select t.status into v_actual
  from public.tasks t
  join public.clients c on c.id = t.client_id
  where t.id = p_id
    and c.agency_id = p_agencia
    and coalesce(t.es_privada, false) = false
  for update of t;

  -- No existe, es de otra agencia o es privada: los tres casos se ven igual
  -- desde afuera. El endpoint responde 404.
  if v_actual is null then
    raise exception 'tarea_no_encontrada' using errcode = 'P0002';
  end if;

  -- Regla acordada con Paralelo: la revisión es NUESTRO proceso, no el suyo.
  -- Una tarea en revisión no se mueve desde fuera.
  if v_actual = 'in_review' then
    raise exception 'tarea_en_revision' using errcode = 'P0003';
  end if;

  update public.tasks
  set status = p_estado,
      -- Completar sella la fecha; reabrir la borra. Si no se limpiara, una
      -- tarea reabierta seguiría contando como completada en los reportes.
      completed_at = case when p_estado = 'completed' then now() else null end
  where id = p_id;

  return v_actual;   -- estado anterior, útil para el log de la integración
end;
$$;

comment on function public.api_tarea_estado is
  'API v1: cambia SOLO el estado. No toca in_review. Devuelve el estado anterior.';

create or replace function public.api_reunion_crear(
  p_agencia      uuid,
  p_client_id    uuid,
  p_titulo       text,
  p_tipo         text,
  p_programada_en timestamptz,
  p_duracion_min integer default 30,
  p_agenda       text    default null,
  p_enlace       text    default null
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

  insert into public.meetings (
    client_id, title, type, scheduled_at, duration_min,
    agenda, video_call_link, origen, es_privada
  ) values (
    p_client_id, p_titulo, p_tipo, p_programada_en,
    coalesce(p_duracion_min, 30), p_agenda, p_enlace, 'api', false
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISOS
-- ─────────────────────────────────────────────────────────────────────────────
-- `security definer` hace que la función corra con los permisos de quien la
-- creó, así que hay que ser explícitas sobre quién puede invocarla.
-- `anon` y `authenticated` NO pueden: si pudieran, cualquiera con la anon key
-- (que va en el navegador, a la vista) podría pedir datos de cualquier agencia
-- pasando un uuid — justo el agujero que estas funciones vienen a tapar.
do $$
declare f text;
begin
  foreach f in array array[
    'api_tareas_listar', 'api_tarea_obtener',
    'api_reuniones_listar', 'api_reunion_obtener',
    'api_tarea_crear', 'api_tarea_estado', 'api_reunion_crear'
  ] loop
    execute format('revoke all on function public.%I from public, anon, authenticated', f);
    execute format('grant execute on function public.%I to service_role', f);
  end loop;
end $$;
