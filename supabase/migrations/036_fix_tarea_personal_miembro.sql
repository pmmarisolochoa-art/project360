-- 036 — Arregla la 035: la tarea personal de un miembro no llegaba a guardarse.
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase, DESPUÉS de la 035.
-- ⚠️  NO borra datos. Reescribe una policy y añade dos funciones.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL BUG
-- ─────────────────────────────────────────────────────────────────────────────
-- La policy `tasks_propias_privadas` (035) comprobaba, antes de dejar crear una
-- fila privada, que el cliente destino fuera de una agencia donde la persona
-- trabaja. Para eso consultaba `public.clients` directamente:
--
--     and exists (select 1 from public.clients destino where destino.id = ...)
--
-- El detalle que se me pasó: **esa consulta se ejecuta con los permisos de
-- quien está insertando**, así que le aplica el RLS de `clients`. Y un miembro
-- del equipo NO puede ver la fila del Espacio de Agencia — no es miembro de
-- ese espacio, que es justamente el motivo de que la 035 existiera.
--
-- Resultado: el EXISTS daba falso, la base rechazaba el INSERT, y como la
-- interfaz es optimista la tarea aparecía en pantalla y se esfumaba al
-- recargar. La comprobación que puse para que nadie escribiera en casa ajena
-- era justo la que impedía escribir en la propia.
--
-- LA LECCIÓN, QUE VALE PARA TODA POLICY FUTURA
-- Dentro de una policy, cualquier consulta a OTRA tabla con RLS se filtra por
-- los permisos del usuario. Si la policy necesita ver algo que ese usuario no
-- puede ver, hay que pasar por una función `security definer`. Por eso el resto
-- del proyecto ya usa `is_client_member()` y `is_client_editor()`, que lo son.
-- Aquí me salté ese patrón y escribí la consulta a pelo.

-- ─────────────────────────────────────────────────────────────────────────────
-- Las dos funciones que faltaban
-- ─────────────────────────────────────────────────────────────────────────────

/** Agencias en las que trabajo: como dueña, o como parte del equipo. */
create or replace function public.mis_agencias()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id from public.agencies a where a.owner_id = auth.uid()
  union
  select c.agency_id
  from public.team_members tm
  join public.clients c on c.id = tm.client_id
  where tm.user_id = auth.uid();
$$;

comment on function public.mis_agencias is
  'Agencias del usuario actual (como dueña o como miembro). security definer: se usa dentro de policies.';

/**
 * ¿Puedo colgar una fila de este cliente?
 * Sí cuando el cliente pertenece a una agencia mía — aunque no pueda VER ese
 * cliente. Es justo el caso del Espacio de Agencia para un miembro.
 */
create or replace function public.puedo_escribir_en_cliente(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client
      and c.agency_id in (select public.mis_agencias())
  );
$$;

comment on function public.puedo_escribir_en_cliente is
  'true si el cliente es de una agencia del usuario. No implica poder LEER ese cliente.';

revoke all on function public.mis_agencias() from public;
revoke all on function public.puedo_escribir_en_cliente(uuid) from public;
grant execute on function public.mis_agencias() to authenticated;
grant execute on function public.puedo_escribir_en_cliente(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- La policy, ahora sí
-- ─────────────────────────────────────────────────────────────────────────────
-- Misma intención que en la 035, misma estrechez: solo filas privadas y solo
-- tuyas. Lo único que cambia es CÓMO se comprueba la agencia del destino.
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
    and public.puedo_escribir_en_cliente(tasks.client_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ─────────────────────────────────────────────────────────────────────────────
--   select * from public.auditar_privacidad();   -- todo debe salir ✅
--
-- Y la prueba de verdad: con la cuenta de un miembro, crear una tarea Personal
-- desde Mi Espacio y RECARGAR. Si sigue ahí, quedó guardada.
