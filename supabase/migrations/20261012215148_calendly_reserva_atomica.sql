-- Operación exclusiva del webhook: reunión + etapa + fecha + historial.
-- No altera las policies ni permite acceso desde el navegador.
create or replace function public.calendly_guardar_reserva(
  p_client_id uuid, p_lead_id uuid, p_external_id text, p_meeting jsonb,
  p_actor_id uuid default null, p_actor_nombre text default null
) returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  v_meeting uuid;
  v_lead public.leads%rowtype;
  v_fecha timestamptz;
begin
  if p_external_id is null or p_external_id not like 'calendly:%' then
    raise exception 'Identificador Calendly requerido' using errcode='22023';
  end if;
  -- Serializa entregas simultáneas de la misma reserva sin borrar duplicados históricos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text || ':' || p_external_id, 0));
  select id into v_meeting from public.meetings
    where client_id=p_client_id and external_id=p_external_id and origen='calendly' limit 1;
  if found then return v_meeting; end if;
  select * into v_lead from public.leads where id=p_lead_id and client_id=p_client_id for update;
  if not found then raise exception 'Lead no pertenece al cliente' using errcode='22023'; end if;
  if p_actor_id is not null and not exists (
    select 1 from public.team_members where id=p_actor_id and client_id=p_client_id
  ) then raise exception 'Closer no pertenece al cliente' using errcode='22023'; end if;
  v_fecha := (p_meeting->>'scheduled_at')::timestamptz;
  insert into public.meetings
    (client_id,title,type,scheduled_at,duration_min,participants,video_call_link,notes,origen,external_id,lead_id)
  values (p_client_id,p_meeting->>'title',p_meeting->>'type',v_fecha,
    (p_meeting->>'duration_min')::integer,coalesce(p_meeting->'participants','[]'::jsonb),
    p_meeting->>'video_call_link',p_meeting->>'notes','calendly',p_external_id,p_lead_id)
  returning id into v_meeting;
  if v_lead.etapa in ('nuevo','contactado','calificado') then
    update public.leads set etapa='cita_agendada',fecha_agenda=v_fecha,closed_at=null where id=p_lead_id;
    insert into public.lead_events(lead_id,etapa_anterior,etapa_nueva,nota,actor_id,actor_nombre)
      values(p_lead_id,v_lead.etapa,'cita_agendada','Agendado por Calendly',p_actor_id,coalesce(p_actor_nombre,'Calendly'));
  else
    update public.leads set fecha_agenda=v_fecha where id=p_lead_id;
  end if;
  return v_meeting;
end;
$$;
revoke all on function public.calendly_guardar_reserva(uuid,uuid,text,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.calendly_guardar_reserva(uuid,uuid,text,jsonb,uuid,text) to service_role;
