-- ══════════════════════════════════════════════════════════════════════════
--  Migración 008: RLS + policies para sistema de Embudos
--
--  La migración 007 creó las tablas funnels + funnel_phases pero sin
--  policies, así que con RLS por defecto en Supabase quedaron BLOQUEADAS.
--  Sin esto, los inserts tiran 403 (Forbidden) → tasks tiran 409 (FK violation).
--
--  Patrón: igual al resto de tablas — owner de la agencia accede a
--  todos los embudos de sus clientes.
-- ══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS
alter table public.funnels       enable row level security;
alter table public.funnel_phases enable row level security;

-- Limpiar policies viejas (idempotencia)
drop policy if exists "funnels_via_client"        on public.funnels;
drop policy if exists "funnel_phases_via_funnel"  on public.funnel_phases;

-- ── FUNNELS: dentro de un cliente que pertenece a mi agencia ────────────
create policy "funnels_via_client" on public.funnels
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = funnels.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = funnels.client_id and a.owner_id = auth.uid()
    )
  );

-- ── FUNNEL PHASES: vía funnel → client → agency ─────────────────────────
create policy "funnel_phases_via_funnel" on public.funnel_phases
  for all
  using (
    exists (
      select 1 from public.funnels f
      join public.clients c   on c.id = f.client_id
      join public.agencies a  on a.id = c.agency_id
      where f.id = funnel_phases.funnel_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.funnels f
      join public.clients c   on c.id = f.client_id
      join public.agencies a  on a.id = c.agency_id
      where f.id = funnel_phases.funnel_id and a.owner_id = auth.uid()
    )
  );

-- Refresca cache de PostgREST
notify pgrst, 'reload schema';

-- Verifica
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public' and tablename in ('funnels', 'funnel_phases')
order by tablename;
