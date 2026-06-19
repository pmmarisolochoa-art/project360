-- 015_task_kpi.sql
-- Sprint E · Sección 5 — cada tarea tiene un KPI de resultado.
-- Idempotente.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS kpi_nombre    text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS kpi_meta      text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS kpi_resultado text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS kpi_tipo      text DEFAULT 'manual';
