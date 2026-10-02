-- `origen` acepta 'fathom' — integración de reuniones de Fathom (ver
-- src/config/fathom.ts, api/fathom/reuniones.ts). Mismo patrón que la 039
-- amplió para 'paralelo': un valor nuevo en el union de TS sin ampliar este
-- CHECK rechaza el INSERT en silencio (trampa ya documentada en memoria).
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'meetings_origen_check') then
    alter table public.meetings drop constraint meetings_origen_check;
  end if;
  alter table public.meetings add constraint meetings_origen_check
    check (origen in ('manual', 'api', 'paralelo', 'fathom')) not valid;
end $$;
