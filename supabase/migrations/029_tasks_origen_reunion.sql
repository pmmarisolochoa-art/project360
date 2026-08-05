-- 029 — Trazabilidad: de qué reunión salió cada tarea.
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase.
--
-- Permite responder "¿qué se comprometió en la reunión del 15 de junio y en qué
-- quedó?" sin buscar a mano. El vínculo se llena solo al extraer tareas de una
-- reunión: el PM no hace nada extra.
--
-- Se guarda el nombre y la fecha de la reunión ADEMÁS del id (desnormalizado) a
-- propósito: así la tarjeta de la tarea muestra su origen sin tener que cargar
-- la reunión, y el dato sobrevive aunque la reunión se borre.
--
-- OJO — hay dos campos con nombre parecido y NO son lo mismo:
--   · tasks.origin  (jsonb, ya existía) → enlace a un item de ROPRE
--   · tasks.origen  (text, este)        → de dónde nació la tarea
-- Aditivas e idempotentes.

alter table public.tasks
  add column if not exists meeting_id     uuid references public.meetings(id) on delete set null,
  add column if not exists meeting_nombre text,
  add column if not exists meeting_fecha  timestamptz,
  add column if not exists origen         text not null default 'manual';

-- Valores permitidos. Se agrega como NOT VALID para no fallar si alguna fila
-- vieja quedara fuera del set; las filas nuevas sí se validan.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_origen_check'
  ) then
    alter table public.tasks
      add constraint tasks_origen_check
      check (origen in ('manual', 'reunion', 'embudo', 'ia')) not valid;
  end if;
end $$;

comment on column public.tasks.meeting_id     is 'Reunión de la que salió la tarea (null = no vino de una reunión).';
comment on column public.tasks.meeting_nombre is 'Nombre/tipo de la reunión, copiado para mostrarlo sin cargar la reunión.';
comment on column public.tasks.meeting_fecha  is 'Fecha de la reunión de origen.';
comment on column public.tasks.origen         is 'De dónde nació: manual | reunion | embudo | ia.';

-- Para "todas las tareas de esta reunión".
create index if not exists tasks_meeting_id_idx on public.tasks(meeting_id) where meeting_id is not null;
