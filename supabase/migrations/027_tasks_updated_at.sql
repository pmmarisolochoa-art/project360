-- 027 — `updated_at` en tasks.
--
-- La tabla `tasks` nunca tuvo `updated_at`, pero `taskToRow()` sí mapea
-- `updatedAt → updated_at`. Resultado: cualquier update que incluyera ese campo
-- moría con `PGRST204: Could not find the 'updated_at' column of 'tasks'` — y
-- como el store solo hacía `console.warn`, la UI mostraba el cambio como
-- guardado y no se guardaba nada. Esta migración cierra ese hueco.
--
-- Usa el mismo patrón que ya tienen `clients` y `projections`: la BD sella la
-- fecha por trigger, el cliente no necesita mandarla.
--
-- Aditiva e idempotente.

alter table public.tasks
  add column if not exists updated_at timestamptz not null default now();

comment on column public.tasks.updated_at is
  'Última modificación. La fija el trigger tasks_touch, no el cliente.';

-- La función public.touch_updated_at() ya existe (schema.sql).
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
