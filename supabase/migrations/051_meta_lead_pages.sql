-- 051 — Mapeo página de Meta → cliente, para el webhook de Meta Lead Ads.
--
-- Founder, 30-sep-2026: "deja la posibilidad para cualquier cliente que
-- llegue". El webhook (`api/meta-leads/webhook.ts`) recibe eventos de
-- CUALQUIER página de Facebook — Meta no manda el client_id, manda el
-- page_id. Esta tabla es el único lugar donde se declara qué página
-- pertenece a qué cliente; el webhook no tiene nada de un cliente
-- específico escrito en código.
--
-- Sin policies de lectura/escritura para authenticated/anon a propósito:
-- guarda el `page_access_token` de Meta, un secreto. Se administra por SQL
-- directo (o desde un panel que se construya después) — el mismo patrón que
-- `api_keys` no tiene policy de INSERT.
--
-- Aditiva e idempotente.

create table if not exists public.meta_lead_pages (
  id                uuid primary key default gen_random_uuid(),
  page_id           text not null unique,
  client_id         uuid not null references public.clients(id) on delete cascade,
  -- Page Access Token de larga duración de esa página de Facebook. Sin él no
  -- se puede pedir el detalle del lead a la Graph API — el webhook de Meta
  -- solo manda el id, nunca los datos del formulario.
  page_access_token text not null,
  activo            boolean not null default true,
  nota              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.meta_lead_pages is
  'Mapeo page_id (Facebook) → client_id (Project360), para el webhook de Meta Lead Ads. Sin policies: acceso solo por service_role.';
comment on column public.meta_lead_pages.page_access_token is
  'Secreto de Meta. Nunca se expone en ninguna API ni pantalla — solo lo lee el webhook con la service key.';

create index if not exists meta_lead_pages_page_idx on public.meta_lead_pages(page_id) where activo;

drop trigger if exists meta_lead_pages_touch on public.meta_lead_pages;
create trigger meta_lead_pages_touch before update on public.meta_lead_pages
  for each row execute function public.touch_updated_at();

alter table public.meta_lead_pages enable row level security;
-- Sin policies: RLS encendido, nadie autenticado puede leer ni escribir.
-- Coherente con `rls_auto_enable()` (11-ago) — una tabla nueva sin policy
-- explícita queda cerrada por defecto, no abierta por accidente.
