#!/usr/bin/env bash
#
# Prueba una migración de responsables CON FILAS, no solo contra el esquema vacío.
#
# USO:
#   bash pruebas/probar_migracion_con_datos.sh supabase/migrations/045_*.sql
#
# Se le pueden pasar varias y las aplica EN ORDEN, que es como se puede
# reproducir el estado real: la 044 ya corrió en producción, así que probar la
# 045 sola no dice nada útil.
#
# POR QUÉ EXISTE, además de probar_migracion.sh: ese script comprueba que el
# SQL no revienta y qué columnas añade. Aquí lo que puede fallar no es la
# sintaxis sino la LÓGICA — que un alias no case por un acento, que el jsonb de
# las reuniones no se reescriba, que una reunión sin tareas rompa la consulta.
# Eso solo se ve con datos.
#
# Los nombres de prueba son los REALES del filtro de personas (9-sep-2026).
#
# Necesita Docker corriendo y el esquema ya descargado por probar_migracion.sh.
set -uo pipefail
export PATH="/usr/local/bin:$PATH"
C=p360_migracion_datos
ESQUEMA="${TMPDIR:-/tmp}/p360_schema_real.sql"
cd /Users/marisolochoalopez/Desktop/CLAUDE/project360

docker rm -f "$C" >/dev/null 2>&1
docker run -d --name "$C" -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done

docker exec -i "$C" psql -U postgres -q >/dev/null 2>&1 <<'SQL'
do $$ begin create role anon;           exception when duplicate_object then null; end $$;
do $$ begin create role authenticated;  exception when duplicate_object then null; end $$;
do $$ begin create role service_role;   exception when duplicate_object then null; end $$;
do $$ begin create role supabase_admin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator;  exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL
docker exec -i "$C" psql -U postgres -q < "$ESQUEMA" >/dev/null 2>&1

docker exec -i "$C" psql -U postgres -q -v ON_ERROR_STOP=1 <<'SQL'
alter table public.tasks disable trigger all;
alter table public.meetings disable trigger all;
insert into auth.users (id,email) values ('99999999-9999-9999-9999-999999999999','p@p.com');
insert into public.users (id,email,name,role) values ('99999999-9999-9999-9999-999999999999','p@p.com','P','owner');
insert into public.agencies (id,name,owner_id) values
  ('88888888-8888-8888-8888-888888888888','Agencia Prueba','99999999-9999-9999-9999-999999999999');
insert into public.clients (id, agency_id, name, industry, business_type, primary_color, status, project_type) values
  ('11111111-1111-1111-1111-111111111111','88888888-8888-8888-8888-888888888888','Cliente Prueba','otros','b2b','#6366F1','active','other');
insert into public.tasks (client_id, title, status, priority, assigned_to, due_date)
select '11111111-1111-1111-1111-111111111111', 'T '||n, 'pending','P2', n, now()
from unnest(array[
  'Cisco','Jona','Jonathan','Jhonatan','Juanca','Loro','Lucho','Luisa','Teo',
  'Robert','Santi','Sophie','Tati','Toño','Andrea',
  'Equipo','Equipo de Contenido','Equipo de Marketing','El grupo',
  'Speaker A','Speaker D','Hablante 2',
  'David','Tony','Antonio Vital','David Castaño','David Guerrero',
  'Francisco Otalvaro','Marisol Ochoa','TOÑO','  cisco  '
]) as n;
insert into public.ropre_items (client_id, type, title, responsible) values
  ('11111111-1111-1111-1111-111111111111','deliverable','E1','Sophie'),
  ('11111111-1111-1111-1111-111111111111','deliverable','E2','Speaker A'),
  ('11111111-1111-1111-1111-111111111111','deliverable','E3','Tony');
insert into public.meetings (id, client_id, title, type, scheduled_at, duration_min, extracted_tasks) values
  ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','R1','general', now(), 30,
   '[{"title":"a","responsibleRole":"Juanca"},{"title":"b","responsibleRole":"Speaker D"},{"title":"c","responsibleRole":"Tony"}]'::jsonb),
  ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','R2','general', now(), 30, '[]'::jsonb);
SQL

echo "ANTES: $(docker exec "$C" psql -U postgres -tAc "select count(distinct assigned_to) from public.tasks") nombres distintos"
for M in "$@"; do
  echo "  → $(basename "$M")"
  docker exec -i "$C" psql -U postgres -v ON_ERROR_STOP=1 -q < "$M" || exit 1
done
ULTIMA="${!#}"
echo
echo "── TAREAS DESPUÉS ──"
docker exec "$C" psql -U postgres -c "select assigned_to, count(*) from public.tasks group by 1 order by 1"
echo "── ROPRE ──"
docker exec "$C" psql -U postgres -c "select title, responsible from public.ropre_items order by 1"
echo "── DENTRO DE LA REUNIÓN ──"
docker exec "$C" psql -U postgres -tAc "select extracted_tasks from public.meetings where id='22222222-2222-2222-2222-222222222222'"
echo "── REUNIÓN VACÍA ──"
docker exec "$C" psql -U postgres -tAc "select extracted_tasks from public.meetings where id='33333333-3333-3333-3333-333333333333'"
echo "── RESPALDO ──"
NUM=$(basename "$ULTIMA" | grep -oE '^[0-9]+')
docker exec "$C" psql -U postgres -c "select tabla, count(*) from public.respaldo_responsables_${NUM} group by 1 order by 1"
echo
docker exec "$C" psql -U postgres -tAc "select md5(string_agg(assigned_to,',' order by id::text)) from public.tasks" > /tmp/h1
docker exec -i "$C" psql -U postgres -q -v ON_ERROR_STOP=1 < "$ULTIMA" >/dev/null 2>&1
docker exec "$C" psql -U postgres -tAc "select md5(string_agg(assigned_to,',' order by id::text)) from public.tasks" > /tmp/h2
diff -q /tmp/h1 /tmp/h2 >/dev/null && echo "IDEMPOTENTE ✅" || echo "IDEMPOTENTE ❌ cambió"
docker rm -f "$C" >/dev/null 2>&1
