-- ════════════════════════════════════════════════════════════════════════════
-- SEED: 2 clientes de prueba para la beta — Mared Agency + Ikigai Growth
-- ════════════════════════════════════════════════════════════════════════════
--
-- Cómo correr:
--   Supabase Dashboard → SQL Editor → New query → pegar TODO este archivo → Run
--
-- Idempotente: usa ON CONFLICT DO NOTHING en clientes/funnels y
-- evita duplicar tareas/ROPRE comparando por título. Si los corres dos
-- veces no se rompe nada, pero tampoco actualiza data existente — si
-- quieres regenerar, borra primero los clientes con esos nombres.
--
-- IMPORTANTE: requiere que ya estén aplicadas todas las migraciones
-- 001 a 012 (especialmente 012_client_active_funnel.sql).

-- ── Paso 0: agencia placeholder si no existe ───────────────────────────────
-- Reusa cualquier agencia existente; si no hay ninguna, crea una mínima.
do $$
declare
  v_agency_id uuid;
begin
  select id into v_agency_id from public.agencies order by created_at asc limit 1;
  if v_agency_id is null then
    insert into public.agencies (id, name, owner_user_id)
    values (gen_random_uuid(), 'Agencia Demo', null)
    returning id into v_agency_id;
    raise notice 'Created placeholder agency %', v_agency_id;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- CLIENTE 1: Mared Agency (Lanzamiento Semilla + Lead Magnet)
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_agency_id uuid;
  v_client_id uuid;
  v_funnel_id uuid;
  v_phase1_id uuid;
  v_phase2_id uuid;
  v_phase3_id uuid;
  v_phase4_id uuid;
  v_now timestamptz := now();
  v_start timestamptz := now() - interval '10 days';
