-- Separar plan de primer pago de cobro real y acordar comisiones por venta.
-- Ejecutar antes de publicar la UI. No modifica importes existentes.
alter table public.leads
  add column if not exists pago1_monto numeric check (pago1_monto >= 0),
  add column if not exists setter_comision_pct numeric check (setter_comision_pct between 0 and 100),
  add column if not exists closer_comision_pct numeric check (closer_comision_pct between 0 and 100);

comment on column public.leads.pago1_monto is 'Primer pago previsto; cash_collected sigue siendo el cobro confirmado.';
comment on column public.leads.setter_comision_pct is 'Comisión setter de esta venta, 0–100; null conserva el default 5%.';
comment on column public.leads.closer_comision_pct is 'Comisión closer de esta venta, 0–100; null conserva el default 10%.';
