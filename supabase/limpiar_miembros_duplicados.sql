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
--    Lo único que hay que mirar a mano: que no haya dos personas DISTINTAS con
--    el mismo nombre (homónimos reales). Si las hay, PARA — esto las fusionaría
--    y una acabaría con el acceso de la otra.
--
--    Confirmado por la founder el 19-ago: Jhonatan Rengifo es UNA persona y
--    Sofía es UNA persona, aunque aparezcan con dos roles cada uno. Antonio
--    Espitia y Antonio Vital son DOS personas distintas — no comparten nombre,
--    así que el script no las toca.
--
--    De los KPIs no hace falta que te preocupes: el paso 3 los arrastra solo.


-- ── PASO 3 · FUSIONAR Y BORRAR ─────────────────────────────────────────────
-- Solo después de revisar el paso 2.
-- Va dentro de una transacción: si el conteo no cuadra, haz rollback.
--
-- Primero se ARRASTRA lo que tenga la ficha que se va y le falte a la que se
-- queda. Es lo que hace segura la limpieza: Santiago Ruiz tiene el 100% de sus
-- KPIs en una tarjeta y el acceso en la otra, así que borrar sin fusionar le
-- perdería el historial.

begin;

with rankeadas as (
  select
    tm.*,
    row_number() over (
      partition by tm.client_id, lower(trim(tm.nombre))
      order by (tm.user_id is not null) desc, tm.created_at asc
    ) as puesto
  from public.team_members tm
),
survivientes as (select * from rankeadas where puesto = 1),
sobrantes as (select * from rankeadas where puesto > 1)
update public.team_members t
set
  -- KPIs: se queda con los que tengan contenido.
  kpis = case
           when (t.kpis is null or t.kpis::text = '{}') and s.kpis is not null then s.kpis
           else t.kpis
         end,
  email      = coalesce(t.email, s.email),
  telefono   = coalesce(t.telefono, s.telefono),
  -- La fecha de alta real es la más antigua de las dos: es cuando esa persona
  -- entró al equipo, no cuando se creó la ficha que sobrevivió.
  created_at = least(t.created_at, s.created_at),
  funciones  = case
                 when t.funciones is null or jsonb_array_length(to_jsonb(t.funciones)) = 0
                   then s.funciones
                 else t.funciones
               end
from sobrantes s
where t.id = (select id from survivientes v
              where v.client_id = s.client_id
                and lower(trim(v.nombre)) = lower(trim(s.nombre)));

-- Ahora sí, fuera las sobrantes.
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

-- ── PASO 4 · EL ROL DE LOS QUE TENÍAN DOS ──────────────────────────────────
-- Al fusionar, el rol que sobrevive es el de la ficha que se quedó: azar.
-- Aquí se fija a mano lo que dijo la founder el 19-ago.

-- Sofía → Content Manager.
update public.team_members
   set rol = 'community'
 where lower(trim(nombre)) like 'sof%a';

-- Jhonatan Rengifo → HACE LAS DOS COSAS: estratega y copywriter.
--
-- ⚠️ La tabla solo admite UN rol por persona, así que esto es un apaño:
--    queda como estratega (el rol más amplio de los dos) y se le añaden las
--    funciones de copywriter a su lista, para que no se pierda que también
--    escribe. Sus KPIs serán los de estratega.
--
--    El arreglo de verdad es admitir varios roles por persona. Está anotado
--    como hallazgo; esto lo deja usable mientras tanto.
update public.team_members
   set rol = 'strategist',
       funciones = (
         select array_agg(distinct f)
         from unnest(
           coalesce(funciones, array[]::text[]) ||
           array[
             'Redacción de copies para anuncios y orgánico',
             'Guiones de video y VSL',
             'Titulares y ángulos de venta'
           ]
         ) as f
       )
 where lower(trim(nombre)) = 'jhonatan rengifo';


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
