-- 062 — Calendly: `meetings.lead_id` + `origen` acepta 'calendly'.
--
-- Conecta una reunión agendada por Calendly con el lead que la agendó, para
-- poder hacer seguimiento desde la ficha del lead y mover su etapa sola.
-- `on delete set null`: si el lead se borra, la reunión (y su historial) se
-- queda — borrar un lead no debería borrar el registro de que hubo una llamada.
--
-- Mismo patrón que 039 (Paralelo) y 055 (Fathom) para ampliar el CHECK de
-- `origen` — si no se amplía, el INSERT se rechaza en silencio (trampa ya
-- vivida dos veces en este repo).
--
-- Aditiva e idempotente — segura de correr varias veces.

alter table public.meetings add column if not exists lead_id uuid references public.leads(id) on delete set null;
create index if not exists meetings_lead_id_idx on public.meetings(lead_id);

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'meetings_origen_check') then
    alter table public.meetings drop constraint meetings_origen_check;
  end if;
  alter table public.meetings add constraint meetings_origen_check
    check (origen in ('manual', 'api', 'paralelo', 'fathom', 'calendly')) not valid;
end $$;

comment on column public.meetings.lead_id is
  'Lead que agendó esta reunión (Calendly u otro origen futuro). Nulo = reunión sin lead asociado (interna, de cliente ya ganado, etc).';
