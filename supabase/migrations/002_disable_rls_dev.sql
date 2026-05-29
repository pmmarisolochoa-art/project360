-- ──────────────────────────────────────────────────────────────────────────
--  Migración 002: deshabilitar RLS para modo desarrollo
--
--  El schema.sql original habilita RLS en todas las tablas con policies que
--  usan auth.uid(). Sin Supabase Auth implementado en la app, esto bloquea
--  todas las queries con la anon key.
--
--  ⚠️ NO APLICAR EN PRODUCCIÓN. Antes de prod:
--     1. Implementar Supabase Auth (signIn/signUp) en la app
--     2. Crear registros users / agencies con los auth.uid() reales
--     3. Volver a habilitar RLS:
--          alter table public.<tabla> enable row level security;
--     4. Verificar que las policies del schema.sql siguen siendo correctas
-- ──────────────────────────────────────────────────────────────────────────

alter table public.users                 disable row level security;
alter table public.agencies              disable row level security;
alter table public.clients               disable row level security;
alter table public.client_team_members   disable row level security;
alter table public.ropre_items           disable row level security;
alter table public.tasks                 disable row level security;
alter table public.meetings              disable row level security;
alter table public.content_pieces        disable row level security;
alter table public.ad_metrics_snapshots  disable row level security;
alter table public.projections           disable row level security;
alter table public.notifications         disable row level security;
