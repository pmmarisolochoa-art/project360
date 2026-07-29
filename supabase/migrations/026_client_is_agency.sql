-- 026 — Espacio de Agencia.
--
-- Marca un "cliente" como el ESPACIO DE AGENCIA (ej. Ikigai). Ahí viven las
-- reuniones compartidas (planeación, sprint de cierre, gerencia, general) y no
-- aparece en la lista de clientes reales (David, Andrea).
--
-- Implementación segura: reutiliza toda la infraestructura de cliente (reuniones,
-- tareas, RLS) sin tocar la mecánica existente. Solo la UI lo trata distinto.
--
-- Aditiva e idempotente.

alter table public.clients
  add column if not exists is_agency boolean not null default false;

comment on column public.clients.is_agency is
  'Si true, este "cliente" es el espacio de Agencia (reuniones compartidas), no un cliente real.';
