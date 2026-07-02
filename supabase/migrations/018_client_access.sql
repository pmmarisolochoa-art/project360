-- ══════════════════════════════════════════════════════════════════════════
--  Migración 018: Acceso por cliente (Capa 3 — multi-tenant del lado cliente)
--
--  Permite que un usuario externo (el cliente y su equipo) inicie sesión y vea
--  SOLO los datos de su propio cliente, con interacción básica (marcar tareas,
--  comentar). El owner de la agencia (Capa 1) sigue viendo todo lo suyo igual.
--
--  Qué hace:
--    1. team_members += user_id (login real) + access_level.
--    2. Helper is_client_member(client_id) — SECURITY DEFINER, sin recursión RLS.
--    3. Cierra 4 policies permisivas (USING true): team_members, programs,
--       agent_conversations, agent_prompts.
--    4. Agrega policies de CLIENTE (lectura + edición acotada) sobre las tablas
--       que el cliente ve: clients, tasks, meetings, ropre_items, content_pieces,
--       projections, programs, funnels, funnel_phases, team_members.
--
--  Modelo de permisos del cliente:
--    - LECTURA: clients, tasks, meetings, ropre, content, projections, programs,
--               funnels, funnel_phases, su propio equipo.
--    - ESCRITURA: solo UPDATE de tasks de su cliente (marcar hechas + comentar,
--                 que viven en columnas de tasks). No crea ni borra. No toca otras
--                 tablas. WITH CHECK evita mover una tarea a otro cliente.
--
--  Multiples policies permisivas se combinan con OR: las policies de owner ya
--  existentes se conservan intactas; estas se SUMAN para el caso cliente.
--
--  Idempotente: seguro de correr varias veces.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Extender team_members con identidad de login ──────────────────────
alter table public.team_members
  add column if not exists user_id uuid references public.users(id) on delete set null;

alter table public.team_members
  add column if not exists access_level text not null default 'editor';

-- Validar valores permitidos (idempotente: crea el check solo si no existe).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_members_access_level_chk'
  ) then
    alter table public.team_members
      add constraint team_members_access_level_chk
      check (access_level in ('viewer','editor'));
  end if;
end $$;

create index if not exists idx_team_members_user
  on public.team_members (user_id);

-- ── 2. Helper: ¿el usuario actual es miembro del equipo de este cliente? ──
-- SECURITY DEFINER para saltar RLS sobre team_members (evita recursión cuando
-- la usamos dentro de la propia policy de team_members).
create or replace function public.is_client_member(target_client uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.client_id = target_client
  );
$$;

grant execute on function public.is_client_member(uuid) to anon, authenticated;

-- Helper: ¿el usuario actual es miembro EDITOR de este cliente?
-- Solo los editores pueden modificar tareas; los viewers son de solo lectura.
create or replace function public.is_client_editor(target_client uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.client_id = target_client
      and tm.access_level = 'editor'
  );
$$;

grant execute on function public.is_client_editor(uuid) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════
--  3. Cerrar policies permisivas (USING true) — deuda técnica de beta.
-- ══════════════════════════════════════════════════════════════════════════

-- ── team_members: owner gestiona; cliente solo LEE su propio equipo ──────
drop policy if exists "team_members_all"          on public.team_members;
drop policy if exists "team_members_via_agency"   on public.team_members;
drop policy if exists "team_members_client_read"  on public.team_members;

create policy "team_members_via_agency" on public.team_members
  for all
  using (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = team_members.client_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = team_members.client_id and a.owner_id = auth.uid()));

create policy "team_members_client_read" on public.team_members
  for select
  using (public.is_client_member(team_members.client_id));

-- ── programs: owner gestiona; cliente solo LEE ───────────────────────────
drop policy if exists "programs_all"          on public.programs;
drop policy if exists "programs_via_client"   on public.programs;
drop policy if exists "programs_client_read"  on public.programs;

create policy "programs_via_client" on public.programs
  for all
  using (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = programs.client_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = programs.client_id and a.owner_id = auth.uid()));

