-- 021_team_members_departamentos.sql
-- Departamentos por persona (lente de navegación del cerebro del cliente).
-- Una persona puede estar en varios departamentos: ['pm'], ['pm','content'], etc.
-- Los slugs válidos viven en el código (src/config/departments.ts): pm | finanzas | content.
--
-- Aditiva y reversible: columna nueva con default '[]'. Los miembros existentes
-- quedan con lista vacía → la app les muestra el set de módulos por defecto
-- (mismo comportamiento que antes de esta migración). No toca RLS ni datos.
-- Idempotente: seguro de correr varias veces.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS departamentos jsonb DEFAULT '[]'::jsonb;

-- Ejemplo de asignación (correr manualmente cuando quieras dar de alta a alguien):
--   UPDATE public.team_members SET departamentos = '["pm"]'::jsonb
--     WHERE email = 'persona@ejemplo.com';
--   UPDATE public.team_members SET departamentos = '["pm","content"]'::jsonb
--     WHERE email = 'otra@ejemplo.com';
