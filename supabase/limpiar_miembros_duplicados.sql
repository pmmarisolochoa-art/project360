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
-- ⚠️ EL PASO 3 BORRA FILAS. Corre los pasos EN ORDEN y mira cada resultado.
--
-- Columnas REALES de la tabla (migración 013 + 018/021/023/024). Se listan aquí
-- porque la primera versión de este script se las inventó y falló contra la
-- base: no existe `kpis`, es `kpis_custom`; y `funciones` es jsonb, no text[].
--   id · client_id · nombre · rol · email · telefono · avatar_color
--   funciones (jsonb) · kpis_custom (jsonb) · departamentos · access_level
--   user_id · ve_todas_tareas · created_at
--
-- Seguro para las tareas: `tasks.assigned_to` guarda el NOMBRE, no el id de la
-- ficha. Borrar una ficha duplicada no desasigna nada.
--
-- La ficha con `user_id` sostiene el login del miembro: esa nunca se borra.
-- ============================================================================


-- ── PASO 1 · MIRAR ─────────────────────────────────────────────────────────
-- No cambia nada. Enseña quién está duplicado y qué tiene cada ficha.

select
  c.name                                                as cliente,
  tm.nombre,
  tm.rol,
  tm.email,
  tm.user_id is not null                                as tiene_acceso,
  coalesce(tm.kpis_custom, '{}'::jsonb) <> '{}'::jsonb  as tiene_kpis,
  tm.created_at,
  tm.id
from public.team_members tm
join public.clients c on c.id = tm.client_id
where (tm.client_id, lower(trim(tm.nombre))) in (
  select client_id, lower(trim(nombre))
  from public.team_members
  group by client_id, lower(trim(nombre))
  having count(*) > 1
)
order by cliente, lower(trim(tm.nombre)), tm.created_at;


-- ── PASO 2 · DECIDIR ───────────────────────────────────────────────────────
-- Tampoco cambia nada. Enseña qué haría el paso 3.
-- Criterio: se queda la que tiene `user_id`; si ninguna, la más antigua.

with rankeadas as (
  select
    tm.id, tm.client_id, tm.nombre, tm.rol, tm.user_id, tm.created_at,
    coalesce(tm.kpis_custom, '{}'::jsonb) <> '{}'::jsonb as tiene_kpis,
    row_number() over (
      partition by tm.client_id, lower(trim(tm.nombre))
      order by (tm.user_id is not null) desc, tm.created_at asc
    ) as puesto,
    count(*) over (partition by tm.client_id, lower(trim(tm.nombre))) as cuantas
  from public.team_members tm
)
select
  c.name as cliente,
  r.nombre,
  r.rol,
  case when r.puesto = 1 then 'SE QUEDA' else 'SE BORRA' end as accion,
  r.user_id is not null as tiene_acceso,
  r.tiene_kpis,
  r.created_at,
  r.id
from rankeadas r
join public.clients c on c.id = r.client_id
where r.cuantas > 1
order by cliente, lower(trim(r.nombre)), r.puesto;

-- 🔴 LO ÚNICO QUE HAY QUE MIRAR: que no haya dos personas DISTINTAS con el
--    mismo nombre. Si las hay, PARA — se fusionarían y una acabaría con el
--    acceso de la otra.
--
--    Confirmado por la founder (19-ago): Jhonatan Rengifo es UNA persona y
--    Sofía es UNA persona, aunque salgan con dos roles cada uno. Antonio
--    Espitia y Antonio Vital son DOS personas: nombres distintos, no se tocan.
--
--    De los KPIs no te preocupes: el paso 3 los arrastra.


