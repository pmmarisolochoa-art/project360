-- 023 — Teléfono (WhatsApp) por miembro del equipo.
-- Lo usa el envío de recordatorios y post-reunión vía GHL. Nullable: si no hay
-- número, simplemente no se manda WhatsApp a esa persona (el email sigue igual).

alter table public.team_members
  add column if not exists telefono text;

comment on column public.team_members.telefono is
  'Teléfono en formato internacional (ej. +573001234567) para WhatsApp vía GHL. Opcional.';
