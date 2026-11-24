-- Métricas orgánicas de contenido (Instagram/Facebook) — serie de tiempo por pieza.
-- Founder, 24-nov-2026: antes de conectar la app de Meta, construimos la base de
-- captura MANUAL (misma columna la llena la API después, sin migración nueva).
--
-- Decisiones de esta sesión:
-- - SERIE DE TIEMPO, no un solo valor: cada fila es UNA LECTURA en el tiempo.
--   Necesario para Historias (expiran en 24h, hay que capturarlas antes de que
--   desaparezcan) y para comparar piezas en el mismo punto de su vida.
-- - `frame_index` distingue cada frame de una secuencia de Historia (0 para
--   post/reel/carrusel/video normal; 1,2,3… por cada historia de la secuencia).
-- - Hook/cuerpo/CTA: Meta NO expone retención por segmento vía API (solo la
--   gráfica nativa de Instagram Insights). Se aproxima con
--   avg_watch_time_seconds / video_duration_seconds — un % agregado, no por
--   segmento. No se inventa un dato que la API no da.
-- - Carruseles: mismo set de métricas agregado del carrusel completo — tampoco
--   hay swipe-through por slide vía API.
-- - `follows`: SÍ es atribuible por pieza — Meta expone `profile_activity` con
--   breakdown FOLLOWS en Insights nativo (confirmado por captura de pantalla de
--   la founder), así que no es una estimación.
-- - Permisos: igual que Leads (migración 060) — lee cualquier miembro del
--   cliente, escribe (crea/edita) solo editor; dueño de agencia con acceso total.

create table if not exists public.content_piece_metrics (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null references public.content_pieces(id) on delete cascade,
  frame_index integer not null default 0,
  captured_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'meta_api')),

  -- comunes a cualquier formato
  reach integer,
  impressions integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  profile_visits integer,
  bio_link_clicks integer,
  follows integer,

  -- solo video/reel — retención agregada = avg_watch_time_seconds / video_duration_seconds
  video_duration_seconds numeric,
  avg_watch_time_seconds numeric,

  -- solo historia (por frame)
  exits integer,
  replies integer,
  taps_forward integer,
  taps_back integer,

  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_piece_metrics_piece on public.content_piece_metrics(content_piece_id);
create index if not exists idx_content_piece_metrics_captured on public.content_piece_metrics(content_piece_id, captured_at desc);

alter table public.content_piece_metrics enable row level security;

drop policy if exists "content_piece_metrics_via_client" on public.content_piece_metrics;
create policy "content_piece_metrics_via_client" on public.content_piece_metrics
  for all
  using (exists (
    select 1 from public.content_pieces cp
    join public.clients c on c.id = cp.client_id
    join public.agencies a on a.id = c.agency_id
    where cp.id = content_piece_metrics.content_piece_id and a.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.content_pieces cp
    join public.clients c on c.id = cp.client_id
    join public.agencies a on a.id = c.agency_id
    where cp.id = content_piece_metrics.content_piece_id and a.owner_id = auth.uid()
  ));
alter policy "content_piece_metrics_via_client" on public.content_piece_metrics to authenticated;

drop policy if exists "content_piece_metrics_client_read" on public.content_piece_metrics;
create policy "content_piece_metrics_client_read" on public.content_piece_metrics
  for select
  using (exists (
    select 1 from public.content_pieces cp
    where cp.id = content_piece_metrics.content_piece_id
      and public.is_client_member(cp.client_id)
  ));
alter policy "content_piece_metrics_client_read" on public.content_piece_metrics to authenticated;

drop policy if exists "content_piece_metrics_client_write" on public.content_piece_metrics;
create policy "content_piece_metrics_client_write" on public.content_piece_metrics
  for insert
  with check (exists (
    select 1 from public.content_pieces cp
    where cp.id = content_piece_metrics.content_piece_id
      and public.is_client_editor(cp.client_id)
  ));
alter policy "content_piece_metrics_client_write" on public.content_piece_metrics to authenticated;

drop policy if exists "content_piece_metrics_client_update" on public.content_piece_metrics;
create policy "content_piece_metrics_client_update" on public.content_piece_metrics
  for update
  using (exists (
    select 1 from public.content_pieces cp
    where cp.id = content_piece_metrics.content_piece_id
      and public.is_client_editor(cp.client_id)
  ))
  with check (exists (
    select 1 from public.content_pieces cp
    where cp.id = content_piece_metrics.content_piece_id
      and public.is_client_editor(cp.client_id)
  ));
alter policy "content_piece_metrics_client_update" on public.content_piece_metrics to authenticated;

drop policy if exists "content_piece_metrics_client_delete" on public.content_piece_metrics;
create policy "content_piece_metrics_client_delete" on public.content_piece_metrics
  for delete
  using (exists (
    select 1 from public.content_pieces cp
    where cp.id = content_piece_metrics.content_piece_id
      and public.is_client_editor(cp.client_id)
  ));
alter policy "content_piece_metrics_client_delete" on public.content_piece_metrics to authenticated;

grant select, insert, update, delete on public.content_piece_metrics to authenticated;

-- ── Cruce con Ventas: un lead puede marcar de qué pieza de contenido vino ──
-- Contenido solo CUENTA leads que apuntan a cada pieza — no duplica el dato
-- (la fuente de verdad del lead sigue siendo la tabla `leads`).
alter table public.leads
  add column if not exists origin_content_piece_id uuid references public.content_pieces(id) on delete set null;

create index if not exists idx_leads_origin_content_piece
  on public.leads(origin_content_piece_id)
  where origin_content_piece_id is not null;
