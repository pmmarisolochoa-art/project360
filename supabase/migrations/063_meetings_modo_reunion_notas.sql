-- 063 - Notas del Modo Reunión se guardan con la reunión
--
-- El Modo Reunión (presentación paso a paso) tiene un campo de notas rápidas
-- por diapositiva. Igual que el reporte (042), vive en la propia reunión y no
-- en una tabla aparte: hay un set de notas por reunión y siempre se lee junto
-- con ella.
--
-- Idempotente.

alter table public.meetings
  add column if not exists modo_reunion_notas jsonb;

comment on column public.meetings.modo_reunion_notas is
  'Notas rápidas del Modo Reunión, una entrada por paso de la plantilla (clave = id del paso en src/config/meetingTemplates.ts).';
