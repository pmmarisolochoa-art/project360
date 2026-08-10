-- 034 — Cierra el agujero de privacidad: tres policies que nadie comprobaba.
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase.
-- ⚠️  CAMBIO DE SEGURIDAD. Léela antes de correrla.
-- ⚠️  NO borra datos. Solo reescribe reglas de acceso.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ PASÓ
-- ─────────────────────────────────────────────────────────────────────────────
-- La migración 030 (05-ago) creó las tareas y reuniones privadas: una fila
-- privada solo la ve su dueño. Se escribieron policies nuevas con el helper
-- `puede_ver_fila()` y se reemplazaron las que se conocían POR SU NOMBRE.
--
-- El problema es que en Postgres las policies permisivas se SUMAN: basta que
-- UNA deje ver la fila para que se vea. Y quedaron tres vivas que no comprueban
-- nada:
--
--   · tasks.tasks_via_client          (ALL)    — de la migración 004
--   · meetings.meetings_team_via_agency (ALL)  — creada A MANO en Supabase
--   · meetings.meetings_team_read     (SELECT) — creada A MANO en Supabase
--
-- Resultado: **lo privado nunca fue privado**. Desde el 05-ago.
--
-- GRAVEDAD, QUE NO ES LA MISMA EN LAS TRES
--   · Las dos de `tasks`/`meetings` que van por `agencies.owner_id` exponen las
--     filas privadas SOLO a la dueña de la agencia. Malo —un espacio privado
--     que el jefe puede leer no es privado, y eso se decidió explícitamente el
--     05-ago— pero no filtra nada entre compañeros.
--   · `meetings_team_read` es la grave: deja leer las reuniones de la agencia a
--     CUALQUIER miembro del equipo. Una reunión privada con `agency_id` puesto
--     la ve toda la agencia.
--
-- CÓMO SE ENCONTRÓ
-- Probando a mano: se creó una tarea privada y apareció donde no debía. No lo
-- detectó ningún typecheck ni ninguna prueba — y tampoco el script de
-- verificación de seguridad de la API, que comprobaba que RLS estuviera
-- ENCENDIDO pero no que las policies fueran coherentes entre sí. Se corrige
-- también eso (ver el final del archivo).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. tasks_via_client — se BORRA
-- ─────────────────────────────────────────────────────────────────────────────
-- No se reescribe porque su reemplazo YA existe: la 030 creó
-- `tasks_via_client_owner`, que hace exactamente lo mismo (dueña de agencia ve
-- las tareas de sus clientes) más la comprobación de privacidad. Tener las dos
-- es justamente el bug: la vieja anula a la nueva.
drop policy if exists "tasks_via_client" on public.tasks;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 y 3. Las dos de meetings — se REESCRIBEN, no se borran
-- ─────────────────────────────────────────────────────────────────────────────
-- Estas sí se conservan: son el único camino por el que el equipo ve las
-- reuniones internas de la agencia (las que cuelgan de `meetings.agency_id` en
-- vez de un cliente). Borrarlas dejaría al equipo sin agenda interna.
--
-- Se recrean IDÉNTICAS salvo por el `and public.puede_ver_fila(...)`.
--
-- OJO — DEUDA QUE ESTO SACA A LA LUZ: ni estas dos policies ni la columna
-- `meetings.agency_id` que usan están en ninguna migración del repo. Se
-- crearon a mano en la consola de Supabase. O sea que el repo NO refleja el
-- estado real de la base, y cualquier migración futura puede volver a pisar
-- algo que no sabe que existe. Este archivo las deja documentadas por fin.

drop policy if exists "meetings_team_via_agency" on public.meetings;
create policy "meetings_team_via_agency" on public.meetings
  for all
  using (
    exists (
      select 1 from public.agencies a
      where a.id = meetings.agency_id and a.owner_id = auth.uid()
    )
    and public.puede_ver_fila(meetings.es_privada, meetings.propietario_id)
  )
  with check (
    exists (
      select 1 from public.agencies a
      where a.id = meetings.agency_id and a.owner_id = auth.uid()
    )
    and public.puede_ver_fila(meetings.es_privada, meetings.propietario_id)
  );

drop policy if exists "meetings_team_read" on public.meetings;
create policy "meetings_team_read" on public.meetings
  for select
  using (
    meetings.agency_id is not null
    and exists (
      select 1
      from public.team_members tm
      join public.clients c on c.id = tm.client_id
      where tm.user_id = auth.uid() and c.agency_id = meetings.agency_id
    )
    and public.puede_ver_fila(meetings.es_privada, meetings.propietario_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Que esto no pueda volver a pasar en silencio
-- ─────────────────────────────────────────────────────────────────────────────
-- El fallo de fondo no fue una policy mal escrita: fue que NADIE comprobaba que
-- todas las policies de estas dos tablas fueran coherentes. Esta función lo
-- comprueba de un vistazo y se puede correr cuando se quiera.
create or replace function public.auditar_privacidad()
returns table (tabla text, regla text, operacion text, estado text)
language sql
stable
as $$
  select
    pp.tablename::text,
    pp.policyname::text,
    pp.cmd::text,
    case
      when coalesce(pp.qual, '') like '%puede_ver_fila%' then '✅ comprueba privacidad'
      else '🔴 NO comprueba privacidad'
    end
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('tasks', 'meetings')
  order by pp.tablename, pp.policyname;
$$;

comment on function public.auditar_privacidad is
  'Lista las policies de tasks/meetings y si comprueban privacidad. Toda fila debe salir ✅.';

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN — corre esto DESPUÉS y revisa que no quede ni un 🔴
-- ─────────────────────────────────────────────────────────────────────────────
-- select * from public.auditar_privacidad();
