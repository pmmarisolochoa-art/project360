-- LIMPIEZA DE MIEMBROS DUPLICADOS - VERSION DE UN SOLO BLOQUE
-- Copia TODO este archivo de una vez y ejecutalo.
-- Es seguro correrlo dos veces: si ya no hay duplicados, no hace nada.
-- Sin caracteres raros en los comentarios, para que no se rompa al copiar.

begin;

with rankeadas as (
  select tm.*,
         row_number() over (
           partition by tm.client_id, lower(trim(tm.nombre))
           order by (tm.user_id is not null) desc, tm.created_at asc
         ) as puesto
  from public.team_members tm
),
que_se_queda as (select * from rankeadas where puesto = 1),
que_se_va    as (select * from rankeadas where puesto > 1)
update public.team_members t
set kpis_custom = jsonb_build_object(
      'values',  coalesce(s.kpis_custom->'values','{}'::jsonb) || coalesce(t.kpis_custom->'values','{}'::jsonb),
      'history', coalesce(s.kpis_custom->'history','{}'::jsonb) || coalesce(t.kpis_custom->'history','{}'::jsonb),
      'targets', coalesce(s.kpis_custom->'targets','{}'::jsonb) || coalesce(t.kpis_custom->'targets','{}'::jsonb),
      'custom',  coalesce(t.kpis_custom->'custom','[]'::jsonb)  || coalesce(s.kpis_custom->'custom','[]'::jsonb)
    ),
    funciones = case
                  when jsonb_typeof(coalesce(t.funciones,'[]'::jsonb)) <> 'array'
                       or jsonb_array_length(coalesce(t.funciones,'[]'::jsonb)) = 0
                  then s.funciones else t.funciones
                end,
    email      = coalesce(t.email, s.email),
    telefono   = coalesce(t.telefono, s.telefono),
    created_at = least(t.created_at, s.created_at)
from que_se_va s
where t.id = (select v.id from que_se_queda v
              where v.client_id = s.client_id
                and lower(trim(v.nombre)) = lower(trim(s.nombre)));

with rankeadas as (
  select tm.id,
         row_number() over (
           partition by tm.client_id, lower(trim(tm.nombre))
           order by (tm.user_id is not null) desc, tm.created_at asc
         ) as puesto
  from public.team_members tm
)
delete from public.team_members
where id in (select id from rankeadas where puesto > 1);

update public.team_members
   set rol = 'community'
 where lower(trim(nombre)) in ('sofia','sofía');

update public.team_members
   set rol = 'strategist',
       funciones = coalesce(funciones,'[]'::jsonb) || jsonb_build_array(
         'Redaccion de copies para anuncios y organico',
         'Guiones de video y VSL',
         'Titulares y angulos de venta'
       )
 where lower(trim(nombre)) = 'jhonatan rengifo'
   and not (coalesce(funciones,'[]'::jsonb) @> jsonb_build_array('Guiones de video y VSL'));

select client_id, lower(trim(nombre)) as nombre, count(*) as fichas
from public.team_members
group by client_id, lower(trim(nombre))
having count(*) > 1;

commit;
