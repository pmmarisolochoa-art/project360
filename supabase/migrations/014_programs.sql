-- 014_programs.sql
-- Sprint E · Sección 4 — Programas por cliente (un cliente puede correr varios a la vez).
-- Vincula tareas y embudos a un programa. Idempotente.

CREATE TABLE IF NOT EXISTS public.programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  tipo            text NOT NULL,
  descripcion     text,
  fecha_inicio    date,
  fecha_evento    date,
  fecha_cierre    date,
  estado          text DEFAULT 'activo',   -- activo | pausa | riesgo | archivado
  funnel_template text,
  color           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programs_client
  ON public.programs (client_id);

-- Vincular tareas y embudos a un programa.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL;

ALTER TABLE public.funnels
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_program   ON public.tasks (program_id);
CREATE INDEX IF NOT EXISTS idx_funnels_program ON public.funnels (program_id);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'programs'
      AND policyname = 'programs_all'
  ) THEN
    CREATE POLICY programs_all ON public.programs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
