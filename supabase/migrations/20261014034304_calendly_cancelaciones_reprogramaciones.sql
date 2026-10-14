-- Conserva el histórico; las citas canceladas no son reuniones pendientes.
alter table public.meetings
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists rescheduled boolean not null default false;

-- Recuerda cancelaciones recibidas antes que la reserva. Solo backend.
create table public.calendly_cancelaciones (
  client_id uuid not null references public.clients(id) on delete cascade,
  external_id text not null check (external_id like 'calendly:%'),
  cancelled_at timestamptz not null default now(),
  reason text,
  replacement_external_id text,
  primary key(client_id,external_id)
);
alter table public.calendly_cancelaciones enable row level security;
revoke all on public.calendly_cancelaciones from public,anon,authenticated;
grant all on public.calendly_cancelaciones to service_role;

create or replace function public.calendly_cancelar_reserva(
  p_client_id uuid, p_external_id text, p_reason text default null,
  p_replacement_external_id text default null,p_rescheduled boolean default false
) returns void language plpgsql security invoker set search_path = ''
as $$
declare
  v_meeting public.meetings%rowtype;
  v_lead public.leads%rowtype;
  v_cancelled_at timestamptz;
begin
  if p_external_id is null or p_external_id not like 'calendly:%' then
    raise exception 'Identificador Calendly requerido' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text || ':' || p_external_id,0));
  insert into public.calendly_cancelaciones(client_id,external_id,reason,replacement_external_id)
    values(p_client_id,p_external_id,p_reason,p_replacement_external_id)
  on conflict(client_id,external_id) do update set
    reason=coalesce(calendly_cancelaciones.reason,excluded.reason),
    replacement_external_id=coalesce(calendly_cancelaciones.replacement_external_id,excluded.replacement_external_id)
  returning cancelled_at into v_cancelled_at;
  select * into v_meeting from public.meetings
    where client_id=p_client_id and external_id=p_external_id and origen='calendly' limit 1;
  if not found then return; end if;
  update public.meetings set cancelled_at=coalesce(cancelled_at,v_cancelled_at),
    cancellation_reason=coalesce(cancellation_reason,p_reason),
    rescheduled=rescheduled or p_replacement_external_id is not null or p_rescheduled
    where client_id=p_client_id and external_id=p_external_id and origen='calendly';
  if v_meeting.cancelled_at is not null or v_meeting.lead_id is null then return; end if;
  select * into v_lead from public.leads
    where id=v_meeting.lead_id and client_id=p_client_id for update;
  if not found then return; end if;
  -- No borra la fecha de otra reserva nueva recibida antes de la cancelación.
  if v_lead.fecha_agenda = v_meeting.scheduled_at then
    update public.leads set fecha_agenda=(
      select min(scheduled_at) from public.meetings
      where lead_id=v_lead.id and client_id=p_client_id and cancelled_at is null
        and not completed and scheduled_at>=now()
    ) where id=v_lead.id;
  end if;
  insert into public.lead_events(lead_id,etapa_anterior,etapa_nueva,nota,actor_nombre)
    values(v_lead.id,v_lead.etapa,v_lead.etapa,
      case when p_replacement_external_id is not null or p_rescheduled then 'Cita reprogramada en Calendly' else 'Cita cancelada en Calendly' end
      || case when p_reason is not null then ': ' || p_reason else '' end,'Calendly');
end;
$$;
revoke all on function public.calendly_cancelar_reserva(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.calendly_cancelar_reserva(uuid,text,text,text,boolean) to service_role;

create or replace function public.calendly_guardar_reserva(
  p_client_id uuid,p_lead_id uuid,p_external_id text,p_meeting jsonb,
  p_actor_id uuid default null,p_actor_nombre text default null
) returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  v_meeting uuid;
  v_lead public.leads%rowtype;
  v_fecha timestamptz;
  v_old text := p_meeting->>'old_external_id';
  v_key text;
begin
  if p_external_id is null or p_external_id not like 'calendly:%' then
    raise exception 'Identificador Calendly requerido' using errcode='22023';
  end if;
  -- Orden fijo evita invertir locks al enlazar la cita vieja con la nueva.
  for v_key in select distinct x from unnest(array[p_external_id,v_old]) as u(x)
    where x is not null order by x
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text || ':' || v_key,0));
  end loop;
  if v_old is not null and v_old<>p_external_id then
    perform public.calendly_cancelar_reserva(p_client_id,v_old,'Reprogramada en Calendly',p_external_id,true);
  end if;
  if exists(select 1 from public.calendly_cancelaciones where client_id=p_client_id and external_id=p_external_id) then
    return null; -- Una creación retrasada no reactiva una reserva cancelada.
  end if;
  select id into v_meeting from public.meetings
    where client_id=p_client_id and external_id=p_external_id and origen='calendly' limit 1;
  if found then return v_meeting; end if;
  select * into v_lead from public.leads where id=p_lead_id and client_id=p_client_id for update;
  if not found then raise exception 'Lead no pertenece al cliente' using errcode='22023'; end if;
  if p_actor_id is not null and not exists(select 1 from public.team_members where id=p_actor_id and client_id=p_client_id) then
    raise exception 'Closer no pertenece al cliente' using errcode='22023';
  end if;
  v_fecha := (p_meeting->>'scheduled_at')::timestamptz;
  insert into public.meetings(client_id,title,type,scheduled_at,duration_min,participants,video_call_link,notes,origen,external_id,lead_id)
    values(p_client_id,p_meeting->>'title',p_meeting->>'type',v_fecha,(p_meeting->>'duration_min')::integer,
      coalesce(p_meeting->'participants','[]'::jsonb),p_meeting->>'video_call_link',p_meeting->>'notes','calendly',p_external_id,p_lead_id)
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
revoke all on function public.calendly_guardar_reserva(uuid,uuid,text,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.calendly_guardar_reserva(uuid,uuid,text,jsonb,uuid,text) to service_role;
