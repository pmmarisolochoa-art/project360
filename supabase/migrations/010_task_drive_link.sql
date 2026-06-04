-- ══════════════════════════════════════════════════════════════════════════
--  Migración 010: drive_link en tasks
--
--  Permite que cada tarea (especialmente con tag='deliverable') guarde un
--  link al artefacto en Drive / Notion / Figma / etc. Se renderiza como
--  badge clickeable en la kanban card y como input en el TaskModal.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.tasks
  add column if not exists drive_link text;

-- Refresca PostgREST
notify pgrst, 'reload schema';

-- Verifica
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks' and column_name = 'drive_link';
