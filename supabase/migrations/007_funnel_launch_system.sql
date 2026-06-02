-- ──────────────────────────────────────────────────────────────────────────
--  Migración 007: Sistema de Embudos de Lanzamiento
--  Tablas:
--   - funnels: 1 embudo por cliente, basado en una plantilla
--   - funnel_phases: fases dentro del embudo (orden + colores + días)
--  Extensión:
--   - tasks.funnel_id / tasks.phase_id (enlace de la tarea al embudo)
--
--  El borrado en cascada elimina fases y desvincula tareas si se elimina
--  un funnel (las tareas se conservan, solo se les pone funnel_id=null).
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.funnels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  template_key text not null,
  name text not null,
  status text not null default 'planning',
  start_date timestamptz not null,
  event_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_funnels_client on public.funnels(client_id);
create index if not exists idx_funnels_status on public.funnels(status);

create table if not exists public.funnel_phases (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  order_idx int not null,
  name text not null,
  color text not null,
  day_start int not null,
  day_end int not null
);

create index if not exists idx_funnel_phases_funnel on public.funnel_phases(funnel_id);

-- Extensión de tasks para enlazar al embudo.
alter table public.tasks
  add column if not exists funnel_id uuid references public.funnels(id) on delete set null,
  add column if not exists phase_id uuid references public.funnel_phases(id) on delete set null;

create index if not exists idx_tasks_funnel on public.tasks(funnel_id);

-- Refresca cache de PostgREST.
notify pgrst, 'reload schema';
