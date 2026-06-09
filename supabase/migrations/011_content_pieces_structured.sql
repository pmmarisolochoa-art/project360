-- ══════════════════════════════════════════════════════════════════════════
--  Migración 011: campos estructurados para piezas de contenido
--
--  Hasta ahora `content_pieces.copy_text` contenía script+caption mezclados.
--  Ahora separamos en campos dedicados + agregamos tipo de CTA y
--  rol/responsable. `copy_text` queda como legacy.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.content_pieces
  add column if not exists cta_type text,
  add column if not exists script text,
  add column if not exists caption text,
  add column if not exists role_slug text,
  add column if not exists assigned_to text;

notify pgrst, 'reload schema';

select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'content_pieces'
  and column_name in ('cta_type', 'script', 'caption', 'role_slug', 'assigned_to');
