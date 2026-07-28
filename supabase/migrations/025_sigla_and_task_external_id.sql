-- 025 — Sigla de cliente (DG/AT) + ID externo de tarea (para integración).
--
-- (1) clients.sigla: identificador corto por cliente (ej. David Guerrero → DG),
--     editable, se muestra como badge en toda la app.
-- (2) tasks.external_id: ID de la tarea en la OTRA plataforma. Deja lista la
--     integración de ida-y-vuelta sin reprocesos: al recibir una tarea, se usa
--     para no duplicar (crear vs actualizar).
--
-- Aditivas e idempotentes: no rompen nada de lo existente.

alter table public.clients
  add column if not exists sigla text;

alter table public.tasks
  add column if not exists external_id text;

comment on column public.clients.sigla is 'Identificador corto del cliente (ej. DG, AT). Se muestra como badge.';
comment on column public.tasks.external_id is 'ID de la tarea en la plataforma externa (integración). Evita duplicados en la sincronización.';

-- Índice para buscar rápido por external_id al sincronizar (no único: puede ser
-- null en las tareas creadas dentro de Project360).
create index if not exists tasks_external_id_idx on public.tasks(external_id) where external_id is not null;
