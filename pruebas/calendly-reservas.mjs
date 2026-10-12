import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'p360-calendly-'));
const previousFetch=globalThis.fetch;
const previousEnv={...process.env};
const key='test-signing-key';
const eventUri='https://api.calendly.com/scheduled_events/00000000-0000-0000-0000-000000000001';
const payload={event:'invitee.created',payload:{uri:eventUri+'/invitees/00000000-0000-0000-0000-000000000002',event:eventUri,email:'prueba@example.test',name:'Prueba'}};
let db={},rpcErrors={},calls=[];
globalThis.__calendly={query(table,filters){calls.push({table,filters});return db[table]??{data:null,error:null};},rpc(name,args){calls.push({name,args});return Promise.resolve({data:name==='api_lead_crear'?'new-lead':'meeting-id',error:rpcErrors[name]??null});}};
const now=()=>String(Math.floor(Date.now()/1000));
const request=(body=payload,timestamp=now())=>{
  const raw=JSON.stringify(body),sig=createHmac('sha256',key).update(timestamp+'.'+raw).digest('hex');
  return new Request('https://app.example.test/api/calendly/webhook',{method:'POST',body:raw,headers:{'calendly-webhook-signature':`t=${timestamp},v1=${sig}`}});
};
const reset=()=>{
  calls=[];rpcErrors={};db={clients:{data:{agency_id:'agency-A'},error:null},leads:{data:[{id:'lead-A',email:'prueba@example.test',etapa:'nuevo'}],error:null}};
  globalThis.fetch=async()=>new Response(JSON.stringify({resource:{start_time:'2026-10-13T15:00:00Z',end_time:'2026-10-13T15:30:00Z',name:'Sesión estratégica de patrocinios'}}),{status:200});
};
try {
  await build({entryPoints:['api/calendly/webhook.ts'],outfile:join(dir,'webhook.mjs'),bundle:true,format:'esm',platform:'node',logLevel:'error',plugins:[{name:'controlled-db',setup(b){
    b.onResolve({filter:/^@supabase\/supabase-js$/},({path})=>({path,namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export const createClient=()=>({rpc:(name,args)=>globalThis.__calendly.rpc(name,args),from(table){const filters={};const q={select:()=>q,eq:(key,value)=>{filters[key]=value;return q},ilike:()=>q,maybeSingle:()=>Promise.resolve(globalThis.__calendly.query(table,filters)),then:(yes,no)=>Promise.resolve(globalThis.__calendly.query(table,filters)).then(yes,no)};return q;}});`}));
  }}]});
  const {default:handler}=await import(pathToFileURL(join(dir,'webhook.mjs')));
  Object.assign(process.env,{VITE_SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-key',CALENDLY_SIGNING_KEY:key,CALENDLY_PERSONAL_ACCESS_TOKEN:'test-calendly-token'});
  reset();assert.equal((await handler(request())).status,200);
  const saved=calls.find(c=>c.name==='calendly_guardar_reserva');
  assert.equal(saved.args.p_lead_id,'lead-A');assert.equal(saved.args.p_meeting.type,'sponsor_strategy');
  assert.equal(saved.args.p_meeting.scheduled_at,'2026-10-13T15:00:00Z');
  assert.ok(calls.filter(c=>c.table==='leads'||c.table==='meetings').every(c=>c.filters.client_id===saved.args.p_client_id),'consultas limitadas al cliente habilitado');
  reset();db.meetings={data:{id:'already-saved'},error:null};assert.equal((await handler(request())).status,200);assert.equal(calls.filter(c=>c.name).length,0,'reentrega no vuelve a escribir');
  reset();db.meetings={data:null,error:Error('database unavailable')};assert.equal((await handler(request())).status,500);
  reset();globalThis.fetch=async()=>new Response('unavailable',{status:503});assert.equal((await handler(request())).status,502);
  reset();db.leads={data:null,error:Error('lead lookup failed')};assert.equal((await handler(request())).status,500);
  reset();db.leads={data:[],error:null};rpcErrors.api_lead_crear=Error('lead create failed');assert.equal((await handler(request())).status,500);assert.ok(!calls.some(c=>c.name==='calendly_guardar_reserva'));
  reset();rpcErrors.calendly_guardar_reserva=Error('meeting/history transaction failed');assert.equal((await handler(request())).status,500);
  reset();db.clients={data:null,error:null};assert.equal((await handler(request())).status,503);
  reset();globalThis.fetch=async()=>{throw Error('network failed')};assert.equal((await handler(request())).status,500);
  reset();assert.equal((await handler(request(payload,'NaN'))).status,401);assert.equal((await handler(request(payload,String(Number(now())-181)))).status,401);assert.equal(calls.length,0);
  reset();assert.equal((await handler(request({...payload,payload:{...payload.payload,event:'https://attacker.example/secret'}}))).status,400);assert.equal(calls.length,0);
  console.log('✓ Calendly: reserva completa, reentrega, fallos reintentables, firma y cliente aislado');
} finally {
  globalThis.fetch=previousFetch;delete globalThis.__calendly;
  for(const k of ['VITE_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CALENDLY_SIGNING_KEY','CALENDLY_PERSONAL_ACCESS_TOKEN']) {if(previousEnv[k]===undefined)delete process.env[k];else process.env[k]=previousEnv[k];}
  await rm(dir,{recursive:true,force:true});
}
