-- ══════════════════════════════════════════════════════════════════════════
--  Migración 018c: lectura de reuniones y ROPRE para miembros (parche)
--
--  Las policies meetings_client_read y ropre_client_read forman parte de la
--  018, pero algunas bases corrieron una versión previa sin ellas: el miembro
--  ve sus tareas pero la Agenda y el ROPRE salen vacíos. Este parche las
--  asegura de forma idempotente (lectura para cualquier miembro del cliente).
--
--  Idempotente.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.meetings   enable row level security;
alter table public.ropre_items enable row level security;

-- ── Reuniones: el miembro LEE la agenda de sus clientes ──────────────────
drop policy if exists "meetings_client_read" on public.meetings;
create policy "meetings_client_read" on public.meetings
  for select
  using (public.is_client_member(meetings.client_id));

-- ── ROPRE: el miembro LEE el ROPRE de sus clientes ───────────────────────
drop policy if exists "ropre_client_read" on public.ropre_items;
create policy "ropre_client_read" on public.ropre_items
  for select
  using (public.is_client_member(ropre_items.client_id));

-- ── Verificación ─────────────────────────────────────────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('meetings', 'ropre_items')
order by tablename, policyname;