-- ── PASO 3 · FUSIONAR Y BORRAR ─────────────────────────────────────────────
-- Primero se arrastra a la ficha que se queda lo que tenga la otra y a ella le
-- falte. Es lo que hace segura la limpieza: hay gente con los KPIs en una
-- tarjeta y el acceso en la otra, y borrar sin fusionar les perdería el
-- historial.

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
que_se_queda as (select * from rankeadas where puesto = 1),
que_se_va    as (select * from rankeadas where puesto > 1)
update public.team_members t
set
  -- KPIs: se MEZCLAN los dos, no se elige uno.
  --
  -- Importa de verdad: en las 6 parejas reales la ficha que se borra es la que
  -- tiene los KPIs. Y en Jhonatan y Sofía las DOS los tienen —uno por cada
  -- rol—, así que quedarse con una tiraría medio historial.
  --
  -- La mezcla es por sub-objeto (`values`, `history`, `targets`, `custom`) y no
  -- a nivel raíz: `a || b` en jsonb pisa la clave entera, así que un `||` suelto
  -- borraría todos los `values` de una de las dos. Como cada rol usa claves de
  -- KPI distintas, mezclar por dentro los conserva todos.
  --
  -- Ante el mismo KPI en ambas fichas gana el de la que se queda: es la que
  -- tiene el acceso y, por tanto, la que la persona ha estado usando.
  kpis_custom = jsonb_build_object(
    'values',  coalesce(s.kpis_custom->'values',  '{}'::jsonb)
             || coalesce(t.kpis_custom->'values',  '{}'::jsonb),
    'history', coalesce(s.kpis_custom->'history', '{}'::jsonb)
             || coalesce(t.kpis_custom->'history', '{}'::jsonb),
    'targets', coalesce(s.kpis_custom->'targets', '{}'::jsonb)
             || coalesce(t.kpis_custom->'targets', '{}'::jsonb),
    'custom',  coalesce(t.kpis_custom->'custom',  '[]'::jsonb)
             || coalesce(s.kpis_custom->'custom',  '[]'::jsonb)
  ),
  funciones   = case
                  when jsonb_typeof(coalesce(t.funciones, '[]'::jsonb)) <> 'array'
                       or jsonb_array_length(coalesce(t.funciones, '[]'::jsonb)) = 0
                    then s.funciones
                  else t.funciones
                end,
  email       = coalesce(t.email, s.email),
  telefono    = coalesce(t.telefono, s.telefono),
  -- La fecha de alta real es la más antigua: es cuando esa persona entró al
  -- equipo, no cuando se creó la ficha que sobrevivió.
  created_at  = least(t.created_at, s.created_at)
from que_se_va s
where t.id = (
  select v.id from que_se_queda v
  where v.client_id = s.client_id
    and lower(trim(v.nombre)) = lower(trim(s.nombre))
);

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
-- Aquí se fija lo que dijo la founder (19-ago).

-- Sofía → Content Manager.
update public.team_members
   set rol = 'community'
 where lower(trim(nombre)) in ('sofía', 'sofia');

-- Jhonatan Rengifo → hace las DOS cosas: estratega y copywriter.
--
-- ⚠️ APAÑO CONSCIENTE. La tabla admite un solo rol por persona, así que queda
--    como estratega y se le añaden las funciones de copywriter a su lista para
--    que no se pierda que también escribe. Sus KPIs serán los de estratega.
--    El arreglo de verdad (rol principal + roles adicionales) está anotado como
--    hallazgo en el informe de auditoría.
update public.team_members
   set rol = 'strategist',
       funciones = coalesce(funciones, '[]'::jsonb) || jsonb_build_array(
         'Redacción de copies para anuncios y orgánico',
         'Guiones de video y VSL',
         'Titulares y ángulos de venta'
       )
 where lower(trim(nombre)) = 'jhonatan rengifo';


-- ── COMPROBAR ANTES DE CONFIRMAR ───────────────────────────────────────────
-- No debe quedar ningún nombre repetido dentro del mismo cliente.
select client_id, lower(trim(nombre)) as nombre, count(*)
from public.team_members
group by client_id, lower(trim(nombre))
having count(*) > 1;
-- ↑ Debe devolver 0 filas.

-- Si devuelve 0 filas:
commit;
-- Si devuelve algo:
-- rollback;
