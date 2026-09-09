-- 044 · Normalizar los responsables ya guardados
--
-- GENERADO por pruebas/generar_migracion_responsables.mjs desde
-- src/config/aliasPersonas.json. NO editar a mano: cambia el JSON y regenera,
-- o el código y los datos empezarán a decir cosas distintas.
--
-- QUÉ ARREGLA. El filtro de personas mostraba a la misma persona hasta con tres
-- etiquetas: "Cisco" y "Francisco Otalvaro", "Jona" / "Jhonatan" / "Jonathan",
-- "Lucho" / "Luisa" / "Luis David Flores". Los alias ya se aplicaban al
-- IMPORTAR de Paralelo, pero solo a lo que entraba de ahí en adelante: todo lo
-- traído antes se quedó con el nombre crudo de la transcripción.
--
-- QUÉ NO TOCA, por decisión explícita de la founder (9-sep-2026):
--   · "David" a secas — hay David Castaño en el equipo y David Guerrero como
--     cliente; elegir uno sería una moneda al aire.
--   · "Tony" — es Tony, no es ninguno de los dos Antonios.
--   · "Antonio Vital" — persona distinta de Antonio Espitia.
-- Están escritos aquí para que nadie los "arregle" luego creyendo que se
-- olvidaron.
--
-- ANTES DE CORRER: la sección 1 hace un RESPALDO. No la saltes. Es una tabla
-- normal, así que revertir es un UPDATE ... FROM contra ella.
--
-- Es idempotente: a la segunda corrida ya no queda ningún alias que coincida.
--
-- VERIFICADA el 9-sep-2026 contra una copia local del esquema real de
-- producción, CON FILAS (pruebas/probar_044_con_datos.sh) y no solo contra el
-- esquema vacío — aquí lo que puede fallar es la lógica, no la sintaxis.
-- Resultado con los 31 nombres reales del desplegable:
--   · 31 nombres distintos → 17
--   · Cisco, "  cisco  " y Francisco Otalvaro → una sola entrada
--   · Toño y TOÑO → Antonio Espitia (la ñ y las mayúsculas no estorban)
--   · Jona / Jonathan / Jhonatan → Jhonatan Rengifo
--   · Speaker A, Speaker D, Hablante 2 y los 4 grupos → Marisol Ochoa
--   · David, Tony, Antonio Vital, David Castaño y David Guerrero: intactos
--   · el jsonb dentro de la reunión reescrito; una reunión con [] no se rompe
--   · respaldo con las 31 tareas y los 3 ítems de ROPRE
--   · segunda pasada: cero cambios

begin;

-- ── 1 · Respaldo, para poder deshacer ────────────────────────────────────────
create table if not exists public.respaldo_responsables_044 as
  select 'tasks'::text as tabla, id, assigned_to as valor from public.tasks
  union all
  select 'ropre_items'::text, id, responsible from public.ropre_items where responsible is not null;

-- ── 2 · La tabla de equivalencias ────────────────────────────────────────────
-- Las claves se comparan en minúsculas y sin acentos: unaccent() no está
-- garantizado en todas las instancias, así que se normaliza con translate(),
-- que solo necesita las vocales acentuadas y la ñ que aparecen en estos datos.
create or replace function pg_temp.norm(txt text) returns text as $$
  select translate(lower(trim(coalesce(txt, ''))),
                   'áàäâãéèëêíìïîóòöôõúùüûñç',
                   'aaaaaeeeeiiiiooooouuuunc');
$$ language sql immutable;

create temporary table alias_personas (apodo text primary key, persona text not null) on commit drop;
insert into alias_personas (apodo, persona) values
    ('cisco', 'Francisco Otalvaro'),
    ('jona', 'Jhonatan Rengifo'),
    ('jhonatan', 'Jhonatan Rengifo'),
    ('jonathan', 'Jhonatan Rengifo'),
    ('juanca', 'Juan Camilo Correa'),
    ('loro', 'Lorenzo Cadavid'),
    ('lucho', 'Luis David Flores'),
    ('luisa', 'Luis David Flores'),
    ('teo', 'Luis David Flores'),
    ('robert', 'Roberto Maestre'),
    ('santi', 'Santiago Ruiz'),
    ('sophie', 'Sofía Vasquez'),
    ('tati', 'Tatiana Echeverri Gomez'),
    ('tono', 'Antonio Espitia'),
    ('andrea', 'Andrea Torres'),
    ('bala', 'David Castaño'),
    ('balita', 'David Castaño'),
    ('david f', 'David Castaño'),
    ('cami', 'Camilo Beltrán'),
    ('camilo', 'Camilo Beltrán'),
    ('mari cruz', 'Marisol Ochoa'),
    ('mari', 'Marisol Ochoa'),
    ('equipo', 'Marisol Ochoa'),
    ('equipo de contenido', 'Marisol Ochoa'),
    ('equipo de marketing', 'Marisol Ochoa'),
    ('el grupo', 'Marisol Ochoa');

