-- `leads` (migración 047) nunca recibió las policies de acceso de miembro
-- que SÍ tienen tasks/meetings/etc desde la 018 — solo el owner podía leer
-- o escribir. Un Setter/Closer invitado veía el Pipeline de Ventas
-- completamente vacío (0 en todas las columnas) aunque hubiera cientos de
-- leads reales: no era un bug de la UI, era RLS bloqueando todo en silencio.
--
-- Mismo patrón que tasks: lectura para cualquier miembro del cliente,
-- escritura (insertar/editar/mover etapa) solo para editores.
drop policy if exists "leads_client_read" on public.leads;
create policy "leads_client_read" on public.leads
  for select
  using (public.is_client_member(leads.client_id));

drop policy if exists "leads_client_insert" on public.leads;
create policy "leads_client_insert" on public.leads
  for insert
  with check (public.is_client_editor(leads.client_id));

drop policy if exists "leads_client_update" on public.leads;
create policy "leads_client_update" on public.leads
  for update
  using (public.is_client_editor(leads.client_id))
  with check (public.is_client_editor(leads.client_id));

-- lead_events: el viaje del lead — mismo criterio (leer todos, escribir editor).
drop policy if exists "lead_events_client_read" on public.lead_events;
create policy "lead_events_client_read" on public.lead_events
  for select
  using (
    exists (select 1 from public.leads l where l.id = lead_events.lead_id and public.is_client_member(l.client_id))
  );

drop policy if exists "lead_events_client_insert" on public.lead_events;
create policy "lead_events_client_insert" on public.lead_events
  for insert
  with check (
    exists (select 1 from public.leads l where l.id = lead_events.lead_id and public.is_client_editor(l.client_id))
  );
