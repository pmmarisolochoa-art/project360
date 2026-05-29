-- ──────────────────────────────────────────────────────────────────────────
--  Migración 003: seed data
--
--  Inserta los 3 clientes demo (FitMind, Kuroko, Escuela Digital) +
--  9 tareas + 4 reuniones que vienen del seed in-memory de la app.
--
--  Las fechas se calculan relativas a NOW() para que siempre se vean
--  "frescas" cuando se cargue. Idempotente: borra y re-inserta.
-- ──────────────────────────────────────────────────────────────────────────

-- UUIDs deterministas para que la app pueda referirse a estos registros
-- por ID en pruebas locales.
--   agency:                  00000000-0000-0000-0000-0000000000a1
--   owner (Marisol):         00000000-0000-0000-0000-0000000000f1
--   fitmind:                 00000000-0000-0000-0000-0000000000c1
--   kuroko:                  00000000-0000-0000-0000-0000000000c2
--   escuela digital:         00000000-0000-0000-0000-0000000000c3

-- Limpieza previa (idempotencia)
delete from public.tasks    where client_id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000c3'
);
delete from public.meetings where client_id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000c3'
);
delete from public.clients  where id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000c3'
);
delete from public.agencies where id = '00000000-0000-0000-0000-0000000000a1';
delete from public.users    where id = '00000000-0000-0000-0000-0000000000f1';

-- ── USER (owner de la agencia) ────────────────────────────────────────────
insert into public.users (id, email, name, role, timezone)
values (
  '00000000-0000-0000-0000-0000000000f1',
  'estratega@salesbrain.os',
  'Marisol Ochoa',
  'owner',
  'America/Bogota'
);

-- ── AGENCY ────────────────────────────────────────────────────────────────
insert into public.agencies (id, name, owner_id, plan)
values (
  '00000000-0000-0000-0000-0000000000a1',
  'Sales Brain Agency',
  '00000000-0000-0000-0000-0000000000f1',
  'starter'
);

-- ── CLIENTES ──────────────────────────────────────────────────────────────

-- FitMind Colombia (activo, ratio 1.08 → verde)
insert into public.clients (
  id, agency_id, name, industry, business_type, primary_color,
  status, project_type, monthly_ads_budget,
  ads_connected, metrics, onboarding_data, ai_brain_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000a1',
  'FitMind Colombia',
  'Salud & Bienestar',
  'Coaching / Mentoría',
  '#6366F1',
  'active', 'personal_brand', 1200,
  '{"meta":true,"google":false,"tiktok":false,"ga4":true}'::jsonb,
  jsonb_build_object(
    'roas', 3.4,
    'pendingTasksToday', 4,
    'nextMeetingAt', (now() + interval '5 hours')::text,
    'progressPercent', 62,
    'bottleneck', null,
    'invertedThisMonth', 1180,
    'salesCount', 18,
    'revenueAccumulated', 4860,
    'monthlyRevenueTarget', 4500
  ),
  '{"identity":{"businessName":"FitMind Colombia","founderName":"Laura Restrepo","email":"laura@fitmind.co","whatsapp":"+57 300 123 4567","industry":"Salud & Bienestar","yearsInMarket":4,"country":"Colombia","city":"Medellín","website":"https://fitmind.co","socials":{"instagram":"@fitmind.co","tiktok":"@fitmind"}}}'::jsonb,
  '{"executiveSummary":"FitMind es una marca personal de coaching en nutrición consciente y regulación del sistema nervioso, con 4 años de trayectoria. Su fundadora Laura posiciona la marca con tono empático y educativo, atrayendo mujeres profesionales de 28-45 años que buscan bienestar sostenible sin dietas restrictivas."}'::jsonb,
  now() - interval '14 days',
  now()
);

-- Kuroko Studio (planificación, ratio 0.81 → amarillo)
insert into public.clients (
  id, agency_id, name, industry, business_type, primary_color,
  status, project_type, monthly_ads_budget,
  ads_connected, metrics, onboarding_data, ai_brain_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000a1',
  'Kuroko Studio',
  'Moda & Streetwear',
  'D2C Ecommerce',
  '#8B5CF6',
  'planning', 'ecommerce', 800,
  '{"meta":false,"google":false,"tiktok":false,"ga4":false}'::jsonb,
  jsonb_build_object(
    'roas', null,
    'pendingTasksToday', 2,
    'nextMeetingAt', (now() + interval '1 day 3 hours')::text,
    'progressPercent', 18,
    'bottleneck', jsonb_build_object('role','Media Buyer','reason','Pendiente acceso a Business Manager'),
    'invertedThisMonth', 540,
    'salesCount', 6,
    'revenueAccumulated', 1620,
    'monthlyRevenueTarget', 2000
  ),
  '{"identity":{"businessName":"Kuroko Studio","founderName":"Andrés Salazar","email":"andres@kuroko.studio","whatsapp":"+57 320 987 6543","industry":"Moda & Streetwear","yearsInMarket":2,"country":"Colombia","city":"Bogotá","website":"https://kuroko.studio","socials":{"instagram":"@kuroko.studio","tiktok":"@kurokostudio"}}}'::jsonb,
  '{}'::jsonb,
  now() - interval '7 days',
  now()
);

