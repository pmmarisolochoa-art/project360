-- ════════════════════════════════════════════════════════════════════════════
--  SALES BRAIN OS — Setup completo de Supabase (un solo archivo)
--
--  Ejecuta este archivo entero en el SQL Editor de Supabase.
--  Incluye:
--    1. Schema base (11 tablas + índices + triggers + RLS)
--    2. Migración 001: columnas adicionales de meetings
--    3. Migración 002: deshabilitar RLS (modo dev sin Auth)
--    4. Migración 003: seed data (3 clientes + 9 tareas + 4 reuniones)
--
--  ⚠️ La migración 002 deshabilita RLS — NO usar tal cual en producción.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
--  PARTE 1 — SCHEMA BASE
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

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

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id) on delete restrict,
  logo_url text,
  plan text not null default 'starter',
  created_at timestamptz not null default now()
);

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

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

drop trigger if exists projections_touch on public.projections;
create trigger projections_touch before update on public.projections
  for each row execute function public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
--  PARTE 2 — MIGRACIÓN 001: columnas faltantes en meetings
-- ════════════════════════════════════════════════════════════════════════════

alter table public.meetings
  add column if not exists video_call_link text,
  add column if not exists notes text,
  add column if not exists notes_updated_at timestamptz,
  add column if not exists completed boolean not null default false;

-- ════════════════════════════════════════════════════════════════════════════
--  PARTE 3 — MIGRACIÓN 002: deshabilitar RLS (modo dev sin Auth)
--  ⚠️ NO USAR EN PRODUCCIÓN
-- ════════════════════════════════════════════════════════════════════════════

alter table public.users                 disable row level security;
alter table public.agencies              disable row level security;
alter table public.clients               disable row level security;
alter table public.client_team_members   disable row level security;
alter table public.ropre_items           disable row level security;
alter table public.tasks                 disable row level security;
alter table public.meetings              disable row level security;
alter table public.content_pieces        disable row level security;
alter table public.ad_metrics_snapshots  disable row level security;
alter table public.projections           disable row level security;
alter table public.notifications         disable row level security;

-- ════════════════════════════════════════════════════════════════════════════
--  PARTE 4 — MIGRACIÓN 003: seed data (3 clientes + 9 tareas + 4 reuniones)
--
--  UUIDs deterministas:
--    agency:  00000000-0000-0000-0000-0000000000a1
--    owner:   00000000-0000-0000-0000-0000000000u1
--    fitmind: 00000000-0000-0000-0000-0000000000c1
--    kuroko:  00000000-0000-0000-0000-0000000000c2
--    escuela: 00000000-0000-0000-0000-0000000000c3
-- ════════════════════════════════════════════════════════════════════════════

-- Limpieza previa (idempotencia)
delete from public.tasks    where client_id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000c3'
);
delete from public.meetings where client_id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000c3'
);
delete from public.clients  where id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000c3'
);
delete from public.agencies where id = '00000000-0000-0000-0000-0000000000a1';
delete from public.users    where id = '00000000-0000-0000-0000-0000000000u1';

-- USER (owner)
insert into public.users (id, email, name, role, timezone) values
('00000000-0000-0000-0000-0000000000u1','estratega@salesbrain.os','Marisol Ochoa','owner','America/Bogota');

-- AGENCY
insert into public.agencies (id, name, owner_id, plan) values
('00000000-0000-0000-0000-0000000000a1','Sales Brain Agency','00000000-0000-0000-0000-0000000000u1','starter');

