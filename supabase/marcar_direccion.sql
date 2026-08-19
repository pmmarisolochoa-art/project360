-- Marcar a alguien como DIRECCION (ve todo lo del equipo, no administra).
-- Correr DESPUES de la migracion 040.
-- Sin adornos en los comentarios, para que no se rompa al copiar y pegar.

-- 1. MIRAR quien hay, antes de tocar nada.
select tm.nombre, tm.rol, tm.es_direccion, tm.user_id is not null as tiene_login, c.name as cliente
from public.team_members tm
join public.clients c on c.id = tm.client_id
order by tm.nombre;

-- 2. MARCAR. Solo tiene efecto si esa persona tiene login: sin user_id la
--    funcion es_direccion() nunca la encuentra, porque busca por auth.uid().
update public.team_members
   set es_direccion = true
 where lower(trim(nombre)) in ('lorenzo cadavid', 'juan camilo correa');

-- 3. COMPROBAR. Deben salir los dos, y los dos con tiene_login = true.
select tm.nombre, tm.rol, tm.es_direccion, tm.user_id is not null as tiene_login
from public.team_members tm
where tm.es_direccion
order by tm.nombre;

-- Para quitarle el cargo a alguien:
-- update public.team_members set es_direccion = false
--  where lower(trim(nombre)) = 'nombre completo';
