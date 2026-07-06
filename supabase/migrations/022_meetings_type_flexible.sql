-- ──────────────────────────────────────────────────────────────────────────
--  Migración 022: quitar la restricción rígida de tipos de reunión.
--
--  Problema: `meetings.type` tenía un CHECK con solo 6 tipos
--  (kickoff, weekly_metrics, content_strategy, ads_review, monthly_closing,
--  crisis). La app ya ofrece 8 (agregó `weekly_planning` y `ropre_strategy`).
--  Al crear una reunión de un tipo nuevo, el INSERT se rechazaba por el CHECK
--  y la reunión NO se guardaba — el cliente tragaba el error en silencio, así
--  que se veía en el navegador del dueño pero nunca llegaba a la base ni a los
--  miembros.
--
--  Fix: el tipo válido lo controla el front (union `MeetingType` en
--  src/types/meeting.ts). La BD deja de bloquear tipos nuevos, así no se rompe
--  cada vez que se agregue uno. Mismo criterio que la migración 001 (columnas
--  que existían en TS pero no en el schema).
--
--  Idempotente: encuentra y elimina el/los CHECK de `type` por su definición
--  (robusto ante el nombre autogenerado del constraint).
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.meetings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kickoff%'
  loop
    execute format('alter table public.meetings drop constraint %I', c.conname);
  end loop;
end $$;
