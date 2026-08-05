-- 032 — API pública v1: llaves de acceso y registro de llamadas.
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase.
-- ⚠️  Aditiva: crea dos tablas nuevas. No toca ninguna existente.
--
-- QUÉ HABILITA
-- Que programadores externos (hoy: Paralelo / Ikigai GM) lean tareas y agenda
-- de UNA agencia y creen filas nuevas, sin usar el login de una persona.
--
-- LA REGLA QUE SOSTIENE TODO
-- La llave NUNCA se guarda en texto plano. Se guarda su hash SHA-256. Si
-- alguien roba la base, no se lleva llaves usables — se lleva hashes. Por eso
-- la llave se muestra UNA sola vez, al crearla: después ni nosotras podemos
-- recuperarla, solo revocarla y emitir otra.

-- ── LLAVES ───────────────────────────────────────────────────────────────────
create table if not exists public.api_keys (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  -- SHA-256 en hex de la llave completa. Único: dos llaves no pueden colisionar.
  key_hash   text not null unique,
  -- Primeros caracteres visibles (pk_live_a1b2…) para identificarla en la UI
  -- sin poder reconstruirla. No sirve para autenticar.
  key_prefix text not null,
  -- A qué agencia pertenece. Es EL campo de aislamiento: toda query de la API
  -- se filtra por acá. Sin agencia, la llave no puede ver nada.
  agencia_id uuid not null references public.agencies(id) on delete cascade,
  -- Permisos. Solo estos 4 existen hoy; el resto se agrega cuando haya
  -- endpoints que los usen. Una llave con un scope sin endpoint no puede nada.
  scopes     text[] not null default '{}',
  rate_limit integer not null default 100,
  activa     boolean not null default true,
  ultimo_uso timestamptz,
  expira_en  timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Un rate limit de 0 o negativo dejaría la llave inservible sin decir por qué.
  constraint api_keys_rate_limit_valido check (rate_limit between 1 and 1000),
  -- Whitelist de scopes: si mañana alguien inserta 'admin:todo' a mano, la base
  -- lo rechaza. Los permisos son un conjunto cerrado, no texto libre.
  constraint api_keys_scopes_validos check (
    scopes <@ array[
      'read:tasks', 'write:tasks',
      'read:meetings', 'write:meetings'
    ]::text[]
  )
);

create index if not exists api_keys_hash_idx     on public.api_keys(key_hash) where activa;
create index if not exists api_keys_agencia_idx  on public.api_keys(agencia_id);

comment on table  public.api_keys            is 'Llaves de la API pública v1. Una por aplicación externa.';
comment on column public.api_keys.key_hash   is 'SHA-256 hex de la llave. La llave en claro NO se guarda en ningún lado.';
comment on column public.api_keys.key_prefix is 'Prefijo visible para identificarla en la UI. No autentica.';
comment on column public.api_keys.agencia_id is 'Aislamiento: la llave solo ve datos de esta agencia.';

-- ── REGISTRO DE LLAMADAS (audit log) ─────────────────────────────────────────
-- Sirve para dos cosas distintas: ver qué pasó (auditoría) y contar llamadas
-- del último minuto (rate limiting). Por eso el índice compuesto de abajo.
create table if not exists public.api_requests (
  id               uuid primary key default gen_random_uuid(),
  -- on delete set null, no cascade: si se borra una llave, sus llamadas
  -- quedan en el log. Borrar la evidencia junto con la llave sería justo lo
  -- contrario de lo que hace un audit log.
  api_key_id       uuid references public.api_keys(id) on delete set null,
  agencia_id       uuid,
  metodo           text,
  endpoint         text,
  status_code      integer,
  ip_address       text,
  user_agent       text,
  -- Cuerpo del request YA saneado por la API (sin llaves ni tokens).
  request_body     jsonb,
  response_time_ms integer,
  created_at       timestamptz not null default now()
);

-- El índice del rate limit: "cuántas llamadas hizo ESTA llave desde ESTE
-- momento". Sin él, contar sería un scan completo en cada llamada.
create index if not exists api_requests_ratelimit_idx
  on public.api_requests(api_key_id, created_at desc);
create index if not exists api_requests_agencia_idx
  on public.api_requests(agencia_id, created_at desc);

comment on table public.api_requests is
  'Log de llamadas a la API pública. Alimenta la auditoría y el conteo del rate limit.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- La API NO lee estas tablas con el token de un usuario: usa la service key,
-- que se salta RLS. Estas policies son para el FRONTEND — que la dueña de una
-- agencia vea y administre sus llaves desde Configuración, y no las de otra.
alter table public.api_keys     enable row level security;
alter table public.api_requests enable row level security;

-- Helper: ¿el usuario actual es dueño de esta agencia?
create or replace function public.es_duena_de_agencia(p_agencia uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agencies a
    where a.id = p_agencia and a.owner_id = auth.uid()
  );
$$;

comment on function public.es_duena_de_agencia is
  'true si el usuario actual es owner de esa agencia. Base de las policies de API.';

-- Lectura: la dueña ve sus llaves. Nunca se expone key_hash al frontend
-- (la API de administración selecciona columnas explícitas), pero aunque se
-- filtrara, un hash no es una llave usable.
drop policy if exists "api_keys_owner_read" on public.api_keys;
create policy "api_keys_owner_read" on public.api_keys
  for select using (public.es_duena_de_agencia(agencia_id));

-- Revocar / renombrar: solo la dueña, y solo dentro de su agencia.
-- El `with check` impide mover una llave a otra agencia con un UPDATE.
drop policy if exists "api_keys_owner_update" on public.api_keys;
create policy "api_keys_owner_update" on public.api_keys
  for update
  using (public.es_duena_de_agencia(agencia_id))
  with check (public.es_duena_de_agencia(agencia_id));

-- Ojo: NO hay policy de INSERT a propósito. Crear una llave pasa por el
-- endpoint de backend, que es quien genera el secreto y guarda solo el hash.
-- Si el frontend pudiera insertar, podría inventarse el hash que quisiera.

-- Tampoco hay DELETE: las llaves se revocan (activa = false), no se borran.
-- Borrarlas dejaría llamadas huérfanas en el audit log.

drop policy if exists "api_requests_owner_read" on public.api_requests;
create policy "api_requests_owner_read" on public.api_requests
  for select using (
    agencia_id is not null and public.es_duena_de_agencia(agencia_id)
  );
