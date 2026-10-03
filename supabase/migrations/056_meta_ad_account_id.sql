-- Ad Account ID de Meta por cliente (formato "act_XXXXXXXXX"). Puente entre
-- el cliente de Project360 y su cuenta publicitaria real en Meta — sin esto,
-- la métrica de Meta sigue siendo simulada (ver src/services/adsIntegrations.ts).
alter table public.clients add column if not exists meta_ad_account_id text;
