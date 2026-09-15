set -uo pipefail
export PATH="/usr/local/bin:$PATH"
C=p360_046
ESQUEMA="${TMPDIR:-/tmp}/p360_schema_real.sql"
cd /Users/marisolochoalopez/Desktop/CLAUDE/project360
docker rm -f "$C" >/dev/null 2>&1
docker run -d --name "$C" -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
docker exec -i "$C" psql -U postgres -q >/dev/null 2>&1 <<'SQL'
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_admin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL
docker exec -i "$C" psql -U postgres -q < "$ESQUEMA" >/dev/null 2>&1

docker exec -i "$C" psql -U postgres -q -v ON_ERROR_STOP=1 <<'SQL'
alter table public.tasks disable trigger all;
insert into auth.users (id,email) values ('99999999-9999-9999-9999-999999999999','p@p.com');
insert into public.users (id,email,name,role) values ('99999999-9999-9999-9999-999999999999','p@p.com','P','owner');
insert into public.agencies (id,name,owner_id) values ('88888888-8888-8888-8888-888888888888','Mi Agencia','99999999-9999-9999-9999-999999999999');
insert into public.clients (id, agency_id, name, sigla, is_agency, industry, business_type, primary_color, status, project_type) values
  ('aaaaaaaa-0000-0000-0000-000000000001','88888888-8888-8888-8888-888888888888','Andrea Torres','AT',false,'Marca personal','Marca personal','#10B981','active','personal_brand'),
  ('aaaaaaaa-0000-0000-0000-000000000002','88888888-8888-8888-8888-888888888888','Ikigai Agencia','IK',true,'Marketing','Agencia','#8B5CF6','active','other'),
  ('aaaaaaaa-0000-0000-0000-000000000003','88888888-8888-8888-8888-888888888888','David Guerrero','DG',true,'Marca personal','Marca personal','#F59E0B','active','personal_brand');
-- tareas: 3 personales en Ikigai, 5 normales en Ikigai, 2 privadas en David
insert into public.tasks (client_id,title,status,priority,assigned_to,due_date,es_privada,propietario_id)
select 'aaaaaaaa-0000-0000-0000-000000000002','personal '||g,'pending','P2','Marisol Ochoa',now(),true,'99999999-9999-9999-9999-999999999999' from generate_series(1,3) g;
insert into public.tasks (client_id,title,status,priority,assigned_to,due_date,es_privada)
select 'aaaaaaaa-0000-0000-0000-000000000002','daily ikigai '||g,'pending','P2','Marisol Ochoa',now(),false from generate_series(1,5) g;
insert into public.tasks (client_id,title,status,priority,assigned_to,due_date,es_privada,propietario_id)
select 'aaaaaaaa-0000-0000-0000-000000000003','privada david '||g,'pending','P2','Marisol Ochoa',now(),true,'99999999-9999-9999-9999-999999999999' from generate_series(1,2) g;
SQL

docker exec "$C" psql -U postgres -tAc "select count(*) from public.tasks" | xargs -I{} sh -c 'test {} -eq 10 || { echo "❌ los datos de prueba no entraron ({} tareas, esperaba 10)"; exit 1; }' || exit 1
echo "── ANTES ──"
docker exec "$C" psql -U postgres -c "select name,is_agency,(select count(*) from public.tasks t where t.client_id=c.id) tareas from public.clients c order by name"
echo
echo "── APLICANDO 046 ──"
docker exec -i "$C" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/046_espacio_interno_propio.sql || { echo "❌ FALLÓ"; exit 1; }
echo
echo "── DESPUÉS ──"
docker exec "$C" psql -U postgres -c "select name,is_agency,(select count(*) from public.tasks t where t.client_id=c.id) tareas,(select count(*) from public.tasks t where t.client_id=c.id and t.es_privada) privadas from public.clients c order by is_agency desc,name"
echo "── mi_espacio_personal() NO puede ser null ──"
docker exec "$C" psql -U postgres -tAc "select coalesce((select name from public.clients where id=(select id from public.clients where is_agency limit 1)),'NULL')"
echo "── RESPALDO ──"
docker exec "$C" psql -U postgres -c "select tipo,count(*) from public.respaldo_espacio_interno_046 group by 1 order by 1"
echo
echo "── SEGUNDA PASADA (idempotencia) ──"
docker exec "$C" psql -U postgres -tAc "select md5(string_agg(name||is_agency::text,',' order by name)) from public.clients" > /tmp/i1
docker exec -i "$C" psql -U postgres -q -v ON_ERROR_STOP=1 < supabase/migrations/046_espacio_interno_propio.sql >/dev/null 2>&1; echo "  código: $?"
docker exec "$C" psql -U postgres -tAc "select md5(string_agg(name||is_agency::text,',' order by name)) from public.clients" > /tmp/i2
diff -q /tmp/i1 /tmp/i2 >/dev/null && echo "  ✅ sin cambios" || echo "  ❌ CAMBIÓ"
docker exec "$C" psql -U postgres -tAc "select count(*) from public.clients where name='Project360'" | xargs -I{} echo "  espacios Project360: {} (debe ser 1)"
docker rm -f "$C" >/dev/null 2>&1
