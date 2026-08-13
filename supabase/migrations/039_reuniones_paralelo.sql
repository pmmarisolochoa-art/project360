-- ============================================================================
-- 039 — Importar reuniones desde Paralelo (Meetico/Marketico)
-- ============================================================================
-- Project360 va a LEER las reuniones de Paralelo y traerlas como reuniones
-- propias, con sus tareas. Para que traer dos veces la misma reunión no cree
-- un duplicado, hace falta guardar el id que esa reunión tiene ALLÁ.
--
-- `tasks` ya tiene `external_id` desde la 025 — aquí se le da lo mismo a
-- `meetings`, con el mismo criterio: índice no único (una fila borrada y
-- reimportada puede repetir), consultado al importar.
--
-- Efecto sobre datos existentes: CERO. Solo agrega una columna nullable y
-- amplía un CHECK (ampliar nunca invalida filas que ya pasaban).
--
-- Idempotente: se puede correr dos veces sin efecto.
-- ============================================================================

-- ── 1. De dónde vino la reunión, en la plataforma de origen ─────────────────
alter table public.meetings
  add column if not exists external_id text;

comment on column public.meetings.external_id is
  'ID de esta reunión en la plataforma externa (ej. Paralelo). Evita reimportar duplicados. Vacío = creada dentro de Project360.';

create index if not exists meetings_external_id_idx
  on public.meetings(external_id) where external_id is not null;

-- ── 2. `origen` acepta 'paralelo' ──────────────────────────────────────────
-- OJO — esta es la trampa que ya nos mordió tres veces (ver 033): agregar un
-- valor al union de TypeScript sin ampliar el CHECK hace que el INSERT se
-- rechace, y el error se pierde. Se amplía ANTES de que exista el código que
-- lo escribe, no después.
--
-- 'api'      = lo creó nuestra API pública (alguien externo escribiendo aquí).
-- 'paralelo' = lo trajimos nosotros leyendo la API de Paralelo.
-- No son lo mismo y conviene poder separarlos en una auditoría.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'meetings_origen_check') then
    alter table public.meetings drop constraint meetings_origen_check;
  end if;
  alter table public.meetings add constraint meetings_origen_check
    check (origen in ('manual', 'api', 'paralelo')) not valid;
end $$;

comment on column public.meetings.origen is
  'manual | api | paralelo. Permite aislar lo que creó o trajo una integración.';

-- ── 3. Nota sobre las TAREAS que salen de estas reuniones ──────────────────
-- A propósito NO se toca `tasks_origen_check`. Una tarea importada de Paralelo
-- nació en una reunión, así que su origen sigue siendo 'reunion' — la interfaz
-- ya sabe pintar eso ("De una reunión" + nombre y fecha de la reunión) y no
-- hace falta ni migración ni cambio de tipos. Lo que la marca como venida de
-- fuera es su `external_id`, con el prefijo 'paralelo:'.
