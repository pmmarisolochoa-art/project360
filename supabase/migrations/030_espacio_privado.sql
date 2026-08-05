-- 030 — Espacio privado por miembro: tareas y reuniones que SOLO ve su dueño.
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase.
-- ⚠️  CAMBIO DE SEGURIDAD (RLS). Léela antes de correrla.
--
-- REGLA
-- Una fila privada (`es_privada = true`) es visible ÚNICAMENTE para
-- `propietario_id`. No aparece para nadie más — tampoco para la dueña de la
-- agencia. Eso es deliberado: un espacio privado que el jefe puede leer no es
-- un espacio privado.
--
-- DÓNDE SE APLICA
-- El filtro va en la BASE (estas policies), no solo en el frontend. Filtrar
-- únicamente en React dejaría los datos accesibles para cualquiera que llame a
-- la API con su propio token.
--
-- CÓMO SE COMPORTA LO YA EXISTENTE
-- `es_privada` entra con default false, así que TODAS las filas actuales siguen
-- siendo del equipo y nadie pierde acceso a nada.

-- ── Columnas ─────────────────────────────────────────────────────────────────
alter table public.tasks
  add column if not exists es_privada     boolean not null default false,
  add column if not exists propietario_id uuid references auth.users(id) on delete set null;

alter table public.meetings
  add column if not exists es_privada     boolean not null default false,
  add column if not exists propietario_id uuid references auth.users(id) on delete set null;

comment on column public.tasks.es_privada     is 'true = solo la ve propietario_id (ni el owner de agencia).';
comment on column public.tasks.propietario_id is 'Dueño de la fila privada. Null si no es privada.';

-- Integridad: privada obliga a tener dueño; si no, sería invisible para todos.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_privada_con_dueno') then
    alter table public.tasks add constraint tasks_privada_con_dueno
      check (es_privada = false or propietario_id is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'meetings_privada_con_dueno') then
    alter table public.meetings add constraint meetings_privada_con_dueno
      check (es_privada = false or propietario_id is not null) not valid;
  end if;
end $$;

-- Índice parcial: las consultas del modo privado siempre filtran por dueño.
create index if not exists tasks_privadas_idx
  on public.tasks(propietario_id) where es_privada = true;
create index if not exists meetings_privadas_idx
  on public.meetings(propietario_id) where es_privada = true;

-- ── Helper de visibilidad ────────────────────────────────────────────────────
-- Se usa en TODAS las policies para que la regla viva en un solo lugar.
create or replace function public.puede_ver_fila(p_es_privada boolean, p_propietario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_es_privada, false) = false
      or p_propietario = auth.uid();
$$;

comment on function public.puede_ver_fila is
  'true si la fila no es privada, o si el usuario actual es su dueño.';

-- ── Policies: MIEMBRO ────────────────────────────────────────────────────────
drop policy if exists "tasks_client_read" on public.tasks;
create policy "tasks_client_read" on public.tasks
  for select
  using (
    public.is_client_member(tasks.client_id)
    and public.puede_ver_fila(tasks.es_privada, tasks.propietario_id)
  );

drop policy if exists "tasks_client_update" on public.tasks;
create policy "tasks_client_update" on public.tasks
  for update
  using (
    public.is_client_editor(tasks.client_id)
    and public.puede_ver_fila(tasks.es_privada, tasks.propietario_id)
  )
  with check (
    public.is_client_editor(tasks.client_id)
    and public.puede_ver_fila(tasks.es_privada, tasks.propietario_id)
  );

drop policy if exists "meetings_client_read" on public.meetings;
create policy "meetings_client_read" on public.meetings
  for select
  using (
    public.is_client_member(meetings.client_id)
    and public.puede_ver_fila(meetings.es_privada, meetings.propietario_id)
  );

-- ── Policies: DUEÑA DE AGENCIA ───────────────────────────────────────────────
-- Ve todo lo de sus clientes MENOS lo privado de otras personas.
drop policy if exists "tasks_via_client_owner" on public.tasks;
create policy "tasks_via_client_owner" on public.tasks
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = tasks.client_id and a.owner_id = auth.uid()
    )
    and public.puede_ver_fila(tasks.es_privada, tasks.propietario_id)
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = tasks.client_id and a.owner_id = auth.uid()
    )
    and public.puede_ver_fila(tasks.es_privada, tasks.propietario_id)
  );

drop policy if exists "meetings_via_client" on public.meetings;
create policy "meetings_via_client" on public.meetings
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = meetings.client_id and a.owner_id = auth.uid()
    )
    and public.puede_ver_fila(meetings.es_privada, meetings.propietario_id)
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = meetings.client_id and a.owner_id = auth.uid()
    )
    and public.puede_ver_fila(meetings.es_privada, meetings.propietario_id)
  );

-- ── Verificación (correr aparte) ─────────────────────────────────────────────
--   select tablename, policyname, cmd from pg_policies
--   where schemaname='public' and tablename in ('tasks','meetings')
--   order by tablename, policyname;
--
-- Prueba real: crea una tarea con es_privada=true y propietario_id = OTRO
-- usuario; logueada como tú NO debe aparecer en /tareas ni en el Kanban.
