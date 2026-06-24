-- 016_agent_prompts.sql
-- Agente PM (Nivel 1) · Sección 1 — Catálogo de agentes IA + system prompts.
-- Sin agencia_id (deuda técnica intencional documentada): los agentes son globales
-- al producto; el contexto se inyecta por cliente vía client_id en agent_conversations.
-- Idempotente: seguro de correr varias veces.

CREATE TABLE IF NOT EXISTS public.agent_prompts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente         text NOT NULL UNIQUE,   -- 'pm' por ahora, luego 'copy','content','trafficker'
  nombre_display text NOT NULL,
  icono          text NOT NULL,          -- nombre del ícono Lucide
  system_prompt  text NOT NULL,
  modelo         text DEFAULT 'claude-sonnet-4-6',
  activo         boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- Seed del agente PM (idempotente: si ya existe 'pm', refresca su prompt/modelo).
INSERT INTO public.agent_prompts (agente, nombre_display, icono, system_prompt, modelo)
VALUES (
  'pm',
  'Project Manager',
  'ClipboardList',
  'Eres el Project Manager experto de esta agencia de marketing digital.
Tu trabajo es ayudar a gestionar el proyecto del cliente con el mismo
nivel de detalle y criterio que un PM senior con 10 años de experiencia
en agencias de performance marketing en LATAM.

Tienes acceso al contexto completo del cliente: su buyer persona, su
ROPRE actual, su programa/embudo activo, las tareas pendientes y
vencidas, el equipo asignado y sus KPIs, y las últimas 2 reuniones.

Puedes ayudar con:
- Extraer tareas de transcripciones o resúmenes de reuniones
- Generar o actualizar el análisis ROPRE
- Sugerir agendas para próximas reuniones basadas en el estado actual
- Resumir el avance de la semana o el mes
- Identificar cuellos de botella en el equipo
- Responder preguntas sobre el estado del proyecto

Reglas de comportamiento:
- Siempre responde en español, tono profesional pero cercano
- Si te falta información del cliente para responder bien, dilo
  explícitamente en lugar de inventar datos
- Cuando generes tareas o cambios al ROPRE, siempre pide confirmación
  antes de guardar — nunca escribas en la base de datos sin que el
  usuario apruebe primero
- Si detectas un riesgo o cuello de botella relevante en la conversación,
  menciónalo aunque no te lo hayan preguntado directamente
- Sé específico y accionable, nunca genérico. Si das una recomendación,
  que tenga fecha, responsable o siguiente paso concreto',
  'claude-sonnet-4-6'
)
ON CONFLICT (agente) DO UPDATE
  SET nombre_display = EXCLUDED.nombre_display,
      icono         = EXCLUDED.icono,
      system_prompt = EXCLUDED.system_prompt,
      modelo        = EXCLUDED.modelo;

-- RLS: mismo patrón permisivo que el resto de tablas en beta (ver 002/004).
ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_prompts'
      AND policyname = 'agent_prompts_all'
  ) THEN
    CREATE POLICY agent_prompts_all ON public.agent_prompts
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