-- FitMind Colombia (ratio 1.08 → verde)
insert into public.clients (id, agency_id, name, industry, business_type, primary_color, status, project_type, monthly_ads_budget, ads_connected, metrics, onboarding_data, ai_brain_data, created_at, updated_at) values (
  '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1',
  'FitMind Colombia','Salud & Bienestar','Coaching / Mentoría','#6366F1',
  'active','personal_brand',1200,
  '{"meta":true,"google":false,"tiktok":false,"ga4":true}'::jsonb,
  jsonb_build_object('roas',3.4,'pendingTasksToday',4,'nextMeetingAt',(now()+interval '5 hours')::text,'progressPercent',62,'bottleneck',null,'invertedThisMonth',1180,'salesCount',18,'revenueAccumulated',4860,'monthlyRevenueTarget',4500),
  '{"identity":{"businessName":"FitMind Colombia","founderName":"Laura Restrepo","email":"laura@fitmind.co","whatsapp":"+57 300 123 4567","industry":"Salud & Bienestar","yearsInMarket":4,"country":"Colombia","city":"Medellín","website":"https://fitmind.co","socials":{"instagram":"@fitmind.co","tiktok":"@fitmind"}}}'::jsonb,
  '{"executiveSummary":"FitMind es una marca personal de coaching en nutrición consciente y regulación del sistema nervioso, con 4 años de trayectoria. Su fundadora Laura posiciona la marca con tono empático y educativo, atrayendo mujeres profesionales de 28-45 años que buscan bienestar sostenible sin dietas restrictivas."}'::jsonb,
  now()-interval '14 days', now()
);

-- Kuroko Studio (ratio 0.81 → amarillo)
insert into public.clients (id, agency_id, name, industry, business_type, primary_color, status, project_type, monthly_ads_budget, ads_connected, metrics, onboarding_data, ai_brain_data, created_at, updated_at) values (
  '00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000a1',
  'Kuroko Studio','Moda & Streetwear','D2C Ecommerce','#8B5CF6',
  'planning','ecommerce',800,
  '{"meta":false,"google":false,"tiktok":false,"ga4":false}'::jsonb,
  jsonb_build_object('roas',null,'pendingTasksToday',2,'nextMeetingAt',(now()+interval '1 day 3 hours')::text,'progressPercent',18,'bottleneck',jsonb_build_object('role','Media Buyer','reason','Pendiente acceso a Business Manager'),'invertedThisMonth',540,'salesCount',6,'revenueAccumulated',1620,'monthlyRevenueTarget',2000),
  '{"identity":{"businessName":"Kuroko Studio","founderName":"Andrés Salazar","email":"andres@kuroko.studio","whatsapp":"+57 320 987 6543","industry":"Moda & Streetwear","yearsInMarket":2,"country":"Colombia","city":"Bogotá","website":"https://kuroko.studio","socials":{"instagram":"@kuroko.studio","tiktok":"@kurokostudio"}}}'::jsonb,
  '{}'::jsonb,
  now()-interval '7 days', now()
);

-- Escuela Digital Pro (sin target → sin color)
insert into public.clients (id, agency_id, name, industry, business_type, primary_color, status, project_type, monthly_ads_budget, ads_connected, metrics, onboarding_data, ai_brain_data, created_at, updated_at) values (
  '00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000a1',
  'Escuela Digital Pro','EdTech','Infoproducto / Curso','#06B6D4',
  'onboarding','launch',3500,
  '{"meta":false,"google":false,"tiktok":false,"ga4":false}'::jsonb,
  jsonb_build_object('roas',null,'pendingTasksToday',6,'nextMeetingAt',(now()+interval '26 hours')::text,'progressPercent',8,'bottleneck',jsonb_build_object('role','Estratega','reason','Falta validar oferta principal'),'invertedThisMonth',0,'salesCount',0,'revenueAccumulated',0,'monthlyRevenueTarget',null),
  '{"identity":{"businessName":"Escuela Digital Pro","founderName":"Camila Torres","email":"camila@escueladigital.pro","whatsapp":"+52 55 8123 9090","industry":"EdTech / Marketing","yearsInMarket":3,"country":"México","city":"CDMX","socials":{"instagram":"@escueladigital.pro","youtube":"EscuelaDigitalPro"}}}'::jsonb,
  '{}'::jsonb,
  now()-interval '1 day', now()
);

