-- 053 — Nueva etapa "No calificado" al final del Kanban de Ventas.
--
-- Founder, 02-oct-2026. Aditiva: solo amplía el CHECK de `leads.etapa`.
alter table public.leads drop constraint if exists leads_etapa_check;
alter table public.leads add constraint leads_etapa_check
  check (etapa in (
    'nuevo', 'contactado', 'calificado', 'cita_agendada',
    'cita_realizada', 'propuesta', 'ganado', 'perdido', 'no_calificado'
  ));
