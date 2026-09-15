-- 046 · Espacio interno propio: Ikigai pasa a ser cliente
--
-- ⚠️ TOCA DATOS DE PRODUCCIÓN. Lee la sección 0 y córrela ANTES que el resto.
--
-- CONTEXTO (founder, 14-sep-2026)
-- `clients.is_agency` hace DOS trabajos a la vez: marca "este es mi espacio
-- interno" (donde viven las tareas personales) y "no lo muestres en la lista de
-- clientes". Mientras Ikigai era la agencia que operaba, las dos cosas
-- coincidían. Desde que la app volvió a ser Project360 (26-ago) ya no: Ikigai
-- es un cliente como Andrea, y la agencia es la de la founder.
--
-- Además, David Guerrero quedó marcado por error y eso lo sacó de la rejilla.
--
-- QUÉ HACE
--   (1) Crea un espacio interno NUEVO y vacío, propio de la agencia.
--   (2) Mueve a ese espacio las tareas PERSONALES que vivían en Ikigai
--       (es_privada = true: es donde las escribe "🔒 Personal" de Mi Espacio).
--   (3) Quita la bandera de agencia a Ikigai Agencia y a David Guerrero.
--
-- QUÉ NO HACE, a propósito:
--   · NO mueve las reuniones de Ikigai. Sus dailies son de Ikigai, que ahora es
--     un cliente; pasan a contar como reuniones de cliente, que es lo correcto.
--     Para que sigan usando la plantilla de Daily está `CLIENTES_CON_DAILY` en
--     src/config/reporteDaily.ts — sin eso caerían al reporte genérico y
--     saldría el PDF en blanco del 20-ago.
--   · NO toca las tareas privadas de David Guerrero. Una tarea privada en un
--     cliente normal es legítima, y no hay forma de saber desde aquí si la
--     escribió "Personal" mientras estuvo mal marcado o si es suya de verdad.
--     La sección 0 te dice cuántas son para que las mires tú.
--
-- Idempotente: se puede correr dos veces.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0 · MIRA ESTO ANTES. No cambia nada; solo te dice qué se va a mover.
-- ─────────────────────────────────────────────────────────────────────────────
--   select c.name, c.is_agency,
--          count(*) filter (where t.es_privada)      as privadas,
--          count(*) filter (where not t.es_privada)  as normales
--     from public.clients c
--     left join public.tasks t on t.client_id = c.id
--    where c.is_agency
--    group by c.name, c.is_agency;
--
-- Las "privadas" de Ikigai Agencia son las que se mueven. Si el número te
-- sorprende, para y revísalas antes de seguir:
--   select t.title, t.assigned_to, t.created_at
--     from public.tasks t join public.clients c on c.id = t.client_id
--    where c.name = 'Ikigai Agencia' and t.es_privada;

begin;

-- ── 1 · Respaldo ─────────────────────────────────────────────────────────────
-- Va ANTES de crear el espacio nuevo: si fuera después se guardaría también a
-- sí mismo, y deshacer lo dejaría marcado como agencia.
create table if not exists public.respaldo_espacio_interno_046 as
  select 'task'::text as tipo, t.id, t.client_id::text as valor
    from public.tasks t
    join public.clients c on c.id = t.client_id
   where c.name = 'Ikigai Agencia' and t.es_privada
  union all
  select 'client_is_agency'::text, c.id, c.is_agency::text
    from public.clients c
   where c.is_agency;

-- ── 2 · El espacio interno nuevo ─────────────────────────────────────────────
-- Hereda la agencia de los clientes que ya existen en vez de fijar un uuid a
-- mano: un id equivocado lo colgaría de otra agencia y no lo vería nadie.
-- Se llama "Project360" para que el botón de la lista diga "Espacio de
-- Project360". Renombrarlo después es un campo en su Perfil.
insert into public.clients
  (agency_id, name, sigla, is_agency, industry, business_type,
   primary_color, status, project_type)
select c.agency_id, 'Project360', 'P3', true, 'Marketing', 'Agencia',
       '#6366F1', 'active', 'other'
  from public.clients c
 where c.name = 'Ikigai Agencia'
   -- `on conflict do nothing` NO sirve aquí: no hay restricción única en
   -- `name`, así que no detecta nada y crea un segundo espacio en cada corrida.
   -- Lo cazó la prueba con datos, en la segunda pasada.
   and not exists (
     select 1 from public.clients where name = 'Project360' and is_agency
   )
 limit 1;

-- Guard: si por lo que sea no se creó, no sigas. Mover tareas personales a
-- ninguna parte las perdería de vista.
do $$
begin
  if not exists (select 1 from public.clients where name = 'Project360' and is_agency) then
    raise exception 'No se creó el espacio interno. ¿Existe el cliente "Ikigai Agencia"?';
  end if;
end $$;

-- ── 3 · Las tareas personales se mudan al espacio interno ────────────────────
update public.tasks t
   set client_id = (select id from public.clients where name = 'Project360' and is_agency limit 1)
  from public.clients c
 where c.id = t.client_id
   and c.name = 'Ikigai Agencia'
   and t.es_privada;

-- ── 4 · Ikigai y David Guerrero dejan de ser espacio de agencia ──────────────
update public.clients
   set is_agency = false
 where is_agency
   and name in ('Ikigai Agencia', 'David Guerrero');

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 · COMPROBAR (correr aparte, después del commit)
-- ─────────────────────────────────────────────────────────────────────────────
-- Debe haber UN solo espacio de agencia (Project360) y los demás visibles:
--   select name, sigla, is_agency, status from public.clients order by is_agency desc, name;
--
-- Y la opción "🔒 Personal" de Mi Espacio tiene que volver a resolver:
--   select public.mi_espacio_personal();   -- no puede devolver null
--
-- PARA DESHACER:
--   update public.tasks t set client_id = r.valor::uuid
--     from public.respaldo_espacio_interno_046 r
--    where r.tipo = 'task' and r.id = t.id;
--   update public.clients c set is_agency = r.valor::boolean
--     from public.respaldo_espacio_interno_046 r
--    where r.tipo = 'client_is_agency' and r.id = c.id;
--   delete from public.clients where name = 'Project360' and is_agency;
