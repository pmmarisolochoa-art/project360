-- La etapa, fecha de cierre, motivo de pérdida e historial se guardan juntos.
-- SECURITY INVOKER conserva las policies actuales de leads y lead_events.
create or replace function public.move_lead_stage(
  p_lead_id uuid, p_etapa_anterior text, p_etapa_nueva text, p_event_id uuid,
  p_actor_id uuid default null, p_actor_nombre text default null, p_nota text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_event public.lead_events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  if p_etapa_anterior is not distinct from p_etapa_nueva then
    raise exception 'La etapa debe cambiar' using errcode = '22023';
  end if;
  update public.leads
  set etapa = p_etapa_nueva,
      closed_at = case when p_etapa_nueva in ('ganado', 'perdido') then now() else null end,
      lost_reason = case when p_etapa_nueva = 'perdido' then coalesce(p_nota, lost_reason) else lost_reason end
  where id = p_lead_id and etapa = p_etapa_anterior
  returning * into v_lead;
  if not found then
    raise exception 'El lead cambió o no tienes permiso para moverlo. Recarga antes de intentarlo.'
      using errcode = '40001';
  end if;
  insert into public.lead_events
    (id, lead_id, etapa_anterior, etapa_nueva, nota, actor_id, actor_nombre)
  values (p_event_id, p_lead_id, p_etapa_anterior, p_etapa_nueva, p_nota, p_actor_id, p_actor_nombre)
  returning * into v_event;
  return jsonb_build_object('lead', to_jsonb(v_lead), 'event', to_jsonb(v_event));
end;
$$;
revoke all on function public.move_lead_stage(uuid,text,text,uuid,uuid,text,text) from public, anon;
grant execute on function public.move_lead_stage(uuid,text,text,uuid,uuid,text,text) to authenticated;
