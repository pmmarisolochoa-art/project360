-- Restaurar políticas existentes sin cambiar datos ni asignaciones.
set lock_timeout = '5s';
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.agencies enable row level security;
alter table public.ad_metrics_snapshots enable row level security;
alter table public.notifications enable row level security;
alter table public.client_team_members enable row level security;
alter table public.content_pieces enable row level security;
alter table public.projections enable row level security;
alter table public.tasks enable row level security;

-- Las políticas de negocio requieren una sesión; el portal público usa su RPC.
alter policy "users_self" on public.users to authenticated;
alter policy "agencies_owner" on public.agencies to authenticated;
alter policy "clients_via_agency" on public.clients to authenticated;
alter policy "ropre_via_client" on public.ropre_items to authenticated;
alter policy "team_via_client" on public.client_team_members to authenticated;
alter policy "content_via_client" on public.content_pieces to authenticated;
alter policy "projections_via_client" on public.projections to authenticated;
alter policy "notifications_own" on public.notifications to authenticated;
alter policy "ad_metrics_via_client" on public.ad_metrics_snapshots to authenticated;
alter policy "funnels_via_client" on public.funnels to authenticated;
alter policy "funnel_phases_via_funnel" on public.funnel_phases to authenticated;
alter policy "task_links_read" on public.task_links to authenticated;
alter policy "task_links_owner_write" on public.task_links to authenticated;
alter policy "task_links_member_delete" on public.task_links to authenticated;
alter policy "task_links_member_insert" on public.task_links to authenticated;
alter policy "team_members_via_agency" on public.team_members to authenticated;
alter policy "team_members_client_read" on public.team_members to authenticated;
alter policy "programs_via_client" on public.programs to authenticated;
alter policy "programs_client_read" on public.programs to authenticated;
alter policy "agent_conversations_via_client" on public.agent_conversations to authenticated;
alter policy "agent_prompts_read" on public.agent_prompts to authenticated;
alter policy "agent_prompts_write_owner" on public.agent_prompts to authenticated;
alter policy "clients_client_read" on public.clients to authenticated;
alter policy "ropre_client_read" on public.ropre_items to authenticated;
alter policy "content_client_read" on public.content_pieces to authenticated;
alter policy "projections_client_read" on public.projections to authenticated;
alter policy "funnels_client_read" on public.funnels to authenticated;
alter policy "funnel_phases_client_read" on public.funnel_phases to authenticated;
alter policy "tasks_client_read" on public.tasks to authenticated;
alter policy "tasks_client_update" on public.tasks to authenticated;
alter policy "leads_client_insert" on public.leads to authenticated;
alter policy "leads_client_update" on public.leads to authenticated;
alter policy "meetings_client_read" on public.meetings to authenticated;
alter policy "tasks_via_client_owner" on public.tasks to authenticated;
alter policy "meetings_via_client" on public.meetings to authenticated;
alter policy "task_links_update" on public.task_links to authenticated;
alter policy "api_keys_owner_read" on public.api_keys to authenticated;
alter policy "api_keys_owner_update" on public.api_keys to authenticated;
alter policy "api_requests_owner_read" on public.api_requests to authenticated;
alter policy "meetings_team_via_agency" on public.meetings to authenticated;
alter policy "meetings_team_read" on public.meetings to authenticated;
alter policy "tasks_miembro_crear" on public.tasks to authenticated;
alter policy "tasks_propias_privadas" on public.tasks to authenticated;
alter policy "clients_direccion_read" on public.clients to authenticated;
alter policy "tasks_direccion_read" on public.tasks to authenticated;
alter policy "meetings_direccion_read" on public.meetings to authenticated;
alter policy "team_members_direccion_read" on public.team_members to authenticated;
alter policy "ropre_direccion_read" on public.ropre_items to authenticated;
alter policy "leads_via_client" on public.leads to authenticated;
alter policy "lead_events_via_lead" on public.lead_events to authenticated;
alter policy "leads_client_read" on public.leads to authenticated;
alter policy "lead_events_client_read" on public.lead_events to authenticated;
alter policy "lead_events_client_insert" on public.lead_events to authenticated;

-- Helpers de autorización: conservar EXECUTE para políticas autenticadas.
revoke execute on function public.mi_espacio_personal() from public, anon;
grant execute on function public.mi_espacio_personal() to authenticated, service_role;
revoke execute on function public.is_client_editor(uuid) from public, anon;
grant execute on function public.is_client_editor(uuid) to authenticated, service_role;
revoke execute on function public.es_duena_de_agencia(uuid) from public, anon;
grant execute on function public.es_duena_de_agencia(uuid) to authenticated, service_role;
revoke execute on function public.is_client_member(uuid) from public, anon;
grant execute on function public.is_client_member(uuid) to authenticated, service_role;
revoke execute on function public.puede_ver_fila(boolean,uuid) from public, anon;
grant execute on function public.puede_ver_fila(boolean,uuid) to authenticated, service_role;
revoke execute on function public.direccion_ve_cliente(uuid) from public, anon;
grant execute on function public.direccion_ve_cliente(uuid) to authenticated, service_role;
revoke execute on function public.mis_agencias() from public, anon;
grant execute on function public.mis_agencias() to authenticated, service_role;
revoke execute on function public.puedo_escribir_en_cliente(uuid) from public, anon;
grant execute on function public.puedo_escribir_en_cliente(uuid) to authenticated, service_role;
revoke execute on function public.es_direccion() from public, anon;
grant execute on function public.es_direccion() to authenticated, service_role;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
alter function public.touch_updated_at() set search_path = pg_catalog;
alter function public.auditar_privacidad() set search_path = pg_catalog;

-- El enlace compartido nunca devuelve tareas personales o privadas.
CREATE OR REPLACE FUNCTION public.get_funnel_by_share_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  declare
    v_funnel  jsonb;
    v_phases  jsonb;
    v_tasks   jsonb;
    v_client  jsonb;
    v_funnel_id uuid; 
    v_client_id uuid;
  begin
    select to_jsonb(f.*), f.id, f.client_id
      into v_funnel, v_funnel_id, v_client_id
    from public.funnels f
    where f.share_token = p_token
    limit 1;
  
    if v_funnel is null then
      return null;
    end if;

    select coalesce(jsonb_agg(to_jsonb(p.*) order by p.order_idx), '[]'::jsonb)
      into v_phases
    from public.funnel_phases p
    where p.funnel_id = v_funnel_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',         t.id,
          'title',      t.title,
          'status',     t.status,
          'priority',   t.priority,
          'phase_id',   t.phase_id,
          'funnel_id',  t.funnel_id,
          'due_date',   t.due_date,
          'start_date', t.start_date
        )
        order by t.due_date asc
      ),
      '[]'::jsonb
    ) into v_tasks    
    from public.tasks t
    where t.funnel_id = v_funnel_id
      and coalesce(t.es_privada, false) = false;

    select jsonb_build_object(
      'id', c.id,     
      'name', c.name,
      'primary_color', c.primary_color
    ) into v_client
    from public.clients c
    where c.id = v_client_id;
  
    return jsonb_build_object(
      'funnel', v_funnel,
      'phases', v_phases,
      'tasks',  v_tasks,
      'client', v_client
    );
  end;
  $function$
