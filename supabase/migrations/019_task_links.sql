-- ══════════════════════════════════════════════════════════════════════════
--  Migración 019: task_links — entregables y links que sube el equipo
--
--  Fuente de verdad PERSISTENTE de lo que el equipo entrega en cada tarea
--  (link de Drive/Notion/Loom/etc.). Reemplaza al repo de links in-memory
--  para el caso "entregable del equipo": el PM/owner lo ve entre sesiones.
--
--  Modelo de permisos (reusa helpers de 018):
--    - LECTURA: owner de la agencia + cualquier miembro del cliente.
--    - ESCRITURA (insert/delete): owner + miembro EDITOR del cliente,
--      y solo puede crear links a nombre propio (created_by = auth.uid()).
--
--  Idempotente.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.task_links (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references public.tasks(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete cascade,
  nombre      text not null,
  url         text not null,
  tipo        text not null default 'entregable',   -- entregable | referencia | drive | notion | loom | web | otro
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_task_links_task   on public.task_links (task_id);
create index if not exists idx_task_links_client on public.task_links (client_id);

alter table public.task_links enable row level security;

-- ── LECTURA: owner de la agencia del cliente, o miembro del cliente ───────
drop policy if exists "task_links_read" on public.task_links;
create policy "task_links_read" on public.task_links
  for select
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = task_links.client_id and a.owner_id = auth.uid()
    )
    or public.is_client_member(task_links.client_id)
  );

-- ── ESCRITURA (owner): gestiona todo lo de sus clientes ──────────────────
drop policy if exists "task_links_owner_write" on public.task_links;
create policy "task_links_owner_write" on public.task_links
  for all
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = task_links.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = task_links.client_id and a.owner_id = auth.uid()
    )
  );

-- ── ESCRITURA (miembro editor): crea links a nombre propio ───────────────
drop policy if exists "task_links_member_insert" on public.task_links;
create policy "task_links_member_insert" on public.task_links
  for insert
  with check (
    public.is_client_editor(task_links.client_id)
    and created_by = auth.uid()
  );

-- ── El miembro editor puede borrar los links que él mismo subió ──────────
drop policy if exists "task_links_member_delete" on public.task_links;
create policy "task_links_member_delete" on public.task_links
  for delete
  using (
    public.is_client_editor(task_links.client_id)
    and created_by = auth.uid()
  );

-- ── Verificación ─────────────────────────────────────────────────────────
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'task_links'
order by policyname;