-- Escuela Digital Pro (onboarding, sin target → sin color)
insert into public.clients (
  id, agency_id, name, industry, business_type, primary_color,
  status, project_type, monthly_ads_budget,
  ads_connected, metrics, onboarding_data, ai_brain_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000a1',
  'Escuela Digital Pro',
  'EdTech',
  'Infoproducto / Curso',
  '#06B6D4',
  'onboarding', 'launch', 3500,
  '{"meta":false,"google":false,"tiktok":false,"ga4":false}'::jsonb,
  jsonb_build_object(
    'roas', null,
    'pendingTasksToday', 6,
    'nextMeetingAt', (now() + interval '26 hours')::text,
    'progressPercent', 8,
    'bottleneck', jsonb_build_object('role','Estratega','reason','Falta validar oferta principal'),
    'invertedThisMonth', 0,
    'salesCount', 0,
    'revenueAccumulated', 0,
    'monthlyRevenueTarget', null
  ),
  '{"identity":{"businessName":"Escuela Digital Pro","founderName":"Camila Torres","email":"camila@escueladigital.pro","whatsapp":"+52 55 8123 9090","industry":"EdTech / Marketing","yearsInMarket":3,"country":"México","city":"CDMX","socials":{"instagram":"@escueladigital.pro","youtube":"EscuelaDigitalPro"}}}'::jsonb,
  '{}'::jsonb,
  now() - interval '1 day',
  now()
);

-- ── REUNIONES ─────────────────────────────────────────────────────────────

insert into public.meetings (
  client_id, title, type, scheduled_at, duration_min, participants,
  agenda, video_call_link, notes, notes_updated_at
) values
('00000000-0000-0000-0000-0000000000c1',
 'Revisión semanal de métricas', 'weekly_metrics',
 now() + interval '5 hours', 45,
 '[{"userId":"00000000-0000-0000-0000-0000000000f1","name":"Marisol"},{"userId":"u_c1","name":"Laura"}]'::jsonb,
 E'1. Revisión de métricas de la semana\n2. Análisis de campañas activas\n3. Ajustes de presupuesto\n4. Próximos pasos y compromisos',
 'https://meet.google.com/abc-defg-hij',
 'Última semana ROAS subió a 3.4x. Pendiente decidir si escalamos el ad set "Regulación nerviosa".',
 now() - interval '1 day');

insert into public.meetings (client_id, title, type, scheduled_at, duration_min, participants)
values
('00000000-0000-0000-0000-0000000000c2',
 'Sesión estratégica de contenido', 'content_strategy',
 now() + interval '1 day 3 hours', 60,
 '[{"userId":"00000000-0000-0000-0000-0000000000f1","name":"Marisol"},{"userId":"u_c2","name":"Andrés"}]'::jsonb),

('00000000-0000-0000-0000-0000000000c3',
 'Kickoff de lanzamiento', 'kickoff',
 now() + interval '2 days 2 hours', 90,
 '[{"userId":"00000000-0000-0000-0000-0000000000f1","name":"Marisol"},{"userId":"u_c3","name":"Camila"}]'::jsonb),

('00000000-0000-0000-0000-0000000000c1',
 'Revisión de campañas ADS', 'ads_review',
 now() + interval '3 days 4 hours', 30,
 '[{"userId":"00000000-0000-0000-0000-0000000000f1","name":"Marisol"}]'::jsonb);

-- ── TAREAS ────────────────────────────────────────────────────────────────

insert into public.tasks (
  client_id, title, description, status, priority, assigned_to,
  due_date, completed_at, is_delayed, delay_days, module_tag, created_at
) values
('00000000-0000-0000-0000-0000000000c1',
 'Optimizar copy del Reel #34',
 'Reescribir hook usando lenguaje del avatar principal.',
 'in_progress', 'P1', 'Laura Mejía',
 now() + interval '6 hours', null, false, 0, 'content', now() - interval '2 days'),

('00000000-0000-0000-0000-0000000000c2',
 'Solicitar acceso a Business Manager',
 'Sin acceso no podemos lanzar campañas — bloquea fase 1.',
 'blocked', 'P1', 'Diego Ramírez',
 now() - interval '1 day', null, true, 1, 'ads', now() - interval '5 days'),

('00000000-0000-0000-0000-0000000000c1',
 'Revisar performance de campaña Awareness',
 null, 'pending', 'P2', 'Diego Ramírez',
 now() + interval '1 day', null, false, 0, 'ads', now() - interval '1 day'),

('00000000-0000-0000-0000-0000000000c1',
 'Aprobar storyboard del Reel "regulación nerviosa"',
 null, 'in_review', 'P2', 'Marisol Ochoa',
 now() + interval '3 hours', null, false, 0, 'content', now() - interval '3 days'),

('00000000-0000-0000-0000-0000000000c1',
 'Setup tracking conversiones GA4',
 null, 'completed', 'P1', 'Diego Ramírez',
 now() - interval '2 days', now() - interval '1 day', false, 0, 'tech', now() - interval '7 days'),

('00000000-0000-0000-0000-0000000000c2',
 'Definir 3 ángulos de comunicación iniciales',
 null, 'in_progress', 'P1', 'Camila Mora',
 now() + interval '2 days', null, false, 0, 'strategy', now() - interval '2 days'),

('00000000-0000-0000-0000-0000000000c3',
 'Validar oferta principal con 5 clientes pasados',
 null, 'pending', 'P1', 'Marisol Ochoa',
 now() + interval '3 days', null, false, 0, 'strategy', now() - interval '1 day'),

('00000000-0000-0000-0000-0000000000c3',
 'Definir cuenta regresiva del lanzamiento (45 días)',
 null, 'in_progress', 'P2', 'Marisol Ochoa',
 now() + interval '5 days', null, false, 0, 'launch', now() - interval '1 day'),

('00000000-0000-0000-0000-0000000000c1',
 'Cerrar contrato con diseñadora freelance',
 null, 'pending', 'P3', 'Marisol Ochoa',
 now() + interval '7 days', null, false, 0, 'ops', now() - interval '1 day');