-- REUNIONES
insert into public.meetings (client_id, title, type, scheduled_at, duration_min, participants, agenda, video_call_link, notes, notes_updated_at) values
('00000000-0000-0000-0000-0000000000c1','Revisión semanal de métricas','weekly_metrics',now()+interval '5 hours',45,
 '[{"userId":"00000000-0000-0000-0000-0000000000u1","name":"Marisol"},{"userId":"u_c1","name":"Laura"}]'::jsonb,
 E'1. Revisión de métricas de la semana\n2. Análisis de campañas activas\n3. Ajustes de presupuesto\n4. Próximos pasos y compromisos',
 'https://meet.google.com/abc-defg-hij',
 'Última semana ROAS subió a 3.4x. Pendiente decidir si escalamos el ad set "Regulación nerviosa".',
 now()-interval '1 day');

insert into public.meetings (client_id, title, type, scheduled_at, duration_min, participants) values
('00000000-0000-0000-0000-0000000000c2','Sesión estratégica de contenido','content_strategy',now()+interval '1 day 3 hours',60,
 '[{"userId":"00000000-0000-0000-0000-0000000000u1","name":"Marisol"},{"userId":"u_c2","name":"Andrés"}]'::jsonb),
('00000000-0000-0000-0000-0000000000c3','Kickoff de lanzamiento','kickoff',now()+interval '2 days 2 hours',90,
 '[{"userId":"00000000-0000-0000-0000-0000000000u1","name":"Marisol"},{"userId":"u_c3","name":"Camila"}]'::jsonb),
('00000000-0000-0000-0000-0000000000c1','Revisión de campañas ADS','ads_review',now()+interval '3 days 4 hours',30,
 '[{"userId":"00000000-0000-0000-0000-0000000000u1","name":"Marisol"}]'::jsonb);

-- TAREAS
insert into public.tasks (client_id, title, description, status, priority, assigned_to, due_date, completed_at, is_delayed, delay_days, module_tag, created_at) values
('00000000-0000-0000-0000-0000000000c1','Optimizar copy del Reel #34','Reescribir hook usando lenguaje del avatar principal.','in_progress','P1','Laura Mejía',now()+interval '6 hours',null,false,0,'content',now()-interval '2 days'),
('00000000-0000-0000-0000-0000000000c2','Solicitar acceso a Business Manager','Sin acceso no podemos lanzar campañas — bloquea fase 1.','blocked','P1','Diego Ramírez',now()-interval '1 day',null,true,1,'ads',now()-interval '5 days'),
('00000000-0000-0000-0000-0000000000c1','Revisar performance de campaña Awareness',null,'pending','P2','Diego Ramírez',now()+interval '1 day',null,false,0,'ads',now()-interval '1 day'),
('00000000-0000-0000-0000-0000000000c1','Aprobar storyboard del Reel "regulación nerviosa"',null,'in_review','P2','Marisol Ochoa',now()+interval '3 hours',null,false,0,'content',now()-interval '3 days'),
('00000000-0000-0000-0000-0000000000c1','Setup tracking conversiones GA4',null,'completed','P1','Diego Ramírez',now()-interval '2 days',now()-interval '1 day',false,0,'tech',now()-interval '7 days'),
('00000000-0000-0000-0000-0000000000c2','Definir 3 ángulos de comunicación iniciales',null,'in_progress','P1','Camila Mora',now()+interval '2 days',null,false,0,'strategy',now()-interval '2 days'),
('00000000-0000-0000-0000-0000000000c3','Validar oferta principal con 5 clientes pasados',null,'pending','P1','Marisol Ochoa',now()+interval '3 days',null,false,0,'strategy',now()-interval '1 day'),
('00000000-0000-0000-0000-0000000000c3','Definir cuenta regresiva del lanzamiento (45 días)',null,'in_progress','P2','Marisol Ochoa',now()+interval '5 days',null,false,0,'launch',now()-interval '1 day'),
('00000000-0000-0000-0000-0000000000c1','Cerrar contrato con diseñadora freelance',null,'pending','P3','Marisol Ochoa',now()+interval '7 days',null,false,0,'ops',now()-interval '1 day');

-- ════════════════════════════════════════════════════════════════════════════
--  VERIFICACIÓN
-- ════════════════════════════════════════════════════════════════════════════
-- Debe devolver: clients=3, tasks=9, meetings=4

select 'clients' as tabla, count(*) from public.clients
union all select 'tasks',    count(*) from public.tasks
union all select 'meetings', count(*) from public.meetings;
