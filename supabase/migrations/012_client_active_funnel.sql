-- 012_client_active_funnel.sql
-- Sprint D — Sección 2: persistir el embudo activo por defecto del cliente.
-- Cuando un cliente tiene varios funnels, este apunta al que se muestra
-- primero al abrir el sub-tab "Embudos" dentro de Planeación.
--
-- Es nullable: un cliente puede no tener embudo todavía (estado válido
-- inmediatamente después del onboarding si el usuario eligió "Omitir").
--
-- ON DELETE SET NULL — si borran el funnel referenciado, el cliente
-- queda con activeFunnelId vacío y el panel cae al estado vacío
-- "Elige el sistema de ventas de este proyecto".

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS active_funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_active_funnel_id_idx
  ON public.clients (active_funnel_id)
  WHERE active_funnel_id IS NOT NULL;
