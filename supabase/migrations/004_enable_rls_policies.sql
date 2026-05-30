-- ══════════════════════════════════════════════════════════════════════════
--  Migración 004: re-enable RLS + policies por agencia (multi-tenant)
--
--  Reemplaza el modo dev sin RLS por políticas estrictas:
--    - Cada user solo puede leer/escribir las rows que pertenecen a su agencia
--    - La regla central: agencies.owner_id = auth.uid()
--    - Tasks/Meetings/etc viajan via FK al cliente → agencia → owner
--
--  Pre-requisitos:
--    - Cada user en public.users tiene id = auth.users.id (1:1 mapping)
--    - Cada agencia tiene owner_id apuntando a un public.users válido
-- ══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
alter table public.users                enable row level security;
alter table public.agencies             enable row level security;
alter table public.clients              enable row level security;
alter table public.client_team_members  enable row level security;
alter table public.ropre_items          enable row level security;
alter table public.tasks                enable row level security;
alter table public.meetings             enable row level security;
alter table public.content_pieces       enable row level security;
alter table public.ad_metrics_snapshots enable row level security;
alter table public.projections          enable row level security;
alter table public.notifications        enable row level security;

-- Limpiar policies viejas (idempotencia)
drop policy if exists "users_self"                on public.users;
drop policy if exists "agencies_owner"            on public.agencies;
drop policy if exists "clients_via_agency"        on public.clients;
drop policy if exists "team_via_client"           on public.client_team_members;
drop policy if exists "ropre_via_client"          on public.ropre_items;
drop policy if exists "tasks_via_client"          on public.tasks;
drop policy if exists "meetings_via_client"       on public.meetings;
drop policy if exists "content_via_client"        on public.content_pieces;
drop policy if exists "ad_metrics_via_client"     on public.ad_metrics_snapshots;
drop policy if exists "projections_via_client"    on public.projections;
drop policy if exists "notifications_own"         on public.notifications;

-- ── USERS: cada user gestiona su propia row ─────────────────────────────
create policy "users_self" on public.users
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── AGENCIES: owner controla su agencia ─────────────────────────────────
create policy "agencies_owner" on public.agencies
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── CLIENTS: dentro de la agencia que poseo ─────────────────────────────
create policy "clients_via_agency" on public.clients
  for all
  using (
    exists (
      select 1 from public.agencies a
      where a.id = clients.agency_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agencies a
      where a.id = clients.agency_id and a.owner_id = auth.uid()
    )
  );

-- ── Helper inline para "client pertenece a mi agencia" ──────────────────
-- Pattern reutilizado en tasks/meetings/ropre/content/ad_metrics/projections

-- ── TASKS ────────────────────────────────────────────────────────────────
create policy "tasks_via_client" on public.tasks
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = tasks.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = tasks.client_id and a.owner_id = auth.uid()
    )
  );

-- ── MEETINGS ─────────────────────────────────────────────────────────────
create policy "meetings_via_client" on public.meetings
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = meetings.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = meetings.client_id and a.owner_id = auth.uid()
    )
  );

-- ── ROPRE ITEMS ──────────────────────────────────────────────────────────
create policy "ropre_via_client" on public.ropre_items
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = ropre_items.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = ropre_items.client_id and a.owner_id = auth.uid()
    )
  );

-- ── CONTENT PIECES ───────────────────────────────────────────────────────
create policy "content_via_client" on public.content_pieces
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = content_pieces.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = content_pieces.client_id and a.owner_id = auth.uid()
    )
  );

-- ── AD METRICS SNAPSHOTS ─────────────────────────────────────────────────
create policy "ad_metrics_via_client" on public.ad_metrics_snapshots
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = ad_metrics_snapshots.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = ad_metrics_snapshots.client_id and a.owner_id = auth.uid()
    )
  );

-- ── PROJECTIONS ──────────────────────────────────────────────────────────
create policy "projections_via_client" on public.projections
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = projections.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = projections.client_id and a.owner_id = auth.uid()
    )
  );

-- ── CLIENT TEAM MEMBERS ──────────────────────────────────────────────────
-- El owner de la agencia gestiona los miembros de sus clientes.
create policy "team_via_client" on public.client_team_members
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = client_team_members.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = client_team_members.client_id and a.owner_id = auth.uid()
    )
  );

-- ── NOTIFICATIONS: solo tus propias notificaciones ──────────────────────
create policy "notifications_own" on public.notifications
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Verificación: contar policies activas ───────────────────────────────
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
