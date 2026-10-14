import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite();
const client='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',lead='00000000-0000-0000-0000-000000000010';
const dateA='2099-10-14T15:00:00.000Z',dateB='2099-10-15T15:00:00.000Z',dateC='2099-10-16T15:00:00.000Z';
const scalar=async(sql)=>(await db.query(sql)).rows[0].value;
const phase=()=>scalar('select etapa as value from public.leads');
const date=async()=>{const v=await scalar('select fecha_agenda as value from public.leads');return v?new Date(v).toISOString():null;};
const count=table=>scalar(`select count(*)::int as value from public.${table}`);
const book=(id,date,old)=>db.query('select public.calendly_guardar_reserva($1,$2,$3,$4) id',[client,lead,'calendly:'+id,JSON.stringify({title:'Reserva de prueba',type:'general',scheduled_at:date,duration_min:30,participants:[],old_external_id:old?'calendly:'+old:null})]);
const cancel=(id,replacement=null,c=client)=>db.query('select public.calendly_cancelar_reserva($1,$2,$3,$4,$5)',[c,'calendly:'+id,'Motivo de prueba',replacement?'calendly:'+replacement:null,!!replacement]);
const reset=async()=>{
  await db.exec(`reset role;truncate public.lead_events,public.meetings,public.calendly_cancelaciones,public.leads,public.clients;
    insert into public.clients values('${client}'),('${other}');
    insert into public.leads(id,client_id,etapa,cash_collected) values('${lead}','${client}','nuevo',100);
    set role service_role;`);
};
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table public.clients(id uuid primary key);
    create table public.team_members(id uuid primary key,client_id uuid);
    create table public.leads(id uuid primary key,client_id uuid,etapa text,fecha_agenda timestamptz,closed_at timestamptz,cash_collected numeric);
    create table public.meetings(id uuid primary key default gen_random_uuid(),client_id uuid,title text not null,type text not null check(type in ('general','sponsor_strategy')),scheduled_at timestamptz not null,duration_min integer,participants jsonb,video_call_link text,notes text,origen text,external_id text,lead_id uuid references public.leads(id),completed boolean not null default false);
    create table public.lead_events(id uuid primary key default gen_random_uuid(),lead_id uuid references public.leads(id),etapa_anterior text,etapa_nueva text,nota text,actor_id uuid,actor_nombre text);
    grant select,insert,update on all tables in schema public to service_role;`);
  const dir=new URL('../supabase/migrations/',import.meta.url);
  const file=(await readdir(dir)).find(f=>f.endsWith('_calendly_cancelaciones_reprogramaciones.sql'));
  assert.ok(file,'migración presente');
  await db.exec(await readFile(new URL(file,dir),'utf8'));
  await reset();
  const first=(await book('A',dateA)).rows[0].id;
  assert.equal((await book('A',dateA)).rows[0].id,first);
  assert.equal(await count('meetings'),1);assert.equal(await count('lead_events'),1);
  await cancel('A');
  assert.equal(await date(),null);assert.equal(await phase(),'cita_agendada','cancelar no declara al lead perdido');
  assert.ok(await scalar('select cancelled_at as value from public.meetings'));
  assert.equal(await scalar('select cash_collected as value from public.leads'),'100');
  assert.equal(await count('lead_events'),2);
  await cancel('A');assert.equal(await count('lead_events'),2,'cancelación repetida no duplica historial');
  await book('A',dateA);assert.equal(await count('meetings'),1,'creación repetida no reactiva cancelada');

  await reset();await cancel('A');
  assert.equal((await book('A',dateA)).rows[0].id,null,'cancelación antes de creación impide agenda fantasma');
  assert.equal(await count('meetings'),0);assert.equal(await count('lead_events'),0);

  await reset();await book('A',dateA);await book('B',dateB,'A');await cancel('A','B');
  assert.equal(await date(),dateB,'cancelación vieja preserva horario nuevo');
  assert.equal(await scalar("select count(*)::int as value from public.meetings where cancelled_at is null"),1);
  assert.equal(await scalar("select rescheduled as value from public.meetings where external_id='calendly:A'"),true);
  assert.equal(await count('meetings'),2,'histórico conservado');

  await reset();await book('A',dateA);await cancel('A','B');await book('B',dateB,'A');
  assert.equal(await date(),dateB,'orden inverso produce el mismo horario');

  await reset();await book('A',dateA);await book('C',dateC,'B');await book('B',dateB,'A');
  assert.equal(await date(),dateC,'reprogramación intermedia tardía no pisa última fecha');
  assert.equal(await scalar("select count(*)::int as value from public.meetings where cancelled_at is null"),1);
  assert.ok(await scalar("select cancelled_at as value from public.meetings where external_id='calendly:A'"));

  await reset();await book('A',dateA);await cancel('A',null,other);
  assert.equal(await date(),dateA,'aviso para otro cliente no toca cita real');
  assert.equal(await scalar("select cancelled_at as value from public.meetings"),null);

  await reset();await book('A',dateA);
  await db.exec("reset role;create function fail_history() returns trigger language plpgsql as $$begin raise exception 'historial falló';end;$$;create trigger fail_history before insert on public.lead_events for each row execute function fail_history();set role service_role;");
  await assert.rejects(cancel('A'),/historial falló/);
  assert.equal(await date(),dateA);assert.equal(await count('calendly_cancelaciones'),0);
  assert.equal(await scalar('select cancelled_at as value from public.meetings'),null,'fallo revierte también cancelación');
  await db.exec('reset role;drop trigger fail_history on public.lead_events;set role anon');
  await assert.rejects(cancel('A'),/permission denied/);
  await db.exec('reset role;set role authenticated');
  await assert.rejects(cancel('A'),/permission denied/);
  await assert.rejects(db.query('select * from public.calendly_cancelaciones'),/permission denied/);
  console.log('✓ PostgreSQL: cancelaciones idempotentes, reprogramación en ambos órdenes, cadenas, atomicidad y aislamiento por cliente');
} finally {await db.close();}
