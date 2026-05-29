-- ────────────────────────────────────────────────────────────────────────────
--  SALES BRAIN OS — Esquema PostgreSQL / Supabase
--  Aplicar en orden con: `supabase db push` o ejecutando en SQL Editor.
--  Asume extensiones: pgcrypto para gen_random_uuid().
-- ────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── USERS ────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null check (role in ('owner','pm','team','client')),
  avatar_url text,
  whatsapp text,
  timezone text not null default 'America/Bogota',
  created_at timestamptz not null default now()
);

-- ── AGENCIES ─────────────────────────────────────────────────────────────────
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id) on delete restrict,
  logo_url text,
  plan text not null default 'starter',
  created_at timestamptz not null default now()
);

-- ── CLIENTS ──────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  industry text not null,
  business_type text not null,
  primary_color text not null,
  status text not null check (status in ('onboarding','planning','active','paused','completed')),
  project_type text not null check (project_type in ('ecommerce','launch','evergreen','personal_brand','other')),
  onboarding_data jsonb not null default '{}'::jsonb,
  ai_brain_data jsonb not null default '{}'::jsonb,
  ads_connected jsonb not null default '{"meta":false,"google":false,"tiktok":false,"ga4":false}'::jsonb,
  monthly_ads_budget numeric not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_agency_idx on public.clients(agency_id);
create index if not exists clients_status_idx on public.clients(status);

-- ── CLIENT TEAM MEMBERS ──────────────────────────────────────────────────────
create table if not exists public.client_team_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null,
  kpis jsonb not null default '{}'::jsonb,
  notification_email boolean not null default true,
  notification_whatsapp boolean not null default true,
  unique (client_id, user_id, role)
);

-- ── ROPRE ITEMS ──────────────────────────────────────────────────────────────
create table if not exists public.ropre_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('result','objective','premise','risk','deliverable')),
  title text not null,
  description text,
  risk_level text check (risk_level in ('low','medium','high')),
  mitigation text,
  status text check (status in ('todo','in_progress','review','done')),
  start_date timestamptz,
  due_date timestamptz,
  responsible text,
  target_value text,
  current_value text,
  created_at timestamptz not null default now()
);
create index if not exists ropre_client_idx on public.ropre_items(client_id);
create index if not exists ropre_type_idx on public.ropre_items(type);

-- ── TASKS ────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('pending','in_progress','in_review','completed','blocked')),
  priority text not null check (priority in ('P1','P2','P3')),
  assigned_to text not null,
  due_date timestamptz not null,
  completed_at timestamptz,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  module_tag text,
  is_delayed boolean not null default false,
  delay_days integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tasks_client_idx on public.tasks(client_id);
create index if not exists tasks_due_idx on public.tasks(due_date);
create index if not exists tasks_status_idx on public.tasks(status);

-- ── MEETINGS ─────────────────────────────────────────────────────────────────
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  type text not null check (type in ('kickoff','weekly_metrics','content_strategy','ads_review','monthly_closing','crisis')),
  scheduled_at timestamptz not null,
  duration_min integer not null default 30,
  participants jsonb not null default '[]'::jsonb,
  agenda text,
  recording_url text,
  transcription text,
  summary text,
  extracted_tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists meetings_client_idx on public.meetings(client_id);
create index if not exists meetings_when_idx on public.meetings(scheduled_at);

-- ── CONTENT PIECES ───────────────────────────────────────────────────────────
create table if not exists public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('instagram','tiktok','youtube','linkedin','facebook')),
  format text not null check (format in ('reel','post','story','video','carousel')),
  copy_text text,
  media_url text,
  status text not null check (status in ('copy','recording','editing','review','scheduled','published')),
  approval text not null default 'pending' check (approval in ('pending','approved','rejected')),
  approval_notes text,
  scheduled_for timestamptz,
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists content_client_idx on public.content_pieces(client_id);

-- ── AD METRICS SNAPSHOTS ─────────────────────────────────────────────────────
create table if not exists public.ad_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('meta','google','tiktok','ga4')),
  date date not null,
  metrics jsonb not null,
  campaigns jsonb not null default '[]'::jsonb,
  insights_ai text,
  created_at timestamptz not null default now(),
  unique (client_id, platform, date)
);
create index if not exists ad_metrics_client_idx on public.ad_metrics_snapshots(client_id, date desc);

-- ── PROJECTIONS ──────────────────────────────────────────────────────────────
create table if not exists public.projections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  target_revenue_3m numeric,
  target_revenue_6m numeric,
  target_revenue_12m numeric,
  monthly_ads_budget numeric,
  funnel_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── NOTIFICATIONS ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  type text not null,
  message text not null,
  urgency text not null check (urgency in ('low','normal','high','critical')),
  is_read boolean not null default false,
  channel text not null check (channel in ('in_app','email','whatsapp')),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists notif_user_unread_idx on public.notifications(user_id) where is_read = false;

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

drop trigger if exists projections_touch on public.projections;
create trigger projections_touch before update on public.projections
  for each row execute function public.touch_updated_at();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.agencies enable row level security;
alter table public.clients enable row level security;
alter table public.client_team_members enable row level security;
alter table public.ropre_items enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.content_pieces enable row level security;
alter table public.ad_metrics_snapshots enable row level security;
alter table public.projections enable row level security;
alter table public.notifications enable row level security;

-- Capa 0 (owner): acceso completo a sus agencias.
-- Capa 1 (pm): acceso a clientes asignados vía client_team_members.
-- Capa 2 (team/cliente): acceso limitado.
-- Las policies abajo son un baseline — ajustarlas según los flujos finales.

create policy if not exists "users_self_read" on public.users
  for select using (auth.uid() = id);

create policy if not exists "agencies_owner_all" on public.agencies
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy if not exists "clients_via_agency_owner" on public.clients
  for all using (
    exists (select 1 from public.agencies a where a.id = clients.agency_id and a.owner_id = auth.uid())
  );

create policy if not exists "clients_team_read" on public.clients
  for select using (
    exists (
      select 1 from public.client_team_members m
      where m.client_id = clients.id and m.user_id = auth.uid()
    )
  );

create policy if not exists "tasks_via_client_owner" on public.tasks
  for all using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = tasks.client_id and a.owner_id = auth.uid()
    )
  );

create policy if not exists "notifications_own" on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
