-- Restaura las funciones COMPLETAS por rol (las que tenía el sistema antes).
-- UPDATE: solo cambia 'funciones', conserva nombre/email/KPIs ya asignados.
-- Aplica a los team_members de Mared / Ikigai / Marcelo.

UPDATE public.team_members tm
SET funciones = r.funciones::jsonb
FROM (VALUES
  ('project_manager', '["Coordinar el equipo y el calendario de entregables del cliente","Mantener actualizado el ROPRE y el roadmap de cada embudo","Detectar bloqueos y escalarlos al estratega o al cliente","Asegurar que las tareas se entreguen dentro del rango de fechas comprometido","Llevar la reunión semanal de status con el cliente"]'),
  ('strategist', '["Definir y documentar la estrategia omnicanal del cliente","Supervisar el cumplimiento del ROPRE","Liderar reuniones semanales de performance","Identificar oportunidades de upsell y nuevos ángulos estratégicos","Aprobar creatividades antes de pasar a producción","Analizar benchmarks del sector y actualizarlos mensualmente"]'),
  ('media_buyer', '["Crear, optimizar y escalar campañas en Meta, Google, TikTok","Gestión diaria de presupuesto y ajuste de pujas","A/B testing de creatividades y audiencias","Reportes semanales de performance","Investigación de audiencias y nuevos segmentos","Análisis de competencia en pauta (AdLibrary, SimilarWeb)"]'),
  ('copywriter', '["Redactar copies para ADS (headlines, body, CTA)","Crear scripts para videos y reels","Redactar emails y secuencias de nurturing","Desarrollar ángulos por buyer persona","Mantener banco de copies aprobados y rechazados","Investigación de keywords y lenguaje del mercado"]'),
  ('designer', '["Crear creatividades para ADS (estáticas, carruseles, motion)","Diseñar contenido orgánico según calendario","Mantener coherencia con manual de marca","Crear templates reutilizables","Edición básica de video para reels y stories","Revisión y feedback de assets de terceros"]'),
  ('community', '["Publicar y programar contenido en todas las plataformas","Gestión diaria de comentarios, DMs y menciones","Monitoreo de reputación online","Reportes semanales de métricas orgánicas","Estrategia de engagement con seguidores","Investigación de tendencias y hashtags","Coordinación con diseñador y copy"]'),
  ('funnel_builder', '["Construir y mantener landing pages","Configurar secuencias de email y automatizaciones","Integrar herramientas (CRM, email, ADS, analytics)","Testing y optimización de conversión (CRO)","Tracking: píxeles, eventos, UTMs, GA4","Documentación técnica del stack"]'),
  ('editor', '["Editar videos para reels, ADS y webinars","Ajustar testimonios y clips según briefing","Montar hooks y VSL según estrategia definida","Color grading y mezcla de audio básica","Entregar en formato y calidad acordados"]'),
  ('closer', '["Liderar llamadas de cierre y ventas","Coordinar equipo de setters y confirmadores","Seguimiento a leads calificados","Reportes de métricas comerciales","Mejorar scripts de ventas y manejo de objeciones"]'),
  ('onboarding', '["Ejecutar onboarding de nuevos compradores del cliente","Seguimiento de satisfacción post-compra","Coordinar accesos a plataformas (Skool, Telegram, etc.)","Comunicar novedades a la comunidad","Atender soporte de primer nivel"]')
) AS r(rol, funciones)
WHERE tm.rol = r.rol
  AND tm.client_id IN (SELECT id FROM public.clients WHERE name IN ('Mared Agency','Ikigai Growth','Marcelo Duarte'));

-- Verificación: nº de funciones por rol (debe ser 5-7)
SELECT rol, jsonb_array_length(funciones) AS n_funciones
FROM public.team_members
WHERE client_id IN (SELECT id FROM public.clients WHERE name IN ('Mared Agency','Ikigai Growth','Marcelo Duarte'))
GROUP BY rol, funciones ORDER BY rol;
