-- 031 — Links y Entregables: trazabilidad completa y alta manual.
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase.
--
-- POR QUÉ
-- La tarea es la fuente de verdad de los entregables. Un link subido en una
-- tarea NO se copia a otras tablas: es UNA sola fila en `task_links`, vista
-- desde tres lugares (la tarea, el espacio del miembro, y /links-entregables).
-- Copiarla habría hecho que las tres vistas se desincronizaran.
--
-- Esto además arregla un problema real: el repositorio de Links y Entregables
-- vivía SOLO en memoria (useRepositoryStore), así que lo que se agregaba ahí
-- desaparecía al recargar la página. Ahora persiste.
--
-- QUÉ AGREGA
--   · fuente     — 'tarea' (lo subió el equipo) vs 'manual' (lo agregó el PM)
--   · estado     — flujo de aprobación del PM
--   · meeting_id — de qué reunión venía la tarea (trazabilidad 7D)
--   · task_id pasa a admitir NULL, para los links manuales que no nacen de una tarea
--
-- Aditiva e idempotente.

alter table public.task_links
  add column if not exists fuente     text not null default 'tarea',
  add column if not exists estado     text not null default 'pendiente',
  add column if not exists meeting_id uuid references public.meetings(id) on delete set null,
  add column if not exists notas      text,
  -- Nombre visible de quien subió el link, copiado al insertar. `created_by` es
  -- un auth user id y la app no tiene cargado el mapeo id→nombre; guardarlo
  -- aquí evita una consulta extra y sobrevive si la persona sale del equipo.
  add column if not exists created_by_nombre text;

-- Los links manuales no cuelgan de ninguna tarea.
alter table public.task_links alter column task_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_links_fuente_check') then
    alter table public.task_links add constraint task_links_fuente_check
      check (fuente in ('tarea', 'manual')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_links_estado_check') then
    alter table public.task_links add constraint task_links_estado_check
      check (estado in ('pendiente', 'aprobado', 'correcciones')) not valid;
  end if;
end $$;

comment on column public.task_links.fuente     is 'tarea = lo subió el equipo desde una tarea; manual = lo agregó el PM a mano.';
comment on column public.task_links.estado     is 'Revisión del PM: pendiente | aprobado | correcciones.';
comment on column public.task_links.meeting_id is 'Reunión de la que venía la tarea que originó este entregable.';
comment on column public.task_links.created_by_nombre is 'Nombre visible de quien lo subió (copiado al insertar).';

create index if not exists idx_task_links_meeting on public.task_links (meeting_id) where meeting_id is not null;
create index if not exists idx_task_links_estado  on public.task_links (estado);

-- ── Permiso de ACTUALIZAR (nuevo) ────────────────────────────────────────────
-- La 019 solo daba insert/delete. El PM necesita poder aprobar o pedir
-- correcciones, y eso es un update. Solo el owner de la agencia.
drop policy if exists "task_links_update" on public.task_links;
create policy "task_links_update" on public.task_links
  for update
  using (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = task_links.client_id and a.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      join public.agencies a on a.id = c.agency_id
      where c.id = task_links.client_id and a.owner_id = auth.uid()
    )
  );

-- ── Verificación (correr aparte) ─────────────────────────────────────────────
--   select id, nombre, fuente, estado, task_id, meeting_id from public.task_links limit 10;
