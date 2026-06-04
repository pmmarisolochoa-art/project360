-- ══════════════════════════════════════════════════════════════════════════
--  Migración 009: Share token público para embudos
--
--  Objetivo: permitir que un cliente externo (sin auth) abra una URL
--  /client-portal/funnel/:token y vea el roadmap del embudo en modo
--  read-only.
--
--  Estrategia: en vez de policy SELECT pública (riesgo de enumerar toda
--  la tabla), exponemos una RPC SECURITY DEFINER que recibe el token y
--  devuelve { funnel, phases, tasks, client } como jsonb.
-- ══════════════════════════════════════════════════════════════════════════

-- 1) Columna share_token (única, unguessable)
alter table public.funnels
  add column if not exists share_token text;

-- 2) Backfill de filas existentes
update public.funnels
  set share_token = gen_random_uuid()::text
  where share_token is null;

-- 3) Constraints
alter table public.funnels
  alter column share_token set not null;

create unique index if not exists funnels_share_token_unique
  on public.funnels (share_token);

-- 4) RPC pública: obtiene embudo + fases + tareas + cliente por token
create or replace function public.get_funnel_by_share_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funnel  jsonb;
  v_phases  jsonb;
  v_tasks   jsonb;
  v_client  jsonb;
  v_funnel_id uuid;
  v_client_id uuid;
begin
  -- Encontrar el funnel y client_id
  select to_jsonb(f.*), f.id, f.client_id
    into v_funnel, v_funnel_id, v_client_id
  from public.funnels f
  where f.share_token = p_token
  limit 1;

  if v_funnel is null then
    return null;
  end if;

  -- Fases
  select coalesce(jsonb_agg(to_jsonb(p.*) order by p."order"), '[]'::jsonb)
    into v_phases
  from public.funnel_phases p
  where p.funnel_id = v_funnel_id;

  -- Tareas: solo campos seguros para el cliente (sin assigned_to ni internals)
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
  where t.funnel_id = v_funnel_id;

  -- Cliente: solo nombre + color de marca
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
$$;

-- 5) Permisos: anon + authenticated pueden llamar
grant execute on function public.get_funnel_by_share_token(text) to anon, authenticated;

-- Refresca PostgREST
notify pgrst, 'reload schema';

-- Verifica
select 'share_token column' as check, count(*) as funnels_with_token
from public.funnels
where share_token is not null;

select 'rpc function' as check, proname
from pg_proc
where proname = 'get_funnel_by_share_token';
