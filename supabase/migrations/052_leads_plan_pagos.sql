-- 052 — Leads: agenda de la llamada + plan de pagos hasta 4 cuotas.
--
-- Founder, 02-oct-2026, sobre su hoja real de seguimiento comercial.
--
-- "Motivo si no cerró" NO se duplica: ya existe `leads.lost_reason`,
-- pedido automáticamente al mover un lead a "Perdido" — se reusa tal cual.
--
-- TOTAL COBRADO / SALDO PENDIENTE / PRÓXIMO PAGO / ESTADO DEL COBRO NO se
-- guardan: se calculan en la UI a partir de program_value + cash_collected +
-- los pagos 2-4. Guardarlos sería mantener dos fuentes de verdad que se
-- pueden desincronizar — mismo principio que ya rige el Dashboard (nada de
-- KPIs pre-calculados y guardados).
--
-- El "Pago 1" ES `cash_collected` (ya existe, manual, cobrado al cierre) —
-- solo le falta su fecha. Pagos 2/3/4 son nuevos: monto + fecha + si ya se
-- cobró (a diferencia del 1, que por definición ya está cobrado).
--
-- Aditiva e idempotente.

alter table public.leads add column if not exists fecha_agenda timestamptz;
alter table public.leads add column if not exists fecha_llamada timestamptz;
alter table public.leads add column if not exists asistio text;
alter table public.leads add column if not exists resultado text;
alter table public.leads add column if not exists producto text;
alter table public.leads add column if not exists forma_pago text;

alter table public.leads add column if not exists pago1_fecha timestamptz;

alter table public.leads add column if not exists pago2_monto numeric;
alter table public.leads add column if not exists pago2_fecha timestamptz;
alter table public.leads add column if not exists pago2_pagado boolean not null default false;

alter table public.leads add column if not exists pago3_monto numeric;
alter table public.leads add column if not exists pago3_fecha timestamptz;
alter table public.leads add column if not exists pago3_pagado boolean not null default false;

alter table public.leads add column if not exists pago4_monto numeric;
alter table public.leads add column if not exists pago4_fecha timestamptz;
alter table public.leads add column if not exists pago4_pagado boolean not null default false;

alter table public.leads add column if not exists ultimo_seguimiento timestamptz;
alter table public.leads add column if not exists notas text;

comment on column public.leads.asistio is
  'Texto libre: si/no/reprogramó — no enum, para no bloquear un valor que no se previó.';
comment on column public.leads.pago1_fecha is
  'Fecha del "Pago 1" — el monto ya existe en cash_collected (cobrado al cierre, siempre pagado).';
