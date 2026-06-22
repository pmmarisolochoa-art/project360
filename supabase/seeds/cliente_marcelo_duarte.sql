-- ============================================================================
-- Carga real: CLIENTE Marcelo Duarte (Lanzamiento Webinar GOBERNA · Jul 2026)
-- Crea: cliente + programa + embudo (4 fases) + ROPRE + 8 tareas + 6 personas.
-- Idempotente: borra y recrea a Marcelo (cascada a sus hijos). Pegar completo y Run.
-- ============================================================================

DELETE FROM public.clients WHERE name = 'Marcelo Duarte';

-- 1) CLIENTE -----------------------------------------------------------------
INSERT INTO public.clients (
  id, agency_id, name, industry, business_type, primary_color, status, project_type,
  onboarding_data, ai_brain_data, metrics, ads_connected, monthly_ads_budget,
  active_funnel_id, created_at, updated_at
) VALUES (
  'a1b2c3d4-0000-4000-8000-000000000001',
  (SELECT agency_id FROM public.clients ORDER BY created_at LIMIT 1),
  'Marcelo Duarte',
  'Transformación digital · Ingeniería/Construcción (AECO)',
  'Educación / Mentoría',
  '#0284C7',
  'active',
  'launch',
  jsonb_build_object(
    'identity', jsonb_build_object(
      'businessName','Marcelo Duarte','founderName','Marcelo Duarte',
      'email','','whatsapp','','industry','Transformación digital · Ingeniería/Construcción',
      'yearsInMarket',35,'country','Argentina','city','',
      'website','https://marceloduartemds.com/espanhol/',
      'socials', jsonb_build_object('linkedin','','instagram','')
    ),
    'business', jsonb_build_object(
      'businessType','Educación / Mentoría (curso asincrónico)',
      'starProduct','Visión Estratégica Aplicada a la Transformación Digital — De BIM a Gemelos Digitales (Método GOBERNA)',
      'averageTicket',497,'currency','USD'
    ),
    'current', jsonb_build_object(
      'monthlyRevenue','Ventas por red de contactos y LinkedIn',
      'bottleneck','Conversión: 39 registros, 0 agendas — audiencia con conciencia baja'
    ),
    'audience', jsonb_build_object(
      'idealClientDescription','Ejecutivos, directores y gerentes en ingeniería y proyectos de capital; técnicos que buscan saltar a un rol estratégico'
    ),
    'goals', jsonb_build_object(
      'revenue3m',10000,'adsBudgetMonthly','','idealStartDate','2026-07-08',
      'launchGoal','300 personas a WhatsApp y USD 10.000 en ventas (~20 a USD 497) en el webinar del 29 jul'
    ),
    'competition', jsonb_build_object(
      'differentiator','No enseña herramientas, enseña a pensar y decidir. Método GOBERNA desde 35+ años de proyectos reales (EPC y O&M).'
    ),
    'content', jsonb_build_object('strategy','Webinar educativo gratuito + ads de captación/recordatorio/venta + comunidad WhatsApp'),
    'team', jsonb_build_object('agency','LaunchXpert LLC')
  ),
  jsonb_build_object(
    'executiveSummary','Marcelo Duarte lanza un webinar educativo (29 jul) para elevar el nivel de conciencia de su audiencia y vender su mentoría "De BIM a Gemelos Digitales" (Método GOBERNA). Meta: 300 personas a WhatsApp y USD 10.000 en ventas a ticket USD 497.',
    'recommendedSystem','launch'
  ),
  jsonb_build_object('roas',null,'pendingTasksToday',0,'nextMeetingAt',null,'progressPercent',5),
  jsonb_build_object('meta',false,'google',false,'tiktok',false,'ga4',false),
  0,
  NULL,
  now(), now()
);

-- 2) PROGRAMA ----------------------------------------------------------------
INSERT INTO public.programs (id, client_id, nombre, tipo, descripcion, fecha_inicio, fecha_evento, fecha_cierre, estado, funnel_template, color, created_at)
VALUES (
  'a1b2c3d4-0000-4000-8000-000000000002',
  'a1b2c3d4-0000-4000-8000-000000000001',
  'Lanzamiento Webinar GOBERNA · Julio 2026',
  'seed_leadmagnet',
  'Webinar educativo gratuito → venta directa de la mentoría por QR. 21 días de captación.',
  '2026-07-08','2026-07-29','2026-08-12','activo','seed_leadmagnet','#0284C7', now()
);

