-- 037 — La auditoría de privacidad daba una falsa alarma en las policies INSERT.
--
-- ⚠️  NO EJECUTADA. Córrela en el SQL Editor de Supabase.
-- ⚠️  Solo redefine una función de diagnóstico. NO toca permisos ni datos.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL PROBLEMA
-- ─────────────────────────────────────────────────────────────────────────────
-- `auditar_privacidad()` miraba solo la condición de LECTURA de cada policy
-- (`qual`, el USING). Una policy de INSERT no tiene USING —solo WITH CHECK—,
-- así que su `qual` siempre está vacío y la auditoría la marcaba 🔴 pasara lo
-- que pasara.
--
-- Con la 035 apareció la primera policy de INSERT del proyecto
-- (`tasks_miembro_crear`) y saltó la alarma. La policy es correcta: exige
-- `es_privada = false`, o sea que por ahí no se puede crear una fila privada a
-- nombre de otra persona. La equivocada era la auditoría.
--
-- POR QUÉ SE ARREGLA EN VEZ DE EXPLICARSE
-- Es la segunda falsa alarma en dos migraciones. Y el agujero que motivó todo
-- esto (la 034) sobrevivió meses precisamente porque nadie miraba las policies.
-- Una comprobación en la que no se confía no se mira, y una que no se mira no
-- sirve para nada. Si va a existir, tiene que ser exacta.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ SE CONSIDERA SEGURO, SEGÚN EL TIPO DE POLICY
-- ─────────────────────────────────────────────────────────────────────────────
--   LEER (select/update/all) — debe filtrar las filas privadas ajenas:
--     · delega en `puede_ver_fila()`, o
--     · exige `propietario_id = auth.uid()` (más estricto todavía).
--
--   CREAR (insert) — debe impedir sellar una fila privada a nombre de otro:
--     · exige `propietario_id = auth.uid()` (crea solo lo suyo), o
--     · exige `es_privada = false` (por esa vía no se crean privadas).

create or replace function public.auditar_privacidad()
returns table (tabla text, regla text, operacion text, estado text)
language sql
stable
as $$
  select
    pp.tablename::text,
    pp.policyname::text,
    pp.cmd::text,
    case
      -- ── Policies de creación: se juzga el WITH CHECK ──────────────────────
      when pp.cmd = 'INSERT' then
        case
          when lower(coalesce(pp.with_check, '')) like '%propietario_id = auth.uid()%'
            then '✅ solo crea filas propias'
          when lower(coalesce(pp.with_check, '')) like '%es_privada%false%'
            then '✅ no puede crear privadas'
          else '🔴 podría crear privadas ajenas'
        end

      -- ── El resto: se juzga el USING ───────────────────────────────────────
      when lower(coalesce(pp.qual, '')) like '%puede_ver_fila%'
        then '✅ comprueba privacidad'
      when lower(coalesce(pp.qual, '')) like '%propietario_id = auth.uid()%'
        then '✅ solo filas propias'
      else '🔴 NO comprueba privacidad'
    end
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('tasks', 'meetings')
  order by pp.tablename, pp.policyname;
$$;

comment on function public.auditar_privacidad is
  'Audita las policies de tasks/meetings. Juzga el WITH CHECK en las de INSERT y el USING en el resto. Toda fila debe salir ✅.';

-- ─────────────────────────────────────────────────────────────────────────────
--   select * from public.auditar_privacidad();   -- ahora sí, todo en ✅
-- ─────────────────────────────────────────────────────────────────────────────
