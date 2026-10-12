import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'p360-etapas-'));
let resolve, reject;
globalThis.__etapas = { calls: [], errors: [], move(lead, event) {
  this.calls.push({lead,event});
  return new Promise((yes,no) => { resolve = yes; reject = no; });
} };
try {
  await build({entryPoints:['src/store/useLeadsStore.ts'],outfile:join(dir,'store.mjs'),
    bundle:true,format:'esm',platform:'node',logLevel:'error',
    plugins:[{name:'controlled-writes',setup(b) {
      b.onResolve({filter:/^(@\/services\/repositories|\.\/onWriteError)$/},({path})=>({path,namespace:'test'}));
      b.onLoad({filter:/.*/,namespace:'test'},({path})=>({contents:path.includes('repositories') ? `
        export const LeadsRepo={moveStage:(l,e)=>globalThis.__etapas.move(l,e),update:async()=>{}};
        export const LeadEventsRepo={add:()=>{throw Error('separate history write')}};
      ` : `export const onWriteError=(label,message,undo)=>error=>{undo?.();globalThis.__etapas.errors.push(error)};`}));
    }}]});
  const {useLeadsStore:store}=await import(pathToFileURL(join(dir,'store.mjs')));
  const lead={id:'lead-A',clientId:'client-A',nombre:'Prueba',fuente:'otro',etapa:'nuevo',cashCollected:0};
  store.getState().hydrate([lead],[]);
  const failed=store.getState().moveStage(lead,'contactado',{});
  assert.equal(store.getState().leads[0].etapa,'contactado');
  assert.equal(store.getState().events.length,1);
  assert.equal(await store.getState().moveStage(lead,'calificado',{}),false,'doble clic bloqueado');
  assert.equal(globalThis.__etapas.calls.length,1);
  store.getState().update(lead.id,{cashCollected:100});
  reject(Error('historial denegado'));
  assert.equal(await failed,false);
  assert.equal(store.getState().leads[0].etapa,'nuevo');
  assert.equal(store.getState().leads[0].cashCollected,100,'rollback conserva otras ediciones');
  assert.equal(store.getState().events.length,0);

  const saved=store.getState().moveStage(lead,'perdido',{},'Sin presupuesto');
  const call=globalThis.__etapas.calls.at(-1);
  resolve({lead:{...call.lead,etapa:'perdido',closedAt:'2026-10-12',lostReason:'Sin presupuesto'},event:{...call.event,createdAt:'2026-10-12'}});
  assert.equal(await saved,true);
  assert.equal(store.getState().leads[0].lostReason,'Sin presupuesto');
  assert.equal(store.getState().events[0].createdAt,'2026-10-12','fecha remota reemplaza reloj local');
  const reopen=store.getState().moveStage(lead,'contactado',{});
  const reopened=globalThis.__etapas.calls.at(-1);
  assert.equal(reopened.lead.etapa,'perdido','usa etapa actual aunque caller sea antiguo');
  resolve({lead:{...reopened.lead,etapa:'contactado',closedAt:undefined},event:reopened.event});
  await reopen;
  assert.equal(store.getState().leads[0].closedAt,undefined);

  const old=store.getState().moveStage(lead,'ganado',{});
  const stale=globalThis.__etapas.calls.at(-1);
  store.getState().hydrate([],[]);
  resolve({lead:{...stale.lead,etapa:'ganado'},event:stale.event});
  assert.equal(await old,false);
  assert.deepEqual(store.getState().leads,[],'respuesta de sesión anterior descartada');
  assert.deepEqual(store.getState().events,[]);
  console.log('✓ Movimiento único, rollback completo, cierre, motivo y aislamiento de sesión');
} finally {delete globalThis.__etapas;await rm(dir,{recursive:true,force:true});}
