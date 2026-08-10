-- ═════════════════════════════════════════════════════════════════════════════
--  VERIFICACIÓN DE SEGURIDAD DE LA API PÚBLICA v1
--  Pégalo entero en el SQL Editor de Supabase DESPUÉS de correr 032 y 033.
--
--  SOLO LEE. No modifica nada, no borra nada. Se puede correr las veces que
--  quieras.
--
--  Existe porque desde el entorno de desarrollo no hay forma de comprobar el
--  estado real de producción: no hay psql ni CLI de Supabase, y la única llave
--  disponible es la anon. Afirmar "RLS está activo" sin poder mirarlo sería
--  justo el tipo de suposición que en seguridad sale cara.
--
--  CÓMO LEERLO: toda fila debe decir ✅. Cualquier 🔴 es algo que arreglar
--  ANTES de entregarle una llave a nadie.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. ¿RLS encendido en las tablas que la API toca? ─────────────────────────
-- Última línea de defensa para todo lo que NO pasa por la service key: el
-- frontend, los miembros del equipo y cualquiera que use la anon key.
select
  '1. RLS' as bloque,
  c.relname as tabla,
  case when c.relrowsecurity then '✅ activo' else '🔴 APAGADO' end as estado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('tasks', 'meetings', 'clients', 'agencies', 'api_keys', 'api_requests')
order by c.relname;

-- ── 1b. ¿TODAS las policies comprueban la privacidad? ────────────────────────
-- Esta comprobación faltaba y por eso el agujero de la 034 pasó desapercibido:
-- se verificaba que RLS estuviera ENCENDIDO, pero no que las policies fueran
-- coherentes entre sí. En Postgres las policies permisivas se SUMAN, así que
-- una sola regla que no compruebe privacidad anula a todas las que sí.
--
-- Toda fila debe salir ✅. Un solo 🔴 significa que lo privado no es privado.
select
  '1b. Privacidad' as bloque,
  pp.tablename     as tabla,
  pp.policyname    as regla,
  pp.cmd           as operacion,
  case when coalesce(pp.qual, '') like '%puede_ver_fila%'         then '✅ comprueba'
       when coalesce(pp.qual, '') like '%propietario_id = auth.uid()%' then '✅ solo filas propias'
       else '🔴 NO COMPRUEBA' end as estado
from pg_policies pp
where pp.schemaname = 'public'
  and pp.tablename in ('tasks', 'meetings')
order by pp.tablename, pp.policyname;

-- ── 2. ¿Existen las 7 funciones y son security definer? ──────────────────────
-- `security definer` es lo que les permite hacer el filtro por agencia por
-- dentro. Si alguna quedara como `invoker`, dejaría de aislar.
--
-- `search_path` fijo importa igual: sin él, alguien que pudiera crear un
-- esquema propio podría hacer que la función llame a SU tabla `clients` en vez
-- de la real. Es un ataque conocido contra las funciones security definer.
select
  '2. Funciones' as bloque,
  p.proname as funcion,
  case when p.prosecdef then '✅ definer' else '🔴 INVOKER' end as tipo,
  case
    when array_to_string(coalesce(p.proconfig, '{}'), ',') like '%search_path%'
    then '✅ search_path fijo'
    else '🔴 SIN search_path'
  end as search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'api_tareas_listar', 'api_tarea_obtener',
    'api_reuniones_listar', 'api_reunion_obtener',
    'api_tarea_crear', 'api_tarea_estado', 'api_reunion_crear',
    'es_duena_de_agencia', 'puede_ver_fila'
  )
order by p.proname;

-- Si esta consulta devuelve menos de 7 filas api_*, falta correr la 033.
select
  '2b. Conteo' as bloque,
  count(*) filter (where p.proname like 'api\_%') as funciones_api,
  case when count(*) filter (where p.proname like 'api\_%') = 7
       then '✅ las 7 existen' else '🔴 FALTAN FUNCIONES' end as estado
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- ── 3. ¿Puede `anon` o `authenticated` invocar las funciones? ────────────────
-- Debe dar 'no' en las dos columnas. Si `anon` pudiera ejecutarlas, cualquiera
-- con la anon key —que viaja en el JavaScript del navegador, a la vista de
-- todos— podría pedir las tareas de CUALQUIER agencia pasando un uuid.
-- Es el agujero más grave posible en este diseño.
select
  '3. Permisos' as bloque,
  p.proname as funcion,
  case when has_function_privilege('anon', p.oid, 'execute')
       then '🔴 ANON PUEDE' else '✅ anon no' end as anon,
  case when has_function_privilege('authenticated', p.oid, 'execute')
       then '🔴 AUTH PUEDE' else '✅ auth no' end as authenticated,
  case when has_function_privilege('service_role', p.oid, 'execute')
       then '✅ service_role sí' else '🔴 SERVICE_ROLE NO PUEDE' end as service_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'api\_%'
