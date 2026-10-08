-- 061 — Usuario de Instagram y de WhatsApp como campos propios del lead.
--
-- Antes vivían mezclados en una sola columna "Contacto" del CSV, que ni
-- siquiera se guardaba (ver `csvLeads.ts`): un teléfono se detectaba y se
-- guardaba en `telefono`, pero un usuario de Instagram se perdía o quedaba
-- enterrado en texto libre dentro de Notas. La founder pidió campos propios
-- (07-oct-2026) para poder contactar al lead sin tener que leer las notas.
--
-- Aditiva e idempotente — segura de correr varias veces.
alter table public.leads add column if not exists instagram text;
alter table public.leads add column if not exists whatsapp_usuario text;

comment on column public.leads.instagram is
  'Usuario de Instagram del lead (sin el "@" ni el link completo, solo el handle) — texto libre, editable.';
comment on column public.leads.whatsapp_usuario is
  'Alias/usuario de WhatsApp del lead, cuando lo trae (distinto del número en `telefono`) — texto libre, editable.';
