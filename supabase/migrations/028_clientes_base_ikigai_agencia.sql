-- 028 — Clientes base de Ikigai Agencia.
--
-- ⚠️  ESTE ARCHIVO NO SE HA EJECUTADO. Córrelo en el SQL Editor de Supabase
--     cuando apruebes los cambios. Toca datos de PRODUCCIÓN.
--
-- CONTEXTO
-- La única fila de `clients` se llamaba "Ikigai" y estaba marcada `is_agency`,
-- pero sus 163 tareas son trabajo de cliente real (VSL, oferta high ticket,
-- anuncios, call center) — es el espacio de trabajo de David Guerrero, no la
-- operación interna de la agencia. Confirmado con la founder el 2026-08-03.
--
-- QUÉ HACE
--   (1) Renombra esa fila a "David Guerrero" y le quita la bandera de agencia.
--       CONSERVA sus 163 tareas: no se borra ni se mueve nada.
--   (2) Crea una fila NUEVA y vacía para el Espacio de Agencia.
--   (3) Crea "Andrea Torres" como segundo cliente.
--
-- OJO con los CHECK: `project_type` solo acepta
--   ecommerce | launch | evergreen | personal_brand | other
-- Por eso va 'personal_brand' y NO 'marca_personal' (ese valor lo rechaza
-- Postgres en silencio desde el cliente REST).
--
-- Idempotente: se puede correr dos veces sin duplicar.

begin;

-- ── (1) Ikigai → David Guerrero ──────────────────────────────────────────────
-- Apunta por id exacto (no por ILIKE '%ikigai%') para no arrastrar por error
-- otra fila que contenga "ikigai" en el nombre.
update public.clients
set name          = 'David Guerrero',
    sigla         = 'DG',
    is_agency     = false,
    project_type  = 'personal_brand',
    business_type = 'Marca personal',
    status        = 'active'
where id = 'bf8c6d35-bde5-4fc9-9d9e-9a3608b1181b'
  and is_agency = true;   -- guard: si ya se corrió, no vuelve a tocarla

-- ── (2) Espacio de Agencia nuevo (vacío) ─────────────────────────────────────
insert into public.clients
  (agency_id, name, sigla, is_agency, industry, business_type,
   primary_color, status, project_type)
select '8b12a05a-177c-45c3-8269-4b2d38c78f0d',
       'Ikigai Agencia', 'IK', true, 'Marketing', 'Agencia',
       '#8B5CF6', 'active', 'other'
where not exists (
  select 1 from public.clients where is_agency = true
);

-- ── (3) Andrea Torres ────────────────────────────────────────────────────────
insert into public.clients
  (agency_id, name, sigla, is_agency, industry, business_type,
   primary_color, status, project_type)
select '8b12a05a-177c-45c3-8269-4b2d38c78f0d',
       'Andrea Torres', 'AT', false, 'Marca personal', 'Marca personal',
       '#10B981', 'active', 'personal_brand'
where not exists (
  select 1 from public.clients where name = 'Andrea Torres'
);

commit;

-- ── Verificación (correr aparte después del commit) ──────────────────────────
-- Debe devolver 3 filas: David Guerrero (DG, 163 tareas), Andrea Torres (AT, 0),
-- Ikigai Agencia (IK, 0, is_agency = true).
--
--   select c.name, c.sigla, c.is_agency, c.status, count(t.id) as tareas
--   from public.clients c
--   left join public.tasks t on t.client_id = c.id
--   group by c.id, c.name, c.sigla, c.is_agency, c.status
--   order by c.is_agency, c.name;