order by p.proname;

-- ── 4. ¿Alguna llave guardada en texto plano? ────────────────────────────────
-- Un hash SHA-256 en hex son exactamente 64 caracteres [0-9a-f]. Cualquier
-- cosa distinta significa que algo guardó la llave sin hashear.
select
  '4. Llaves' as bloque,
  count(*) as total,
  count(*) filter (where key_hash ~ '^[0-9a-f]{64}$') as hasheadas_ok,
  case when count(*) = count(*) filter (where key_hash ~ '^[0-9a-f]{64}$')
       then '✅ todas hasheadas' else '🔴 HAY LLAVES EN TEXTO PLANO' end as estado
from public.api_keys;

-- Ninguna llave debería empezar por 'pk_live_' en la columna del hash.
select
  '4b. Fugas' as bloque,
  case when exists (select 1 from public.api_keys where key_hash like 'pk_%')
       then '🔴 UNA LLAVE ESTÁ EN CLARO EN key_hash'
       else '✅ ninguna llave en claro' end as estado;

-- ── 5. ¿Los CHECK que la API necesita están puestos? ─────────────────────────
-- Sin 'api' en el CHECK de origen, POST /tasks falla — y falla en silencio
-- desde el cliente REST, que es como ya nos mordió dos veces.
select
  '5. CHECKs' as bloque,
  conname as restriccion,
  case when pg_get_constraintdef(oid) like '%api%'
       then '✅ acepta origen api' else '🔴 NO ACEPTA api' end as estado
from pg_constraint
where conname in ('tasks_origen_check', 'meetings_origen_check');

-- ── 6. ¿Hay filas privadas sin dueño? ────────────────────────────────────────
-- Una fila privada sin propietario es invisible para TODOS, incluida su
-- autora. No es un riesgo de fuga: es trabajo perdido sin que nadie lo note.
select
  '6. Privacidad' as bloque,
  (select count(*) from public.tasks    where es_privada and propietario_id is null) as tareas_huerfanas,
  (select count(*) from public.meetings where es_privada and propietario_id is null) as reuniones_huerfanas,
  case when (select count(*) from public.tasks    where es_privada and propietario_id is null) = 0
        and (select count(*) from public.meetings where es_privada and propietario_id is null) = 0
       then '✅ ninguna huérfana' else '🔴 HAY FILAS PRIVADAS SIN DUEÑO' end as estado;

-- ── 7. Prueba real de aislamiento ────────────────────────────────────────────
-- No comprueba configuración: EJECUTA la función con una agencia inventada y
-- confirma que no devuelve nada. Es la diferencia entre "debería aislar" y
-- "aísla".
select
  '7. Aislamiento' as bloque,
  (select count(*) from public.api_tareas_listar('00000000-0000-4000-8000-000000000000'::uuid)) as tareas_de_agencia_falsa,
  case when (select count(*) from public.api_tareas_listar('00000000-0000-4000-8000-000000000000'::uuid)) = 0
       then '✅ agencia inexistente ve 0 tareas'
       else '🔴 FUGA: DEVUELVE TAREAS AJENAS' end as estado;

-- Y que una agencia real SÍ vea las suyas (si no, el aislamiento "funciona"
-- porque la función está rota, que no es lo mismo).
select
  '7b. Aislamiento' as bloque,
  a.name as agencia,
  (select count(*) from public.api_tareas_listar(a.id, null, null, null, null, 200, 0)) as tareas_visibles,
  (select count(*) from public.tasks t
     join public.clients c on c.id = t.client_id
    where c.agency_id = a.id and coalesce(t.es_privada,false) = false) as tareas_esperadas
from public.agencies a
order by a.name;
