/**
 * Genera la migración que normaliza los responsables YA GUARDADOS.
 *
 * La tabla de alias NO se escribe aquí: se lee de src/config/aliasPersonas.json,
 * el mismo archivo que usa la app para las importaciones nuevas. Así no hay dos
 * listas que puedan divergir — que es el fallo de los dos traductores del
 * 11-ago y el motivo por el que el diccionario del export sale de la misma
 * definición que los datos.
 *
 *   node pruebas/generar_migracion_responsables.mjs
 *
 * La migración resultante es IDEMPOTENTE: correrla dos veces no cambia nada la
 * segunda vez, porque después de la primera ya no queda ningún alias que
 * coincida.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const TABLA = JSON.parse(readFileSync(new URL('../src/config/aliasPersonas.json', import.meta.url), 'utf8'));
const SALIDA = new URL('../supabase/migrations/044_normalizar_responsables.sql', import.meta.url);

const alias = TABLA.alias;
const desconocido = TABLA._desconocido;
const pares = Object.entries(alias);

// Las claves ya vienen en minúsculas y sin acentos (es la regla del JSON).
// Se comprueba aquí en vez de confiar: una clave con mayúscula no casaría nunca
// y el fallo sería silencioso — la fila simplemente no se actualizaría.
for (const [k] of pares) {
  const norm = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (k !== norm) throw new Error(`La clave "${k}" tiene mayúsculas o acentos. Debe ser "${norm}".`);
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const valores = pares.map(([k, v]) => `    (${q(k)}, ${q(v)})`).join(',\n');

const sql = `-- 044 · Normalizar los responsables ya guardados
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
${valores};

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
   set assigned_to = ${q(desconocido)}
 where pg_temp.norm(assigned_to) ~ '^(speaker|hablante|participante)[[:space:]]*[a-z0-9]{1,2}$'
   and assigned_to <> ${q(desconocido)};

-- Sin responsable: misma regla — a la bandeja de quien reparte.
update public.tasks
   set assigned_to = ${q(desconocido)}
 where trim(coalesce(assigned_to, '')) = '';

-- ── 4 · Entregables del ROPRE ────────────────────────────────────────────────
update public.ropre_items r
   set responsible = a.persona
  from alias_personas a
 where pg_temp.norm(r.responsible) = a.apodo
   and r.responsible <> a.persona;

update public.ropre_items
   set responsible = ${q(desconocido)}
 where pg_temp.norm(responsible) ~ '^(speaker|hablante|participante)[[:space:]]*[a-z0-9]{1,2}$'
   and responsible <> ${q(desconocido)};

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
                 then jsonb_set(tarea, '{responsibleRole}', to_jsonb(${q(desconocido)}::text))
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
--    where lower(assigned_to) in (${pares.map(([k]) => q(k)).join(', ')})
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
`;

writeFileSync(SALIDA, sql);
console.log(`✅ ${pares.length} alias → ${SALIDA.pathname.split('/').pop()}`);
console.log(`   desconocidos y "Speaker X" → ${desconocido}`);