create policy "programs_client_read" on public.programs
  for select
  using (public.is_client_member(programs.client_id));

-- ── agent_conversations: SOLO owner (el cliente no usa el agente PM) ──────
drop policy if exists "agent_conversations_all"        on public.agent_conversations;
drop policy if exists "agent_conversations_via_client" on public.agent_conversations;

create policy "agent_conversations_via_client" on public.agent_conversations
  for all
  using (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = agent_conversations.client_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = agent_conversations.client_id and a.owner_id = auth.uid()));

-- ── agent_prompts: lectura para cualquier autenticado (prompts del producto),
--    pero escritura SOLO para owners de agencia (no clientes). ─────────────
drop policy if exists "agent_prompts_all"        on public.agent_prompts;
drop policy if exists "agent_prompts_read"       on public.agent_prompts;
drop policy if exists "agent_prompts_write_owner" on public.agent_prompts;

create policy "agent_prompts_read" on public.agent_prompts
  for select
  using (auth.uid() is not null);

create policy "agent_prompts_write_owner" on public.agent_prompts
  for all
  using (exists (select 1 from public.agencies a where a.owner_id = auth.uid()))
  with check (exists (select 1 from public.agencies a where a.owner_id = auth.uid()));

-- ══════════════════════════════════════════════════════════════════════════
--  4. Policies de CLIENTE (se SUMAN a las de owner, vía OR).
--     Lectura sobre todo lo que ve; UPDATE solo en tasks.
-- ══════════════════════════════════════════════════════════════════════════

-- ── clients: el cliente ve su propia ficha ───────────────────────────────
drop policy if exists "clients_client_read" on public.clients;
create policy "clients_client_read" on public.clients
  for select
  using (public.is_client_member(clients.id));

-- ── tasks: LEE + ACTUALIZA (marcar hechas / comentar) las de su cliente ──
drop policy if exists "tasks_client_read"   on public.tasks;
drop policy if exists "tasks_client_update" on public.tasks;

create policy "tasks_client_read" on public.tasks
  for select
  using (public.is_client_member(tasks.client_id));

create policy "tasks_client_update" on public.tasks
  for update
  using (public.is_client_editor(tasks.client_id))
  with check (public.is_client_editor(tasks.client_id));

-- ── meetings: solo LEE su agenda ─────────────────────────────────────────
drop policy if exists "meetings_client_read" on public.meetings;
create policy "meetings_client_read" on public.meetings
  for select
  using (public.is_client_member(meetings.client_id));

-- ── ropre_items: solo LEE (alimenta los reportes) ────────────────────────
drop policy if exists "ropre_client_read" on public.ropre_items;
create policy "ropre_client_read" on public.ropre_items
  for select
  using (public.is_client_member(ropre_items.client_id));

-- ── content_pieces: solo LEE (calendario / entregables) ──────────────────
drop policy if exists "content_client_read" on public.content_pieces;
create policy "content_client_read" on public.content_pieces
  for select
  using (public.is_client_member(content_pieces.client_id));

-- ── projections: solo LEE (proyecciones del reporte) ─────────────────────
drop policy if exists "projections_client_read" on public.projections;
create policy "projections_client_read" on public.projections
  for select
  using (public.is_client_member(projections.client_id));

-- ── funnels + funnel_phases: solo LEE (embudo del reporte) ───────────────
drop policy if exists "funnels_client_read" on public.funnels;
create policy "funnels_client_read" on public.funnels
  for select
  using (public.is_client_member(funnels.client_id));

drop policy if exists "funnel_phases_client_read" on public.funnel_phases;
create policy "funnel_phases_client_read" on public.funnel_phases
  for select
  using (exists (select 1 from public.funnels f where f.id = funnel_phases.funnel_id and public.is_client_member(f.client_id)));

-- ── Verificación: listar todas las policies activas por tabla ────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'team_members','programs','agent_conversations','agent_prompts',
    'clients','tasks','meetings','ropre_items','content_pieces',
    'projections','funnels','funnel_phases'
  )
order by tablename, policyname;
