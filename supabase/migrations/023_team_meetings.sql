-- ──────────────────────────────────────────────────────────────────────────
--  Migración 023: Reuniones internas del equipo (no de un cliente).
--
--  Hoy toda reunión obliga a tener client_id. Los rituales internos (daily,
--  planeación, sprint de cierre) no son de un cliente sino de la agencia.
--  Esta migración permite que una reunión sea:
--    - de un cliente  → client_id set, agency_id null  (como hasta hoy)
--    - del equipo      → client_id null, agency_id set   (nuevo)
--
--  Aditiva y reversible: las reuniones de cliente existentes no se tocan.
--  Idempotente.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Permitir reuniones sin cliente + columna de agencia.
alter table public.meetings alter column client_id drop not null;
alter table public.meetings
  add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
create index if not exists meetings_agency_idx on public.meetings (agency_id);

-- 2. Permisos (RLS). Se SUMAN a las policies de reuniones de cliente (OR), que
--    no se tocan. Las reuniones de cliente tienen agency_id null → estas policies
--    no aplican a ellas; las de equipo tienen client_id null → las policies de
--    cliente no aplican a ellas. Sin solapamiento.

-- Owner de la agencia: CRUD completo de sus reuniones de equipo.
drop policy if exists "meetings_team_via_agency" on public.meetings;
create policy "meetings_team_via_agency" on public.meetings
  for all
  using (
    exists (select 1 from public.agencies a
            where a.id = meetings.agency_id and a.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.agencies a
            where a.id = meetings.agency_id and a.owner_id = auth.uid())
  );

-- Miembros del equipo: LEEN las reuniones internas de la agencia para la que
-- trabajan (agency del/los cliente(s) donde son team_member).
drop policy if exists "meetings_team_read" on public.meetings;
create policy "meetings_team_read" on public.meetings
  for select
  using (
    meetings.agency_id is not null
    and exists (
      select 1 from public.team_members tm
      join public.clients c on c.id = tm.client_id
      where tm.user_id = auth.uid() and c.agency_id = meetings.agency_id
    )
  );

-- Verificación.
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'meetings'
order by policyname;
