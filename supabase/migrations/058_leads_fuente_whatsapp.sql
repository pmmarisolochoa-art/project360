-- `fuente` acepta 'whatsapp' — la founder pidió agregarlo como canal de
-- entrada (leads que llegan directo por WhatsApp, no por un post/ad).
alter table public.leads drop constraint if exists leads_fuente_check;
alter table public.leads add constraint leads_fuente_check
  check (fuente in ('meta_ads', 'reel', 'story', 'carrusel', 'perfil', 'referido', 'whatsapp', 'otro'));