-- 3) EMBUDO + FASES ----------------------------------------------------------
INSERT INTO public.funnels (id, client_id, template_key, name, status, start_date, event_date, end_date, share_token, program_id, created_at)
VALUES (
  'a1b2c3d4-0000-4000-8000-000000000003',
  'a1b2c3d4-0000-4000-8000-000000000001',
  'seed_leadmagnet',
  'Lanzamiento Webinar GOBERNA · Julio 2026',
  'active','2026-07-08','2026-07-29','2026-08-12',
  replace(gen_random_uuid()::text,'-',''),
  'a1b2c3d4-0000-4000-8000-000000000002',
  now()
);

INSERT INTO public.funnel_phases (id, funnel_id, order_idx, name, color, day_start, day_end) VALUES
('a1b2c3d4-0000-4000-8000-000000000011','a1b2c3d4-0000-4000-8000-000000000003',1,'FASE 1 — Lead magnet y captación','#6366F1',0,14),
('a1b2c3d4-0000-4000-8000-000000000012','a1b2c3d4-0000-4000-8000-000000000003',2,'FASE 2 — Captación inmersivo / Webinar','#8B5CF6',14,21),
('a1b2c3d4-0000-4000-8000-000000000013','a1b2c3d4-0000-4000-8000-000000000003',3,'FASE 3 — Evento: Webinar en vivo','#10B981',21,22),
('a1b2c3d4-0000-4000-8000-000000000014','a1b2c3d4-0000-4000-8000-000000000003',4,'FASE 4 — Cierre y post-venta','#F59E0B',22,35);

-- Conectar el embudo activo del cliente (ahora que el embudo ya existe)
UPDATE public.clients SET active_funnel_id='a1b2c3d4-0000-4000-8000-000000000003'
WHERE id='a1b2c3d4-0000-4000-8000-000000000001';

-- 4) TAREAS (las 8 reales de la reunión) -------------------------------------
INSERT INTO public.tasks (id, client_id, title, status, priority, assigned_to, due_date, is_delayed, delay_days, module_tag, tag, subtasks, comments, funnel_id, phase_id, program_id, kpi_nombre, kpi_meta, kpi_tipo, created_at) VALUES
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Organizar cronograma del webinar y compartir por WhatsApp','in_progress','P1','project_manager','2026-07-10',false,0,'funnel','strategy','[]','[]','a1b2c3d4-0000-4000-8000-000000000003','a1b2c3d4-0000-4000-8000-000000000011','a1b2c3d4-0000-4000-8000-000000000002',null,null,'manual',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Grabar 10 anuncios de captación + 3 de recordatorio + anuncios de venta','pending','P1','Marcelo Duarte','2026-07-12',false,0,'funnel','content','[]','[]','a1b2c3d4-0000-4000-8000-000000000003','a1b2c3d4-0000-4000-8000-000000000011','a1b2c3d4-0000-4000-8000-000000000002','Anuncios grabados','13','manual',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Compartir página de ventas actual con el equipo','pending','P2','Marcelo Duarte','2026-07-08',false,0,'funnel','strategy','[]','[]','a1b2c3d4-0000-4000-8000-000000000003','a1b2c3d4-0000-4000-8000-000000000011','a1b2c3d4-0000-4000-8000-000000000002',null,null,'manual',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Crear landing page de registro al webinar','pending','P1','funnel_builder','2026-07-13',false,0,'funnel','deliverable','[]','[]','a1b2c3d4-0000-4000-8000-000000000003','a1b2c3d4-0000-4000-8000-000000000012','a1b2c3d4-0000-4000-8000-000000000002','Landing publicada','1','manual',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Redactar textos (ads de registro + correos de venta)','pending','P2','copywriter','2026-07-13',false,0,'funnel','content','[]','[]','a1b2c3d4-0000-4000-8000-000000000003','a1b2c3d4-0000-4000-8000-000000000012','a1b2c3d4-0000-4000-8000-000000000002',null,null,'manual',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Definir y contratar closer comercial (10% comisión)','pending','P1','project_manager','2026-07-15',false,0,'funnel','strategy','[]','[]','a1b2c3d4-0000-4000-8000-000000000003','a1b2c3d4-0000-4000-8000-000000000012','a1b2c3d4-0000-4000-8000-000000000002',null,null,'manual',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Preparar webinar: presentación + guion','pending','P1','Marcelo Duarte','2026-07-25',false,0,'funnel','deliverable','[]','[]','a1b2c3d4-0000-4000-8000-000000000003','a1b2c3d4-0000-4000-8000-000000000013','a1b2c3d4-0000-4000-8000-000000000002',null,null,'manual',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Consolidar la oferta (bonos + módulos)','pending','P2','strategist','2026-07-14',false,0,'funnel','strategy','[]','[]','a1b2c3d4-0000-4000-8000-000000000003','a1b2c3d4-0000-4000-8000-000000000011','a1b2c3d4-0000-4000-8000-000000000002',null,null,'manual',now());

