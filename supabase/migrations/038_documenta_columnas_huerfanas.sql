-- 038 — Documenta 10 columnas que existen en producción y que ninguna
--       migración creaba.
--
-- ⚠️  En la base actual NO CAMBIA NADA: todo es `add column if not exists` y
--     las 10 ya existen. Correrla es seguro y su efecto es cero.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PARA QUÉ SIRVE ENTONCES
-- ─────────────────────────────────────────────────────────────────────────────
-- El 10-ago se cerró un agujero de privacidad cuya causa raíz no fue una policy
-- mal escrita, sino esta: **el repo no reflejaba la base**. Había reglas y
-- columnas creadas a mano en la consola de Supabase que ningún archivo conocía,
-- así que las migraciones las pisaban sin saberlo.
--
-- Esta migración es el resultado de auditarlo con el CLI de Supabase: se
-- descargó el esquema real y se comparó, tabla por tabla, contra lo que las 37
-- migraciones del repo crean. Aparecieron 10 columnas huérfanas.
--
-- POR QUÉ IMPORTA AUNQUE HOY NO CAMBIE NADA
-- La app USA las diez —`taskToRow()` mapea ocho de `tasks`, y dos policies de
-- `meetings` dependen de `agency_id`—. Si mañana se reconstruyera la base desde
-- el repo (entorno de pruebas, otra agencia, recuperación de un desastre),
-- faltarían todas y la app se rompería sin explicación aparente.
--
-- A partir de acá, el repo puede reconstruir la base. Antes no.

-- ── TASKS ────────────────────────────────────────────────────────────────────
-- Ocho columnas que el código escribe en cada guardado (ver `taskToRow` en
-- src/services/repositories.ts) y que nacieron a mano.
alter table public.tasks
  add column if not exists subtasks   jsonb not null default '[]'::jsonb,
  add column if not exists comments   jsonb not null default '[]'::jsonb,
  add column if not exists tag        text,
  add column if not exists input      text,
  add column if not exists output     text,
  add column if not exists depends_on jsonb,
  add column if not exists start_date timestamptz,
  add column if not exists origin     jsonb;

comment on column public.tasks.subtasks   is 'Lista de subtareas [{id,title,done}].';
comment on column public.tasks.comments   is 'Comentarios de la tarea.';
comment on column public.tasks.tag        is 'Etiqueta libre; alimenta los SLA por tipo de tarea.';
comment on column public.tasks.input      is 'Qué necesita la tarea para poder empezar.';
comment on column public.tasks.output     is 'Qué entrega la tarea al terminar.';
comment on column public.tasks.depends_on is 'IDs de tareas que deben completarse antes.';
comment on column public.tasks.start_date is 'Inicio para la vista Gantt. Si falta, se infiere.';
-- OJO: `origin` (jsonb, enlace a un item de ROPRE) NO es lo mismo que `origen`
-- (text, de dónde nació la tarea: manual|reunion|embudo|ia|api). Dos columnas
-- con nombre casi idéntico y significados distintos; ya se advirtió en la 029.
comment on column public.tasks.origin     is 'Enlace al item de ROPRE que originó la tarea. NO confundir con `origen`.';

-- ── MEETINGS ─────────────────────────────────────────────────────────────────
-- La columna del agujero: dos policies creadas a mano (`meetings_team_read` y
-- `meetings_team_via_agency`) la usan para dar acceso a la agenda interna, y
-- ningún archivo del repo la mencionaba. La 034 documentó esas policies; esto
-- documenta la columna de la que dependen.
--
-- Sin clave foránea a propósito: en producción no la tiene, y esta migración
-- documenta lo que HAY, no lo que debería haber. Añadirla es otra decisión.
alter table public.meetings
  add column if not exists agency_id uuid;

comment on column public.meetings.agency_id is
  'Agencia dueña de la reunión interna (sin cliente). La usan las policies de agenda interna.';

-- ── TASK_LINKS ───────────────────────────────────────────────────────────────
alter table public.task_links
  add column if not exists created_by_nombre text;

comment on column public.task_links.created_by_nombre is
  'Nombre de quien subió el link, copiado al insertar: `created_by` es un id de auth y la app no tiene cargado el mapeo id→nombre.';

-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE ESTA MIGRACIÓN **NO** HACE, Y CONVIENE SABER
-- ─────────────────────────────────────────────────────────────────────────────
-- En producción existe además una función `public.rls_auto_enable()`, un
-- disparador de eventos que activa RLS automáticamente en cualquier tabla nueva.
-- Es una buena red de seguridad y tampoco estaba en el repo.
--
-- No se recrea acá porque los disparadores de eventos requieren permisos de
-- superusuario, que el SQL Editor no tiene. Queda anotada para que nadie la
-- borre creyendo que es basura, y para que quien reconstruya la base desde cero
-- sepa que le falta esa red.

-- ─────────────────────────────────────────────────────────────────────────────
-- CÓMO REPETIR ESTA AUDITORÍA (ahora que hay CLI + Docker)
-- ─────────────────────────────────────────────────────────────────────────────
--   supabase db dump --schema public -f /tmp/real.sql
-- y comparar contra lo que crean las migraciones. Conviene rehacerlo cada vez
-- que alguien toque algo desde la consola de Supabase.