-- ── 3 · Tareas ───────────────────────────────────────────────────────────────
update public.tasks t
   set assigned_to = a.persona
  from alias_personas a
 where pg_temp.norm(t.assigned_to) = a.apodo
   and t.assigned_to <> a.persona;

-- Etiquetas de diarización ("Speaker A", "Hablante 2"): no son nombres, son el
-- orden en que el audio oyó las voces, y ese orden se reparte de nuevo en CADA
-- reunión. No se pueden mapear a una persona concreta sin mentir, así que van a
-- quien reparte el trabajo.
update public.tasks
   set assigned_to = 'Marisol Ochoa'
 where pg_temp.norm(assigned_to) ~ '^(speaker|hablante|participante)[[:space:]]*[a-z0-9]{1,2}$'
   and assigned_to <> 'Marisol Ochoa';

-- Sin responsable: misma regla — a la bandeja de quien reparte.
update public.tasks
   set assigned_to = 'Marisol Ochoa'
 where trim(coalesce(assigned_to, '')) = '';

-- ── 4 · Entregables del ROPRE ────────────────────────────────────────────────
update public.ropre_items r
   set responsible = a.persona
  from alias_personas a
 where pg_temp.norm(r.responsible) = a.apodo
   and r.responsible <> a.persona;

update public.ropre_items
   set responsible = 'Marisol Ochoa'
 where pg_temp.norm(responsible) ~ '^(speaker|hablante|participante)[[:space:]]*[a-z0-9]{1,2}$'
   and responsible <> 'Marisol Ochoa';

-- ── 5 · Las tareas extraídas que viven DENTRO de cada reunión ────────────────
-- meetings.extracted_tasks es un jsonb con el responsable en 'responsibleRole'.
-- Hay que tocarlo o el nombre viejo reaparece: la reunión lo vuelve a mostrar
-- desde ahí, y confirmar sus tareas otra vez lo volvería a escribir.
update public.meetings m
   set extracted_tasks = sub.nuevo
  from (
    select m2.id,
           jsonb_agg(
             case
               when a.persona is not null then jsonb_set(tarea, '{responsibleRole}', to_jsonb(a.persona))
               when pg_temp.norm(tarea->>'responsibleRole') ~ '^(speaker|hablante|participante)[[:space:]]*[a-z0-9]{1,2}$'
                 then jsonb_set(tarea, '{responsibleRole}', to_jsonb('Marisol Ochoa'::text))
               else tarea
             end
             order by orden
           ) as nuevo
      from public.meetings m2
      cross join lateral jsonb_array_elements(m2.extracted_tasks) with ordinality as e(tarea, orden)
      left join alias_personas a on a.apodo = pg_temp.norm(e.tarea->>'responsibleRole')
     where jsonb_typeof(m2.extracted_tasks) = 'array'
       and jsonb_array_length(m2.extracted_tasks) > 0
     group by m2.id
  ) sub
 where m.id = sub.id
   and m.extracted_tasks is distinct from sub.nuevo;

commit;

-- ── 6 · Comprobar ────────────────────────────────────────────────────────────
-- Corre esto DESPUÉS. La primera consulta debe salir vacía; la segunda es la
-- lista que verás en el filtro de personas.
--
--   select assigned_to, count(*) from public.tasks
--    where lower(assigned_to) in ('cisco', 'jona', 'jhonatan', 'jonathan', 'juanca', 'loro', 'lucho', 'luisa', 'teo', 'robert', 'santi', 'sophie', 'tati', 'tono', 'andrea', 'bala', 'balita', 'david f', 'cami', 'camilo', 'mari cruz', 'mari', 'equipo', 'equipo de contenido', 'equipo de marketing', 'el grupo')
--       or assigned_to ~* '^(speaker|hablante|participante)'
--    group by 1;
--
--   select assigned_to, count(*) from public.tasks group by 1 order by 1;
--
-- Para DESHACER todo:
--   update public.tasks t set assigned_to = r.valor
--     from public.respaldo_responsables_044 r
--    where r.tabla = 'tasks' and r.id = t.id and t.assigned_to <> r.valor;
--   update public.ropre_items i set responsible = r.valor
--     from public.respaldo_responsables_044 r
--    where r.tabla = 'ropre_items' and r.id = i.id;
--   (extracted_tasks no se respalda: se regenera reimportando la reunión.)
