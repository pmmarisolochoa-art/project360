-- 035 — Que el equipo pueda crear sus tareas (y tener las suyas personales).
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase, DESPUÉS de la 034.
-- ⚠️  CAMBIO DE PERMISOS. Léela antes de correrla.
-- ⚠️  NO borra datos ni quita accesos: solo AÑADE lo que hoy no se puede hacer.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE SE DESCUBRIÓ Y NADIE SABÍA
-- ─────────────────────────────────────────────────────────────────────────────
-- Al revisar las policies para el agujero de la 034 salió esto: **un miembro
-- del equipo NO puede crear tareas.** Nunca ha podido. Las policies de `tasks`
-- le dan SELECT (`tasks_client_read`) y UPDATE (`tasks_client_update`), pero
-- ningún INSERT — el único era `tasks_via_client_owner`, que exige ser la dueña
-- de la agencia.
--
-- O sea que el "espacio del miembro" era de solo consumo: podía marcar como
-- hecho lo que le mandaban, no anotar lo suyo. Difícil que se sienta propio.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tus propias filas privadas son tuyas, estén donde estén
-- ─────────────────────────────────────────────────────────────────────────────
-- Regla general y simple: si una fila es privada Y su dueño eres tú, puedes
-- verla, editarla y borrarla. No depende de a qué cliente cuelgue.
--
-- Hace falta porque una tarea PERSONAL se guarda en el Espacio de Agencia, y
-- un miembro no es miembro de ese espacio: sin esto podría crearla y no volver
-- a verla nunca. (`tasks_client_read` exige `is_client_member`.)
--
-- No abre nada de nadie más: `propietario_id = auth.uid()` es lo más estrecho
-- que se puede escribir.
drop policy if exists "tasks_propias_privadas" on public.tasks;
create policy "tasks_propias_privadas" on public.tasks
  for all
  using (
    coalesce(es_privada, false) = true
    and propietario_id = auth.uid()
  )
  with check (
    coalesce(es_privada, false) = true
    and propietario_id = auth.uid()
    -- El cliente destino tiene que pertenecer a una agencia en la que la
    -- persona trabaje. Sin esto, cualquiera podría crear filas privadas
    -- colgando de clientes de OTRA agencia: no las vería nadie más, pero
    -- estaría escribiendo en casa ajena.
    and exists (
      select 1
      from public.clients destino
      where destino.id = tasks.client_id
        and destino.agency_id in (
          -- Agencias donde soy dueña…
          select a.id from public.agencies a where a.owner_id = auth.uid()
          union
          -- …o donde soy parte del equipo de algún cliente.
          select c.agency_id
          from public.team_members tm
          join public.clients c on c.id = tm.client_id
          where tm.user_id = auth.uid()
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Un editor puede crear tareas en SUS clientes
-- ─────────────────────────────────────────────────────────────────────────────
-- Solo `editor`, no `viewer`: quien está para revisar no crea trabajo.
-- Reusa `is_client_editor()` (migración 018), que es la misma función que ya
-- decide si puede editar una tarea existente. Poder editar pero no crear era
-- una incoherencia, no una decisión.
drop policy if exists "tasks_miembro_crear" on public.tasks;
create policy "tasks_miembro_crear" on public.tasks
  for insert
  with check (
    public.is_client_editor(tasks.client_id)
    -- Lo privado tiene su propia policy (la de arriba), con su propia
    -- comprobación de dueño. Acá se cubre solo lo compartido, para que nadie
    -- pueda crear una fila "privada" sellada a nombre de otra persona.
    and coalesce(es_privada, false) = false
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ¿Dónde vive "Personal"?
-- ─────────────────────────────────────────────────────────────────────────────
-- `tasks.client_id` es obligatorio, así que una tarea personal necesita colgar
-- de algún sitio: el Espacio de Agencia (`clients.is_agency`).
--
-- Pero un miembro NO ve ese cliente —no es miembro de él— así que el navegador
-- no tiene forma de saber su id. Esta función se lo da, y solo eso: un uuid.
-- No abre el espacio ni deja leer nada de él.
--
-- Devuelve null si la agencia todavía no tiene su espacio marcado; la interfaz
-- lo usa para ocultar la opción "Personal" en vez de fallar.
create or replace function public.mi_espacio_personal()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clients c
  where c.is_agency
    and c.agency_id in (
      select a.id from public.agencies a where a.owner_id = auth.uid()
      union
      select c2.agency_id
      from public.team_members tm
      join public.clients c2 on c2.id = tm.client_id
      where tm.user_id = auth.uid()
    )
  limit 1;
$$;

comment on function public.mi_espacio_personal is
  'uuid del Espacio de Agencia de quien llama, para colgar ahí sus tareas personales. Null si no existe.';

revoke all on function public.mi_espacio_personal() from public;
grant execute on function public.mi_espacio_personal() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. La auditoría tiene que entender esta forma nueva
-- ─────────────────────────────────────────────────────────────────────────────
-- `auditar_privacidad()` (creada en la 034) marca como 🔴 toda policy que no
-- mencione `puede_ver_fila`. `tasks_propias_privadas` no lo menciona y sin
-- embargo es MÁS estricta: filtra por `propietario_id = auth.uid()`.
--
-- Si se deja así, la auditoría avisaría en falso desde el primer día — y una
-- alarma que grita sin motivo se termina ignorando, que es exactamente cómo el
-- agujero de la 034 sobrevivió tanto tiempo. Se enseña a reconocer las DOS
-- formas válidas de proteger una fila privada.
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
      -- Forma 1: delega en el helper compartido.
      when coalesce(pp.qual, '') like '%puede_ver_fila%'
        then '✅ comprueba privacidad'
      -- Forma 2: solo deja pasar filas de quien pregunta. Más estricta aún.
      when coalesce(pp.qual, '') like '%propietario_id = auth.uid()%'
        then '✅ solo filas propias'
      else '🔴 NO comprueba privacidad'
    end
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('tasks', 'meetings')
  order by pp.tablename, pp.policyname;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN — corre esto después. Toda fila debe salir ✅.
-- ─────────────────────────────────────────────────────────────────────────────
--   select * from public.auditar_privacidad();