begin
  select id into v_agency_id from public.agencies order by created_at asc limit 1;

  -- Cliente (idempotente por nombre)
  select id into v_client_id from public.clients where name = 'Mared Agency' limit 1;
  if v_client_id is null then
    v_client_id := gen_random_uuid();
    insert into public.clients (
      id, agency_id, name, industry, business_type, primary_color,
      status, project_type, onboarding_data, ai_brain_data, ads_connected,
      monthly_ads_budget, metrics, created_at, updated_at
    ) values (
      v_client_id, v_agency_id, 'Mared Agency', 'Agencia de marketing', 'agencia',
      '#8B5CF6', 'active', 'launch',
      '{"identity": {"businessName": "Mared Agency", "founderName": "Mared Team", "email": "demo@mared.agency", "industry": "Agencia de marketing", "country": "Colombia"}}'::jsonb,
      '{"executiveSummary": "Agencia de marketing digital especializada en crecimiento orgánico y paid media para marcas LATAM. Cliente demo de Project360."}'::jsonb,
      '{"meta": true, "google": false, "tiktok": false, "ga4": true}'::jsonb,
      1500, '{"roas": 3.2, "pendingTasksToday": 4, "nextMeetingAt": null, "progressPercent": 35}'::jsonb,
      v_start, v_now
    );
    raise notice 'Created client Mared Agency %', v_client_id;
  end if;

  -- Embudo Lanzamiento Semilla (idempotente)
  select id into v_funnel_id from public.funnels where client_id = v_client_id and template_key = 'seed_leadmagnet' limit 1;
  if v_funnel_id is null then
    v_funnel_id := gen_random_uuid();
    insert into public.funnels (id, client_id, template_key, name, status, start_date, event_date, end_date, share_token, created_at)
    values (
      v_funnel_id, v_client_id, 'seed_leadmagnet', 'Lanzamiento Semilla Q3', 'active',
      v_start, v_start + interval '28 days', v_start + interval '45 days',
      gen_random_uuid()::text, v_start
    );

    -- 4 fases
    v_phase1_id := gen_random_uuid();
    v_phase2_id := gen_random_uuid();
    v_phase3_id := gen_random_uuid();
    v_phase4_id := gen_random_uuid();
    insert into public.funnel_phases (id, funnel_id, order_idx, name, color, day_start, day_end) values
      (v_phase1_id, v_funnel_id, 1, 'FASE 1 — LEAD MAGNET Y CAPTACIÓN',   '#6366F1', 1, 18),
      (v_phase2_id, v_funnel_id, 2, 'FASE 2 — CAPTACIÓN INMERSIVO',       '#8B5CF6', 12, 28),
      (v_phase3_id, v_funnel_id, 3, 'FASE 3 — EVENTO: EN VIVOS / WEBINAR','#EC4899', 26, 35),
      (v_phase4_id, v_funnel_id, 4, 'FASE 4 — CIERRE Y POST-VENTA',       '#10B981', 33, 45);

    -- 5 tareas en distintos estados (las "completed" son retro-fechadas)
    insert into public.tasks (
      client_id, title, status, priority, assigned_to, due_date, completed_at,
      module_tag, funnel_id, phase_id, created_at
    ) values
      (v_client_id, 'Definir tema y promesa del Lead Magnet', 'completed', 'P1',
       'strategist', v_start + interval '2 days', v_start + interval '2 days',
       'funnel', v_funnel_id, v_phase1_id, v_start),
      (v_client_id, 'Crear Lead Magnet (ebook/checklist)', 'completed', 'P1',
       'copywriter', v_start + interval '5 days', v_start + interval '6 days',
       'funnel', v_funnel_id, v_phase1_id, v_start),
      (v_client_id, 'Configurar página de captura + video 1 min', 'in_progress', 'P1',
       'funnel_builder', v_start + interval '7 days', null,
       'funnel', v_funnel_id, v_phase1_id, v_start),
      (v_client_id, 'Grabar 10 anuncios tipo reels', 'in_progress', 'P1',
       'editor', v_start + interval '10 days', null,
       'funnel', v_funnel_id, v_phase1_id, v_start),
      (v_client_id, 'Lanzar campañas captación Lead Magnet', 'pending', 'P1',
       'media_buyer', v_start + interval '10 days', null,
       'funnel', v_funnel_id, v_phase1_id, v_start)
    on conflict do nothing;

    -- Apunta active_funnel_id al embudo recién creado
    update public.clients set active_funnel_id = v_funnel_id where id = v_client_id;
  end if;

  -- 1 reunión futura
  if not exists (select 1 from public.meetings where client_id = v_client_id and title = 'Kickoff Lanzamiento Semilla') then
    insert into public.meetings (client_id, title, type, scheduled_at, duration_min, agenda)
    values (v_client_id, 'Kickoff Lanzamiento Semilla', 'kickoff', v_now + interval '3 days', 60,
            'Revisión de objetivos del lanzamiento, accesos y compromisos primeros 14 días.');
  end if;

  -- ROPRE básico
  insert into public.ropre_items (client_id, type, title, description)
  select v_client_id, 'result', 'Crecimiento mensual de revenue 30%',
         'Resultado clave del trimestre — referencia para todos los objetivos.'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title = 'Crecimiento mensual de revenue 30%'
  );
  insert into public.ropre_items (client_id, type, title)
  select v_client_id, 'objective', 'Lanzar primer Lead Magnet con 500 leads'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title = 'Lanzar primer Lead Magnet con 500 leads'
  );
  insert into public.ropre_items (client_id, type, title)
  select v_client_id, 'objective', 'Cerrar 5 ventas del programa flagship'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title = 'Cerrar 5 ventas del programa flagship'
  );
  insert into public.ropre_items (client_id, type, title, description)
  select v_client_id, 'premise', 'La audiencia de Mared responde mejor a contenido educativo que promocional',
         'Validado con engagement orgánico de los últimos 90 días.'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title like 'La audiencia de Mared%'
  );
  insert into public.ropre_items (client_id, type, title, risk_level, mitigation)
  select v_client_id, 'risk', 'Algoritmo de Meta puede penalizar contenido del nicho', 'medium',
         'Diversificar a TikTok y email marketing como canales redundantes.'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title like 'Algoritmo de Meta%'
  );
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- CLIENTE 2: Ikigai Growth (Evergreen / Social Funnel)
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_agency_id uuid;
  v_client_id uuid;
  v_funnel_id uuid;
  v_phase1_id uuid;
  v_phase2_id uuid;
  v_now timestamptz := now();
  v_start timestamptz := now() - interval '5 days';
