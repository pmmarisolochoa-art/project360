-- ══════════════════════════════════════════════════════════════════════════
--  Migración 005: 5 tablas faltantes con persistencia
--
--  Crea las tablas que aún viven en memoria:
--    - client_team_members  (assignments de roles por cliente)
--    - content_pieces       (calendario editorial)
--    - projections          (proyecciones financieras + funnel + OKRs)
--    - notifications        (notificaciones in-app)
--    - ad_metrics_snapshots (histórico de métricas por plataforma)
--
--  Misma estrategia que las anteriores: columnas clave indexables + data jsonb
--  para el resto. RLS habilitado con policy via cliente → agencia → owner.
-- ══════════════════════════════════════════════════════════════════════════

-- ── client_team_members ─────────────────────────────────────────────────
create table if not exists public.client_team_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  role_slug text not null,
  member_name text not null,
  bottleneck text default '',
  weekly_achievements text default '',
  kpi_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (client_id, role_slug)
);
create index if not exists ctm_client_idx on public.client_team_members(client_id);

-- ── content_pieces ──────────────────────────────────────────────────────
create table if not exists public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  platform text not null check (platform in ('instagram','tiktok','youtube','linkedin','facebook')),
  format text not null check (format in ('reel','post','story','video','carousel','short')),
  copy_text text default '',
  media_url text,
  production_notes text,
  approval_notes text,
  status text not null default 'not_started',
  approval text not null default 'pending' check (approval in ('pending','approved','rejected')),
  recording_date timestamptz,
  editing_date timestamptz,
  approval_date timestamptz,
  publish_date timestamptz,
  has_lead_magnet boolean not null default false,
  lead_magnet_description text,
  created_by text,
  approved_by text,
  created_at timestamptz not null default now()
);
create index if not exists content_client_idx on public.content_pieces(client_id);
create index if not exists content_status_idx on public.content_pieces(status);
create index if not exists content_publish_idx on public.content_pieces(publish_date);

-- ── projections ─────────────────────────────────────────────────────────
-- Estructura amplia con JSONB porque guarda funnel + OKRs + Gantt + debriefing.
create table if not exists public.projections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade unique,
  funnel_inputs jsonb not null default '{}'::jsonb,
  okrs jsonb not null default '[]'::jsonb,
  phases jsonb not null default '[]'::jsonb,
  investment_lines jsonb not null default '[]'::jsonb,
  market_sizing jsonb not null default '{}'::jsonb,
  debriefing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── notifications ───────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  type text not null,
  message text not null,
  urgency text not null default 'normal' check (urgency in ('low','normal','high','critical')),
  is_read boolean not null default false,
  channel text not null default 'in_app' check (channel in ('in_app','email','whatsapp')),
  link text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists notif_user_unread_idx on public.notifications(user_id) where is_read = false;

-- ── ad_metrics_snapshots ────────────────────────────────────────────────
create table if not exists public.ad_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('meta','google','tiktok','ga4')),
  date date not null,
  metrics jsonb not null default '{}'::jsonb,
  campaigns jsonb not null default '[]'::jsonb,
  insights_ai text,
  created_at timestamptz not null default now(),
  unique (client_id, platform, date)
);
create index if not exists ad_metrics_client_idx on public.ad_metrics_snapshots(client_id, date desc);

-- ── Trigger updated_at en projections ───────────────────────────────────
drop trigger if exists projections_touch on public.projections;
create trigger projections_touch before update on public.projections
  for each row execute function public.touch_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
--  RLS + Policies (mismo patrón que migración 004: via cliente → agencia → owner)
-- ══════════════════════════════════════════════════════════════════════════

alter table public.client_team_members  enable row level security;
alter table public.content_pieces       enable row level security;
alter table public.projections          enable row level security;
alter table public.notifications        enable row level security;
alter table public.ad_metrics_snapshots enable row level security;

drop policy if exists "team_via_client"        on public.client_team_members;
drop policy if exists "content_via_client"     on public.content_pieces;
drop policy if exists "projections_via_client" on public.projections;
drop policy if exists "notifications_own"      on public.notifications;
drop policy if exists "ad_metrics_via_client"  on public.ad_metrics_snapshots;

create policy "team_via_client" on public.client_team_members
  for all
  using (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = client_team_members.client_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = client_team_members.client_id and a.owner_id = auth.uid()));

create policy "content_via_client" on public.content_pieces
  for all
  using (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = content_pieces.client_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = content_pieces.client_id and a.owner_id = auth.uid()));

create policy "projections_via_client" on public.projections
  for all
  using (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = projections.client_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = projections.client_id and a.owner_id = auth.uid()));

create policy "notifications_own" on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ad_metrics_via_client" on public.ad_metrics_snapshots
  for all
  using (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = ad_metrics_snapshots.client_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.clients c join public.agencies a on a.id = c.agency_id where c.id = ad_metrics_snapshots.client_id and a.owner_id = auth.uid()));

-- ── Grants (en caso de que default privileges no se haya propagado) ─────
grant select, insert, update, delete on public.client_team_members  to anon, authenticated;
grant select, insert, update, delete on public.content_pieces       to anon, authenticated;
grant select, insert, update, delete on public.projections          to anon, authenticated;
grant select, insert, update, delete on public.notifications        to anon, authenticated;
grant select, insert, update, delete on public.ad_metrics_snapshots to anon, authenticated;

-- ── Verificación final ──────────────────────────────────────────────────
select tablename, rowsecurity, policyname
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.tablename in ('client_team_members','content_pieces','projections','notifications','ad_metrics_snapshots')
order by tablename;
