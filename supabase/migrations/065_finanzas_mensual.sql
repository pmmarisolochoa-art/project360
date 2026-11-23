-- Cajón Finanzas: tabla `finanzas_mensual`.
--
-- Ingresos NO se guardan aquí — se derivan en vivo de `leads` ganados
-- (mismo criterio que Ventas usa para Cash collected: fecha del pago, con
-- `updated_at` del lead como respaldo si falta, ver `utils/finanzas.ts`).
-- Lo que esta tabla sí guarda, porque no existe en ningún otro lado, son los
-- GASTOS por mes (ads + otros) y la meta de ingresos — hoy viven en
-- `clients.metrics.invertedThisMonth`/`monthlyRevenueTarget`, un valor que
-- se sobrescribe cada mes y nunca queda historial (founder, 22-oct-2026).
--
-- Un registro por cliente+mes ("YYYY-MM"). Aditiva e idempotente.

create table if not exists public.finanzas_mensual (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  periodo        text not null check (periodo ~ '^\d{4}-\d{2}$'),
  gastos_ads     numeric not null default 0 check (gastos_ads >= 0),
  gastos_otros   numeric not null default 0 check (gastos_otros >= 0),
  meta_ingresos  numeric check (meta_ingresos >= 0),
  notas          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.finanzas_mensual.periodo is 'Mes del registro, formato YYYY-MM.';
comment on column public.finanzas_mensual.gastos_ads is 'Inversión en ads del mes — manual, hereda el rol de clients.metrics.invertedThisMonth.';
comment on column public.finanzas_mensual.meta_ingresos is 'Meta de ingresos del mes — hereda el rol de clients.metrics.monthlyRevenueTarget.';

create unique index if not exists finanzas_mensual_client_periodo_idx
  on public.finanzas_mensual(client_id, periodo);

drop trigger if exists finanzas_mensual_touch on public.finanzas_mensual;
create trigger finanzas_mensual_touch before update on public.finanzas_mensual
  for each row execute function public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Mismo patrón ya corregido para leads (migraciones 060 y 20261014212133):
-- lectura para cualquier miembro del cliente, escritura solo para editores,
-- `to authenticated` explícito desde el día uno.
alter table public.finanzas_mensual enable row level security;

drop policy if exists "finanzas_mensual_read" on public.finanzas_mensual;
create policy "finanzas_mensual_read" on public.finanzas_mensual
  for select
  to authenticated
  using (public.is_client_member(finanzas_mensual.client_id));

drop policy if exists "finanzas_mensual_insert" on public.finanzas_mensual;
create policy "finanzas_mensual_insert" on public.finanzas_mensual
  for insert
  to authenticated
  with check (public.is_client_editor(finanzas_mensual.client_id));

drop policy if exists "finanzas_mensual_update" on public.finanzas_mensual;
create policy "finanzas_mensual_update" on public.finanzas_mensual
  for update
  to authenticated
  using (public.is_client_editor(finanzas_mensual.client_id))
  with check (public.is_client_editor(finanzas_mensual.client_id));

drop policy if exists "finanzas_mensual_delete" on public.finanzas_mensual;
create policy "finanzas_mensual_delete" on public.finanzas_mensual
  for delete
  to authenticated
  using (public.is_client_editor(finanzas_mensual.client_id));

grant select, insert, update, delete on public.finanzas_mensual to authenticated;
