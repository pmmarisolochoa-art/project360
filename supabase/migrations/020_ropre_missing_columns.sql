-- ══════════════════════════════════════════════════════════════════════════
--  Migración 020: columnas faltantes en ropre_items
--
--  La app guarda linked_task_id, last_edited_in_meeting_id y last_edited_at,
--  pero la tabla en prod (esquema previo) no las tenía → cada INSERT de ROPRE
--  fallaba entero y nada se guardaba. Se agregan idempotentes.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.ropre_items
  add column if not exists linked_task_id uuid,
  add column if not exists last_edited_in_meeting_id uuid,
  add column if not exists last_edited_at timestamptz;

-- Verificación
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'ropre_items'
order by column_name;