-- 5) ROPRE -------------------------------------------------------------------
INSERT INTO public.ropre_items (id, client_id, type, title, description, risk_level, mitigation, status, created_at) VALUES
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','result','Webinar 29 jul: 300 personas a WhatsApp y USD 10.000 en ventas (~20 a USD 497)',null,null,null,null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','objective','300 registros a la comunidad de WhatsApp',null,null,null,null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','objective','21 días de captación antes del evento',null,null,null,null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','objective','Contratar closer comercial (10% comisión)',null,null,null,null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','objective','Landing + ads de captación/recordatorio/venta listos',null,null,null,null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','premise','Audiencia con nivel de conciencia bajo → el webinar educa antes de vender',null,null,null,null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','premise','Evitar fechas del Mundial (no 19 jul) para no competir por atención',null,null,null,null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','premise','Venta directa por QR durante el webinar (sin agendamiento de llamadas)',null,null,null,null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','risk','Cuello de botella de conversión: 39 registros generaron 0 agendas','El webinar educativo debería elevar la conciencia y mejorar la conversión','medium','Webinar + nurturing en WhatsApp antes de presentar la oferta',null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','risk','Atención dispersa por el Mundial durante la captación',null,'high','Calendarizar el evento al 29 jul, después de las fechas clave del Mundial',null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','risk','Dependencia de Marcelo para grabar ads y preparar el webinar',null,'medium','Bloquear agenda de grabación temprano y dar guion listo para acelerar',null,now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','deliverable','Landing page de registro al webinar',null,null,null,'todo',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','deliverable','Comunidad de WhatsApp configurada',null,null,null,'todo',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','deliverable','10 ads captación + 3 recordatorio + ads de venta',null,null,null,'todo',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','deliverable','Presentación + guion del webinar',null,null,null,'todo',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','deliverable','Oferta consolidada (bonos + módulos)',null,null,null,'todo',now());

-- 6) EQUIPO (6 personas por rol) ---------------------------------------------
INSERT INTO public.team_members (id, client_id, nombre, rol, email, avatar_color, funciones, kpis_custom, created_at) VALUES
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Rodrigo Hevia','project_manager',null,'#6366F1','["Coordinar el equipo y el calendario de entregables","Detectar bloqueos y escalarlos","Llevar la reunión semanal de status con el cliente"]','{"values":{},"history":{},"custom":[]}',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Agustín Figueroa','strategist',null,'#8B5CF6','["Definir y documentar la estrategia omnicanal","Liderar reuniones de performance","Aprobar creatividades antes de producción"]','{"values":{},"history":{},"custom":[]}',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Trafficker','media_buyer',null,'#06B6D4','["Crear, optimizar y escalar campañas en Meta/Google/TikTok","Gestión diaria de presupuesto y pujas","A/B testing de creatividades y audiencias"]','{"values":{},"history":{},"custom":[]}',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Copy','copywriter',null,'#10B981','["Redactar copies para ADS","Crear scripts para videos y reels","Redactar emails y secuencias de venta"]','{"values":{},"history":{},"custom":[]}',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Líder de Operaciones','funnel_builder',null,'#F59E0B','["Construir y mantener landing pages","Configurar secuencias y automatizaciones","Tracking: píxeles, eventos, UTMs, GA4"]','{"values":{},"history":{},"custom":[]}',now()),
(gen_random_uuid(),'a1b2c3d4-0000-4000-8000-000000000001','Editor','editor',null,'#EC4899','["Editar videos para reels, ADS y webinars","Montar hooks y VSL","Entregar en formato y calidad acordados"]','{"values":{},"history":{},"custom":[]}',now());

-- Verificación
SELECT 'cliente' AS tabla, count(*) FROM public.clients WHERE name='Marcelo Duarte'
UNION ALL SELECT 'programa', count(*) FROM public.programs WHERE client_id='a1b2c3d4-0000-4000-8000-000000000001'
UNION ALL SELECT 'fases', count(*) FROM public.funnel_phases WHERE funnel_id='a1b2c3d4-0000-4000-8000-000000000003'
UNION ALL SELECT 'tareas', count(*) FROM public.tasks WHERE client_id='a1b2c3d4-0000-4000-8000-000000000001'
UNION ALL SELECT 'ropre', count(*) FROM public.ropre_items WHERE client_id='a1b2c3d4-0000-4000-8000-000000000001'
UNION ALL SELECT 'equipo', count(*) FROM public.team_members WHERE client_id='a1b2c3d4-0000-4000-8000-000000000001';
