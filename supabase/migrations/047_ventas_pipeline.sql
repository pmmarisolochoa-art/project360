-- 047 — Pipeline de Ventas: `leads` + `lead_events`.
--
-- Cajón Ventas (arquitectura de 6 cajones, 24-sep). Dos tablas, mismo patrón
-- que el resto de la app (RLS por agencia vía clients, sin infraestructura
-- externa — el CRM evaluado no encajaba, ver historial de decisiones).
--
-- `leads` guarda el ESTADO actual del lead. `lead_events` es el viaje,
-- append-only: cada vez que una tarjeta se mueve de etapa se agrega una fila
-- aquí y nunca se edita ni se borra — de esta tabla vive el panel "Viaje del
-- lead" y el historial completo (quién lo movió, cuándo, por qué).
--
-- `program_value` y `cash_collected` son dos campos simples y editables:
-- `cash_collected` es MANUAL a propósito (founder, 28-sep) — lo actualiza
-- quien confirma el pago, no se deriva de un plan de cuotas que todavía no
-- existe. El pendiente de cobro es resta directa en el cliente, no una suma
-- calculada aquí.
--
-- Aditiva e idempotente — segura de correr varias veces.

-- ── leads ────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  nombre         text not null,
  telefono       text,
  email          text,
  fuente         text not null default 'otro'
                   check (fuente in ('meta', 'organico', 'referido', 'otro')),
  etapa          text not null default 'nuevo'
                   check (etapa in (
                     'nuevo', 'contactado', 'calificado', 'cita_agendada',
                     'cita_realizada', 'propuesta', 'ganado', 'perdido'
                   )),
  setter_id      uuid references public.team_members(id) on delete set null,
  closer_id      uuid references public.team_members(id) on delete set null,
  program_value  numeric,
  cash_collected numeric not null default 0,
  lost_reason    text,
  -- Para futuras integraciones (ej. Fathom emparejando por email) sin duplicar.
  external_id    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  closed_at      timestamptz
);

comment on column public.leads.cash_collected is
  'Manual — lo actualiza quien confirma el pago. NO se calcula de un plan de cuotas.';
comment on column public.leads.program_value is
  'Valor del programa contratado (se llena al pasar a etapa ganado, pero es editable antes).';

create index if not exists leads_client_idx on public.leads(client_id);
create index if not exists leads_etapa_idx  on public.leads(client_id, etapa);
create unique index if not exists leads_external_id_idx
  on public.leads(client_id, external_id) where external_id is not null;

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ── lead_events ──────────────────────────────────────────────────────────
create table if not exists public.lead_events (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads(id) on delete cascade,
  etapa_anterior  text,
  etapa_nueva     text not null,
  nota            text,
  actor_id        uuid references public.team_members(id) on delete set null,
  -- Nombre plano ademas del fk: si el team_member se borra despues, el
  -- historial no debe volverse anonimo ("¿quien movio esto?").
  actor_nombre    text,
  created_at      timestamptz not null default now()
);

comment on table public.lead_events is
  'Append-only. Nunca se edita ni se borra — es el historial completo del viaje del lead.';

create index if not exists lead_events_lead_idx on public.lead_events(lead_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.leads       enable row level security;
alter table public.lead_events enable row level security;

drop policy if exists "leads_via_client" on public.leads;
create policy "leads_via_client" on public.leads
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = leads.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = leads.client_id and a.owner_id = auth.uid()
    )
  );

drop policy if exists "lead_events_via_lead" on public.lead_events;
create policy "lead_events_via_lead" on public.lead_events
  for all
  using (
    exists (
      select 1 from public.leads l
      join public.clients c on c.id = l.client_id
      join public.agencies a on a.id = c.agency_id
      where l.id = lead_events.lead_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      join public.clients c on c.id = l.client_id
      join public.agencies a on a.id = c.agency_id
      where l.id = lead_events.lead_id and a.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.leads       to anon, authenticated;
grant select, insert, update, delete on public.lead_events to anon, authenticated;
