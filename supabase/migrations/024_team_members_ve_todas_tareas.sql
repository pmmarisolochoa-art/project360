-- 024 — Coordinador: ve todas las tareas del equipo.
--
-- Un miembro normal solo ve SUS tareas. Con este flag activado, ese miembro
-- ve TODAS las tareas del cliente (como el owner) — para roles de coordinación
-- (ej. Líder Operativo/PM). Se activa por persona desde el módulo Equipo.
--
-- Idempotente.

alter table public.team_members
  add column if not exists ve_todas_tareas boolean not null default false;

comment on column public.team_members.ve_todas_tareas is
  'Si true, este miembro ve TODAS las tareas del cliente (coordinador), no solo las suyas.';
