-- ============================================================================
-- Limpieza de miembros duplicados en team_members
-- ============================================================================
-- Invitar a un miembro insertaba una ficha NUEVA en vez de dar acceso a la que
-- ya existía. Como casi todo el equipo estaba dado de alta con "Agregar
-- persona", cada invitación creaba un gemelo: una tarjeta con los KPIs y otra
-- con el acceso.
--
-- El endpoint ya está arreglado (no volverá a pasar). Esto limpia lo de antes.
--
-- ⚠️ ESTO BORRA FILAS. Corre los pasos EN ORDEN y mira el resultado de cada uno
--    antes de seguir. El paso 3 es el único que borra.
--
-- Es seguro para las tareas: `tasks.assigned_to` guarda el NOMBRE de la
-- persona, no el id de su ficha. Borrar una ficha duplicada no desasigna nada.
--
-- Lo que SÍ importa: la ficha que tiene `user_id` es la que sostiene el login
-- del miembro. Esa nunca se borra.
-- ============================================================================


-- ── PASO 1 · MIRAR: ¿quién está duplicado y qué tiene cada ficha? ───────────
-- Corre esto solo. No cambia nada.

select
  c.name                                        as cliente,
  tm.nombre,
  tm.rol,
  tm.id,
  tm.email,
  tm.user_id is not null                        as tiene_acceso,
  tm.kpis is not null and tm.kpis::text <> '{}' as tiene_kpis,
  tm.created_at
from public.team_members tm
join public.clients c on c.id = tm.client_id
where lower(unaccent_immutable(tm.nombre)) in (
  select lower(unaccent_immutable(nombre))
  from public.team_members
  group by client_id, lower(unaccent_immutable(nombre))
  having count(*) > 1
)
order by cliente, lower(tm.nombre), tm.created_at;

-- Si `unaccent_immutable` no existe en tu base, usa esta versión simple:
--
-- select c.name as cliente, tm.nombre, tm.rol, tm.id, tm.email,
--        tm.user_id is not null as tiene_acceso, tm.created_at
-- from public.team_members tm
-- join public.clients c on c.id = tm.client_id
-- where (tm.client_id, lower(trim(tm.nombre))) in (
--   select client_id, lower(trim(nombre)) from public.team_members
--   group by client_id, lower(trim(nombre)) having count(*) > 1
-- )
-- order by cliente, lower(tm.nombre), tm.created_at;


-- ── PASO 2 · DECIDIR: cuál se queda de cada pareja ──────────────────────────
-- Criterio, en este orden:
--   1. La que tiene `user_id` — sostiene el login de esa persona.
--   2. Si ninguna lo tiene, la MÁS ANTIGUA — es la que lleva su historial.
--
-- Este paso tampoco cambia nada: enseña qué haría el paso 3.

with rankeadas as (
  select
    tm.*,
    row_number() over (
      partition by tm.client_id, lower(trim(tm.nombre))
      order by (tm.user_id is not null) desc, tm.created_at asc
    ) as puesto
  from public.team_members tm
)
select
  c.name as cliente,
  r.nombre,
  r.rol,
  r.id,
  case when r.puesto = 1 then '✅ SE QUEDA' else '🗑️ SE BORRA' end as accion,
  r.user_id is not null as tiene_acceso,
  r.created_at
from rankeadas r
join public.clients c on c.id = r.client_id
where exists (
  select 1 from rankeadas r2
  where r2.client_id = r.client_id
    and lower(trim(r2.nombre)) = lower(trim(r.nombre))
    and r2.puesto > 1
)
order by cliente, lower(r.nombre), r.puesto;

-- 🔴 REVISA ESTA LISTA ANTES DE SEGUIR.
--    Busca dos cosas:
--    a) Alguien marcado "SE BORRA" que tenga KPIs y cuyo gemelo no los tenga.
--       Si aparece, PARA: hay que pasarle los KPIs antes de borrar.
--    b) Dos personas DISTINTAS con el mismo nombre (homónimos reales).
--       Si aparece, PARA: esto las fusionaría.


-- ── PASO 3 · BORRAR ────────────────────────────────────────────────────────
-- Solo después de revisar el paso 2.
-- Va dentro de una transacción: si el conteo no cuadra, haz rollback.

begin;

with rankeadas as (
  select
    tm.id,
    row_number() over (
      partition by tm.client_id, lower(trim(tm.nombre))
      order by (tm.user_id is not null) desc, tm.created_at asc
    ) as puesto
  from public.team_members tm
)
delete from public.team_members
where id in (select id from rankeadas where puesto > 1);

-- Comprueba: no debe quedar ningún nombre repetido por cliente.
select client_id, lower(trim(nombre)) as nombre, count(*)
from public.team_members
group by client_id, lower(trim(nombre))
having count(*) > 1;
-- ↑ Debe devolver 0 filas.

-- Si todo cuadra:
commit;
-- Si algo no cuadra:
-- rollback;
