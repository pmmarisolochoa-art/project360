-- Comprobar en qué estado quedó la limpieza. No cambia nada.
select
  c.name as cliente,
  tm.nombre,
  tm.rol,
  tm.user_id is not null as acceso,
  tm.kpis_custom->'values' as kpis,
  tm.created_at::date as alta,
  count(*) over (partition by tm.client_id, lower(trim(tm.nombre))) as fichas
from public.team_members tm
join public.clients c on c.id = tm.client_id
order by fichas desc, cliente, lower(trim(tm.nombre));
