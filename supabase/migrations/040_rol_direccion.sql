-- ============================================================================
-- 040 — Rol de DIRECCIÓN
-- ============================================================================
-- Hasta hoy solo había dos niveles: la dueña de la agencia (lo ve todo) y el
-- miembro del equipo (solo lo suyo, en sus clientes). Falta el de en medio:
-- dirección — Lorenzo (CEO) y Juan Camilo (CTO) — que necesita la vista global
-- para dirigir, pero no administra la cuenta.
--
-- Están dados de alta como miembros, así que hoy la app les enseña solo sus
-- propias tareas. Cualquier lectura que hagan del estado del negocio es falsa.
--
-- QUÉ CAMBIA Y QUÉ NO:
--   ✅ Leen TODO lo del equipo de su agencia: clientes, tareas, reuniones,
--      ROPRE y personas. Es lectura, no escritura.
--   ❌ NO ven lo privado. Se decidió el 5-ago que lo privado no lo ve nadie,
--      ni la dueña. Dirección no es una excepción — la comprobación de
--      `puede_ver_fila` va en TODAS las policies de abajo.
--   ❌ NO administra: nada de llaves de API ni de invitar gente. Eso se hace
--      en el frontend (el menú y los botones), no aquí.
--
-- OJO, R-08: las policies de Postgres SE SUMAN. Esto solo AÑADE permisos de
-- lectura para quien sea dirección; no toca ni desactiva ninguna policy
-- existente. Un miembro normal sigue viendo exactamente lo mismo que ayer.
--
-- Idempotente: se puede correr dos veces.
-- ============================================================================


-- ── 1. La marca ────────────────────────────────────────────────────────────
-- Va en `team_members` y no en `users` porque de ahí cuelga la agencia: la
-- persona ya está enlazada a un cliente, y el cliente a su agencia. Sin eso
-- habría que inventar otra tabla para saber de qué agencia es dirección.
--
-- Basta con que UNA de sus fichas la tenga marcada: dirección es un cargo de
-- agencia, no de cliente.
alter table public.team_members
  add column if not exists es_direccion boolean not null default false;

comment on column public.team_members.es_direccion is
  'true = esta persona es dirección de la agencia (CEO/CTO): ve todo lo del equipo, no administra. Nunca ve lo privado.';

create index if not exists team_members_direccion_idx
  on public.team_members(user_id) where es_direccion = true;


-- ── 2. ¿El usuario actual es dirección? ────────────────────────────────────
-- SECURITY DEFINER por lo de siempre (R-09): la policy necesita mirar
-- `team_members`, que el propio usuario no puede leer entera. Sin esto la
-- policy se bloquea a sí misma y el síntoma es "no veo nada y no sé por qué".
create or replace function public.es_direccion()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.es_direccion = true
  );
$$;

grant execute on function public.es_direccion() to anon, authenticated;


-- ── 3. ¿Este cliente es de la agencia donde soy dirección? ─────────────────
-- Dirección ve toda SU agencia, no todas. En cuanto haya una segunda agencia
-- en la base, esto es lo que impide que se filtre nada entre ellas.
create or replace function public.direccion_ve_cliente(target_client uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.clients c_mio    on c_mio.id = tm.client_id
    join public.clients c_objetivo on c_objetivo.agency_id = c_mio.agency_id
    where tm.user_id = auth.uid()
      and tm.es_direccion = true
      and c_objetivo.id = target_client
  );
$$;

grant execute on function public.direccion_ve_cliente(uuid) to anon, authenticated;

comment on function public.direccion_ve_cliente is
  'true si el usuario actual es dirección de la agencia a la que pertenece ese cliente.';


-- ── 4. Policies de LECTURA para dirección ──────────────────────────────────
-- Todas llevan `puede_ver_fila`: lo privado sigue siendo privado.
-- Todas son `for select`: dirección lee, no escribe.

drop policy if exists "clients_direccion_read" on public.clients;
create policy "clients_direccion_read" on public.clients
  for select
  using (public.direccion_ve_cliente(clients.id));

drop policy if exists "tasks_direccion_read" on public.tasks;
create policy "tasks_direccion_read" on public.tasks
  for select
  using (
    public.direccion_ve_cliente(tasks.client_id)
    and public.puede_ver_fila(tasks.es_privada, tasks.propietario_id)
  );

drop policy if exists "meetings_direccion_read" on public.meetings;
create policy "meetings_direccion_read" on public.meetings
  for select
  using (
    public.direccion_ve_cliente(meetings.client_id)
    and public.puede_ver_fila(meetings.es_privada, meetings.propietario_id)
  );

drop policy if exists "team_members_direccion_read" on public.team_members;
create policy "team_members_direccion_read" on public.team_members
  for select
  using (public.direccion_ve_cliente(team_members.client_id));

drop policy if exists "ropre_direccion_read" on public.ropre_items;
create policy "ropre_direccion_read" on public.ropre_items
  for select
  using (public.direccion_ve_cliente(ropre_items.client_id));


-- ── 5. Comprobación ────────────────────────────────────────────────────────
-- Después de correr esto, `es_direccion` debe seguir en false para TODO el
-- mundo: la columna se crea, pero no asciende a nadie. A Lorenzo y a Juan
-- Camilo se les marca aparte, con `supabase/marcar_direccion.sql`, para que
-- quede claro quién lo hizo y cuándo.
--
--   select nombre, es_direccion from public.team_members where es_direccion;
--   ↑ debe devolver 0 filas justo después de esta migración.
