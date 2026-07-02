-- ══════════════════════════════════════════════════════════════════════════
--  Migración 018b: is_client_editor (parche)
--
--  La función is_client_editor forma parte de 018_client_access.sql, pero
--  algunas bases corrieron una versión previa de la 018 (sin ella). Este
--  parche la crea de forma idempotente y endurece tasks_client_update para
--  que editar tareas requiera ser miembro EDITOR (un viewer no escribe ni a
--  nivel BD). Necesaria antes de la 019 (task_links depende de esta función).
--
--  Idempotente: seguro de correr aunque la 018 completa ya haya pasado.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.is_client_editor(target_client uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.client_id = target_client
      and tm.access_level = 'editor'
  );
$$;

grant execute on function public.is_client_editor(uuid) to anon, authenticated;

drop policy if exists "tasks_client_update" on public.tasks;
create policy "tasks_client_update" on public.tasks
  for update
  using (public.is_client_editor(tasks.client_id))
  with check (public.is_client_editor(tasks.client_id));
