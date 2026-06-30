-- Equipo por roles (placeholder) para los 3 clientes.
-- Limpia los team_members existentes de Mared / Ikigai / Marcelo y crea
-- 6 roles vacíos por cliente (la persona real se asigna en la app).
-- Idempotente: borra y recrea.

DELETE FROM public.team_members
WHERE client_id IN (SELECT id FROM public.clients WHERE name IN ('Mared Agency','Ikigai Growth','Marcelo Duarte'));

INSERT INTO public.team_members (client_id, nombre, rol, avatar_color, funciones, kpis_custom)
SELECT c.id, r.nombre, r.rol, r.color, r.funciones::jsonb, '{"values":{},"history":{},"custom":[]}'::jsonb
FROM public.clients c
CROSS JOIN (VALUES
  ('Project Manager','project_manager','#6366F1','["Coordinar el equipo y el calendario de entregables","Detectar bloqueos y escalarlos","Llevar la reunión semanal de status con el cliente"]'),
  ('Estratega','strategist','#8B5CF6','["Definir y documentar la estrategia omnicanal","Liderar reuniones de performance","Aprobar creatividades antes de producción"]'),
  ('Trafficker','media_buyer','#06B6D4','["Crear, optimizar y escalar campañas","Gestión diaria de presupuesto y pujas","A/B testing de creatividades y audiencias"]'),
  ('Copy','copywriter','#10B981','["Redactar copies para ADS","Crear scripts para videos y reels","Redactar emails y secuencias de venta"]'),
  ('Líder de Operaciones','funnel_builder','#F59E0B','["Construir y mantener landing pages","Configurar secuencias y automatizaciones","Tracking: píxeles, eventos, UTMs, GA4"]'),
  ('Editor','editor','#EC4899','["Editar videos para reels, ADS y webinars","Montar hooks y VSL","Entregar en formato y calidad acordados"]')
) AS r(nombre, rol, color, funciones)
WHERE c.name IN ('Mared Agency','Ikigai Growth','Marcelo Duarte');

-- Verificación: debe dar 6 por cada cliente
SELECT c.name, count(*) AS roles
FROM public.team_members tm JOIN public.clients c ON c.id = tm.client_id
WHERE c.name IN ('Mared Agency','Ikigai Growth','Marcelo Duarte')
GROUP BY c.name ORDER BY c.name;
