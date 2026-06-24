-- 017_agent_conversations.sql
-- Agente PM (Nivel 1) · Sección 2 — Historial de conversación del agente por cliente.
-- Persistimos el chat para mantener contexto entre sesiones. client_id (sin agencia_id).
-- Idempotente: seguro de correr varias veces.

CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  agente     text NOT NULL,            -- 'pm', etc. (coincide con agent_prompts.agente)
  role       text NOT NULL,            -- 'user' | 'assistant'
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Índice para cargar rápido los últimos N mensajes de un cliente + agente.
CREATE INDEX IF NOT EXISTS idx_agent_conversations_client_agente
  ON public.agent_conversations (client_id, agente, created_at);

-- RLS: mismo patrón permisivo que el resto de tablas en beta (ver 002/004).
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_conversations'
      AND policyname = 'agent_conversations_all'
  ) THEN
    CREATE POLICY agent_conversations_all ON public.agent_conversations
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
