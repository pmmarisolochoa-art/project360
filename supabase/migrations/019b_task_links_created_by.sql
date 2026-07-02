-- ══════════════════════════════════════════════════════════════════════════
--  Migración 019b: task_links.created_by lo asigna el servidor
--
--  La política de INSERT exigía `created_by = auth.uid()` enviado por el
--  cliente, condición frágil. Ahora created_by tiene DEFAULT auth.uid()
--  (lo pone Postgres) y la política de INSERT solo exige ser miembro EDITOR.
--  Es más seguro (el cliente no puede falsear el autor) y elimina el bloqueo.
--
--  Idempotente.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.task_links
  alter column created_by set default auth.uid();

drop policy if exists "task_links_member_insert" on public.task_links;
create policy "task_links_member_insert" on public.task_links
  for insert
  with check (public.is_client_editor(task_links.client_id));

-- Verificación
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'task_links'
order by policyname;
