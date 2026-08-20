-- 042 - El reporte de la reunion se guarda
--
-- El reporte de la Daily vivia solo en la memoria del navegador: al recargar
-- desaparecia y habia que volver a generarlo, con otra llamada de IA cada vez.
-- Peor: dos personas abriendo la misma reunion veian reportes distintos, porque
-- cada una generaba el suyo.
--
-- Un reporte es el acta de lo que paso. Se genera una vez y queda.
--
-- Se guarda en la propia reunion y no en una tabla aparte porque hay uno por
-- reunion y siempre se lee con ella: una tabla nueva solo anadiria un join.
--
-- Idempotente.

alter table public.meetings
  add column if not exists reporte jsonb;

alter table public.meetings
  add column if not exists reporte_generado_en timestamptz;

comment on column public.meetings.reporte is
  'Reporte generado de la reunion, con su plantilla. Se genera una vez y se reusa; regenerarlo lo reemplaza.';

comment on column public.meetings.reporte_generado_en is
  'Cuando se genero. Sirve para saber si el reporte es anterior a cambios en las tareas.';
