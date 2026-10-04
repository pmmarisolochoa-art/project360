-- `fuente` acepta 'dm' — DM directo de Instagram (distinto de 'whatsapp' y
-- de 'perfil'), canal real en el CSV de Alejo ("DM directo").
alter table public.leads drop constraint if exists leads_fuente_check;
alter table public.leads add constraint leads_fuente_check
  check (fuente in ('meta_ads', 'reel', 'story', 'carrusel', 'perfil', 'referido', 'whatsapp', 'dm', 'otro'));
