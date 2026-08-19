-- Migracion 040: rol de direccion. Version para copiar y pegar.
-- Identica a supabase/migrations/040_rol_direccion.sql pero sin comentarios,
-- porque los comentarios con marcos se rompen al copiar. Copia TODO y ejecuta.

alter table public.team_members
  add column if not exists es_direccion boolean not null default false;

comment on column public.team_members.es_direccion is
  'true = esta persona es dirección de la agencia (CEO/CTO): ve todo lo del equipo, no administra. Nunca ve lo privado.';

create index if not exists team_members_direccion_idx
  on public.team_members(user_id) where es_direccion = true;

create or replace function public.es_direccion()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.es_direccion = true
  );
$$;

grant execute on function public.es_direccion() to anon, authenticated;

create or replace function public.direccion_ve_cliente(target_client uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.clients c_mio    on c_mio.id = tm.client_id
    join public.clients c_objetivo on c_objetivo.agency_id = c_mio.agency_id
    where tm.user_id = auth.uid()
      and tm.es_direccion = true
      and c_objetivo.id = target_client
  );
$$;

grant execute on function public.direccion_ve_cliente(uuid) to anon, authenticated;

comment on function public.direccion_ve_cliente is
  'true si el usuario actual es dirección de la agencia a la que pertenece ese cliente.';

drop policy if exists "clients_direccion_read" on public.clients;
create policy "clients_direccion_read" on public.clients
  for select
  using (public.direccion_ve_cliente(clients.id));

drop policy if exists "tasks_direccion_read" on public.tasks;
create policy "tasks_direccion_read" on public.tasks
  for select
  using (
    public.direccion_ve_cliente(tasks.client_id)
    and public.puede_ver_fila(tasks.es_privada, tasks.propietario_id)
  );

drop policy if exists "meetings_direccion_read" on public.meetings;
create policy "meetings_direccion_read" on public.meetings
  for select
  using (
    public.direccion_ve_cliente(meetings.client_id)
    and public.puede_ver_fila(meetings.es_privada, meetings.propietario_id)
  );

drop policy if exists "team_members_direccion_read" on public.team_members;
create policy "team_members_direccion_read" on public.team_members
  for select
  using (public.direccion_ve_cliente(team_members.client_id));

drop policy if exists "ropre_direccion_read" on public.ropre_items;
create policy "ropre_direccion_read" on public.ropre_items
  for select
  using (public.direccion_ve_cliente(ropre_items.client_id));
