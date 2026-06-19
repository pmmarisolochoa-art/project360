-- 013_team_members.sql
-- Sprint E · Sección 3 — Miembros del equipo por cliente con funciones y KPIs editables.
-- Idempotente: seguro de correr varias veces.

CREATE TABLE IF NOT EXISTS public.team_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  rol          text NOT NULL,
  email        text,
  avatar_color text,
  funciones    jsonb DEFAULT '[]'::jsonb,
  kpis_custom  jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_client
  ON public.team_members (client_id);

-- RLS: mismo patrón permisivo que el resto de tablas en beta (ver 002/004).
-- Si el proyecto ya tiene RLS habilitado con políticas por agencia, ajustar aquí.
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members'
      AND policyname = 'team_members_all'
  ) THEN
    CREATE POLICY team_members_all ON public.team_members
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
