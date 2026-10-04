-- `projections` nunca tuvo 4 columnas que `projectionToRow()` manda en CADA
-- guardado desde el día 1: active_scenario, success_indicators,
-- benchmarks_override, duration_months. Postgres rechaza el upsert entero
-- por columna inexistente → "No se pudo guardar la proyección" en TODA
-- la pestaña (KRs, Inversión, Funnel financiero comparten un solo state).
--
-- Mismo patrón que la migración 038 (10 columnas de tasks/meetings que el
-- repo usaba pero ninguna migración creaba) — efecto cero sobre filas
-- existentes, add column if not exists puro.
alter table public.projections add column if not exists active_scenario text not null default 'realistic';
alter table public.projections add column if not exists success_indicators jsonb not null default '[]'::jsonb;
alter table public.projections add column if not exists benchmarks_override jsonb not null default '{}'::jsonb;
alter table public.projections add column if not exists duration_months integer not null default 12;
