-- Borrar un lead como miembro del equipo (no solo como dueño)
--
-- Mismo bug que la 060 arregló para leer/crear/editar leads, pero en DELETE:
-- la 047 solo dejó una policy `leads_via_client` (FOR ALL) que exige
-- `auth.uid() = agencies.owner_id` — el dueño de la agencia. La 060 agregó
-- SELECT/INSERT/UPDATE para miembros (`is_client_member`/`is_client_editor`)
-- pero nunca agregó DELETE.
--
-- Efecto real: un Setter/Closer con acceso editor a Ventas usa la bandeja de
-- "Leads duplicados" (`LeadsDuplicadosModal.tsx`), marca un duplicado,
-- confirma, la fila desaparece en pantalla (escritura optimista) — pero el
-- DELETE real no afecta ninguna fila bajo RLS. Como la consulta es válida
-- (no hay error, solo 0 filas afectadas), `LeadsRepo.remove()` no ve ningún
-- `error` y no revierte ni avisa. Al recargar, el lead "vuelve", porque nunca
-- se había ido de la base — parece que el delete no funciona cuando en
-- realidad nunca llegó a intentarlo con permiso.
--
-- Mismo criterio que UPDATE: cualquier editor del cliente puede borrar sus
-- leads, no solo el dueño de la agencia.
--
-- `to authenticated` explícito — mismo criterio que dejó la migración
-- `restaurar_acceso_y_privacidad` (10-oct) en el resto de policies de
-- `leads`: sin rol, Postgres la deja abierta también a `anon` por defecto.
--
-- Idempotente.

drop policy if exists "leads_client_delete" on public.leads;
create policy "leads_client_delete" on public.leads
  for delete
  to authenticated
  using (public.is_client_editor(leads.client_id));