begin
  select id into v_agency_id from public.agencies order by created_at asc limit 1;

  select id into v_client_id from public.clients where name = 'Ikigai Growth' limit 1;
  if v_client_id is null then
    v_client_id := gen_random_uuid();
    insert into public.clients (
      id, agency_id, name, industry, business_type, primary_color,
      status, project_type, onboarding_data, ai_brain_data, ads_connected,
      monthly_ads_budget, metrics, created_at, updated_at
    ) values (
      v_client_id, v_agency_id, 'Ikigai Growth', 'Consultoría', 'consultoria',
      '#10B981', 'active', 'evergreen',
      '{"identity": {"businessName": "Ikigai Growth", "founderName": "Marisol Ochoa", "email": "ikigaigrowthmarketing@gmail.com", "industry": "Consultoría", "country": "Colombia"}}'::jsonb,
      '{"executiveSummary": "Consultoría de growth marketing para founders LATAM. Marca personal de Marisol. Cliente demo de Project360."}'::jsonb,
      '{"meta": true, "google": true, "tiktok": false, "ga4": true}'::jsonb,
      2500, '{"roas": 4.1, "pendingTasksToday": 2, "nextMeetingAt": null, "progressPercent": 60}'::jsonb,
      v_start, v_now
    );
    raise notice 'Created client Ikigai Growth %', v_client_id;
  end if;

  -- Embudo Evergreen
  select id into v_funnel_id from public.funnels where client_id = v_client_id and template_key = 'evergreen_social' limit 1;
  if v_funnel_id is null then
    v_funnel_id := gen_random_uuid();
    insert into public.funnels (id, client_id, template_key, name, status, start_date, event_date, end_date, share_token, created_at)
    values (
      v_funnel_id, v_client_id, 'evergreen_social', 'Evergreen Ikigai 2026', 'active',
      v_start, null, v_start + interval '60 days',
      gen_random_uuid()::text, v_start
    );

    v_phase1_id := gen_random_uuid();
    v_phase2_id := gen_random_uuid();
    insert into public.funnel_phases (id, funnel_id, order_idx, name, color, day_start, day_end) values
      (v_phase1_id, v_funnel_id, 1, 'FASE 1 — SETUP INICIAL',           '#6366F1', 1, 21),
      (v_phase2_id, v_funnel_id, 2, 'FASE 2 — OPERACIÓN MENSUAL',       '#10B981', 22, 60);

    insert into public.tasks (
      client_id, title, status, priority, assigned_to, due_date, completed_at,
      module_tag, funnel_id, phase_id, created_at
    ) values
      (v_client_id, 'Instalar y verificar pixel Meta + Google Ads', 'completed', 'P1',
       'media_buyer', v_start + interval '3 days', v_start + interval '3 days',
       'funnel', v_funnel_id, v_phase1_id, v_start),
      (v_client_id, 'Crear landing de ventas con VSL', 'in_progress', 'P1',
       'funnel_builder', v_start + interval '14 days', null,
       'funnel', v_funnel_id, v_phase1_id, v_start),
      (v_client_id, 'Configurar secuencia email nurturing (5 pasos)', 'in_progress', 'P1',
       'copywriter', v_start + interval '14 days', null,
       'funnel', v_funnel_id, v_phase1_id, v_start),
      (v_client_id, 'Lanzar campañas ADS iniciales', 'pending', 'P1',
       'media_buyer', v_start + interval '18 days', null,
       'funnel', v_funnel_id, v_phase1_id, v_start),
      (v_client_id, 'Crear 12 reels de contenido (3 por semana)', 'pending', 'P2',
       'community', v_start + interval '60 days', null,
       'funnel', v_funnel_id, v_phase2_id, v_start)
    on conflict do nothing;

    update public.clients set active_funnel_id = v_funnel_id where id = v_client_id;
  end if;

  -- 1 reunión pasada (status efectivo: ya ocurrió)
  if not exists (select 1 from public.meetings where client_id = v_client_id and title = 'Revisión semanal performance') then
    insert into public.meetings (client_id, title, type, scheduled_at, duration_min, agenda, transcription)
    values (v_client_id, 'Revisión semanal performance', 'weekly_metrics',
            v_now - interval '2 days', 45,
            'Revisar métricas de la semana, ajustar pauta, definir prioridades.',
            'Resumen: ROAS subió a 4.1x. CPL bajó 18%. Decidimos escalar campaña ganadora 25% y matar variante de creativo C.');
  end if;

  -- ROPRE básico
  insert into public.ropre_items (client_id, type, title, description)
  select v_client_id, 'result', 'Sistema evergreen activo con ROAS 4x sostenido',
         'Hito clave alcanzado el último trimestre.'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title like 'Sistema evergreen%'
  );
  insert into public.ropre_items (client_id, type, title, target_value)
  select v_client_id, 'objective', 'Escalar inversión mensual a $5K manteniendo ROAS', '$5,000/mes ROAS 4x'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title like 'Escalar inversión%'
  );
  insert into public.ropre_items (client_id, type, title, description)
  select v_client_id, 'premise', 'El público de consultoría B2B convierte mejor con video corto que con carrusel',
         'Validado A/B test marzo 2026.'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title like 'El público de consultoría%'
  );
  insert into public.ropre_items (client_id, type, title, risk_level, mitigation)
  select v_client_id, 'risk', 'Saturación del nicho consultoría puede subir CPL', 'medium',
         'Diversificar oferta con tier alto (Premium 1:1) y ticket bajo (curso digital).'
  where not exists (
    select 1 from public.ropre_items where client_id = v_client_id and title like 'Saturación del nicho%'
  );
end $$;

-- ── Verificación ───────────────────────────────────────────────────────────
select 'Mared Agency' as client, count(*) as task_count
  from public.tasks t join public.clients c on c.id = t.client_id
  where c.name = 'Mared Agency'
union all
select 'Ikigai Growth', count(*)
  from public.tasks t join public.clients c on c.id = t.client_id
  where c.name = 'Ikigai Growth';
