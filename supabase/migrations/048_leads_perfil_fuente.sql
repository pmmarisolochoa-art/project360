-- 048 — Ventas: fuente más granular + perfil del comprador.
--
-- Founder, 29-sep-2026, sobre maqueta de referencia del dashboard de Alejo:
-- la fuente pasa de 4 valores genéricos (meta/organico/referido/otro) a un set
-- que distingue FORMATO de contenido (reel/story/carrusel/perfil) además de
-- meta_ads/referido/otro — así el "leads por origen" es accionable de verdad.
--
-- `perfil_rol` es TEXT LIBRE a propósito (no enum/CHECK): quién es el
-- comprador (Piloto/Papá/Mamá/Familiar/Otro para Alejo) es específico de cada
-- nicho de cliente, no parte del SOP fijo del pipeline. Cada cliente escribe
-- las categorías que le sirven; el dashboard agrupa por lo que encuentre.
--
-- Aditiva e idempotente.

-- El orden importa: hay que SOLTAR la restricción vieja ANTES de remapear los
-- datos — si se intenta el UPDATE con la restricción vieja todavía puesta,
-- 'meta_ads' la viola (no estaba en la lista vieja) y el propio remapeo falla.
-- Encontrado corriendo esto en producción contra un lead real (29-sep-2026).
alter table public.leads drop constraint if exists leads_fuente_check;

update public.leads set fuente = 'meta_ads' where fuente = 'meta';
update public.leads set fuente = 'otro' where fuente = 'organico';

alter table public.leads add constraint leads_fuente_check
  check (fuente in ('meta_ads', 'reel', 'story', 'carrusel', 'perfil', 'referido', 'otro'));

alter table public.leads add column if not exists perfil_rol text;

comment on column public.leads.perfil_rol is
  'Quién es el comprador (texto libre por cliente: Piloto, Papá, Mamá... o lo que aplique). No es enum: cada nicho define sus propias categorías.';
