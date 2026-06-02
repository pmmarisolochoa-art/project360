-- ──────────────────────────────────────────────────────────────────────────
--  Migración 006: trazabilidad ROPRE ↔ Tareas y reuniones
--  Permite:
--   - linked_task_id: cuando un entregable ROPRE se convierte en tarea
--   - last_edited_in_meeting_id + last_edited_at: qué reunión actualizó
--     este item por última vez (badge "Última actualización" en RopreModule)
-- ──────────────────────────────────────────────────────────────────────────

alter table public.ropre_items
  add column if not exists linked_task_id text,
  add column if not exists last_edited_in_meeting_id text,
  add column if not exists last_edited_at timestamptz;

-- Refresca el cache de PostgREST para que la API REST vea las columnas nuevas.
notify pgrst, 'reload schema';
