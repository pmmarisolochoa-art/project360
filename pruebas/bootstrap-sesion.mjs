import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'p360-sesion-'));
const stores = {};
let rows = {};
let repoRows = [];
let deferredClients;
globalThis.__p360Test = {
  stores,
  query: (table) => table === 'clients' && deferredClients
    ? deferredClients
    : Promise.resolve(rows[table] ?? { data: [], error: null }),
  repo: () => Promise.resolve(repoRows),
};
try {
  await build({
    entryPoints: ['src/services/bootstrap.ts'], outfile: join(dir, 'bootstrap.mjs'),
    bundle: true, format: 'esm', platform: 'node', logLevel: 'error',
    plugins: [{ name: 'controlled-session', setup(b) {
      b.onResolve({ filter: /^(\.\/supabase|\.\/repositories|\.\/taskLinks|@\/store\/)/ },
        ({ path }) => ({ path, namespace: 'test' }));
      b.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => {
        if (path.startsWith('@/store/')) {
          const name = path.split('/').at(-1);
          return { contents: `
            const state = {};
            const store = { getState: () => state, setState: p => Object.assign(state,p) };
            state.hydrate = (data, events) => Object.assign(state, {data,events});
            state.setHydrated = hydrated => Object.assign(state,{hydrated});
            globalThis.__p360Test.stores.${name} = store;
            export const ${name} = store;
          ` };
        }
        if (path === './supabase') return { contents: `
          export const usingRemote = true;
          export const supabase = {from(table) {
            const q = {select:()=>q,eq:()=>q,in:()=>q,
              then:(yes,no)=>globalThis.__p360Test.query(table).then(yes,no)};
            return q;
          }};
        ` };
        const names = path === './taskLinks' ? ['TaskLinksRepo'] :
          ['ContentRepo','ProjectionsRepo','RopreRepo','TeamRepo','TeamMembersRepo','ProgramsRepo','FunnelLaunchRepo','LeadsRepo','LeadEventsRepo'];
        return { contents: `
          export const rowToClient = r=>r, rowToTask = r=>r, rowToMeeting = r=>r;
          ${names.map(n => `export const ${n} = {listByClientIds: async()=> ${n === 'FunnelLaunchRepo' ? '({funnels:[],phases:[]})' : n === 'ProjectionsRepo' ? '({})' : 'globalThis.__p360Test.repo()'}};`).join('\n')}
        ` };
      });
    }}],
  });
  const { bootstrapFromRemote, resetBootstrapCache } = await import(pathToFileURL(join(dir, 'bootstrap.mjs')));
  stores.useAuthStore.setState({ user: {id:'A'}, agencyId:'agency-A' });
  rows = {clients:{data:[{id:'client-A'}],error:null},tasks:{data:[{id:'task-A'}],error:null}};
  repoRows = [{id:'lead-A'}];
  await bootstrapFromRemote();
  assert.equal(stores.useLeadsStore.getState().data[0].id,'lead-A');
  resetBootstrapCache();
  assert.deepEqual(stores.useClientStore.getState().clients,[],'logout elimina clientes previos');
  assert.deepEqual(stores.useLeadsStore.getState().data,[],'logout elimina ventas previas');

  let release;
  deferredClients = new Promise(resolve => { release = resolve; });
  const oldRequest = bootstrapFromRemote();
  resetBootstrapCache();
  stores.useAuthStore.setState({ user:{id:'B'}, agencyId:'agency-B' });
  deferredClients = undefined;
  rows = {};
  repoRows = [];
  await bootstrapFromRemote();
  release({data:[{id:'old-client-A'}],error:null});
  await oldRequest;
  assert.deepEqual(stores.useClientStore.getState().clients,[],'respuesta antigua no repuebla nueva sesión');
  assert.deepEqual(stores.useLeadsStore.getState().data,[],'sesión sin clientes no conserva ventas');

  resetBootstrapCache();
  rows = {clients:{data:null,error:new Error('denied')}};
  await assert.rejects(bootstrapFromRemote(),/denied/);
  assert.deepEqual(stores.useClientStore.getState().clients,[],'fallo remoto no muestra datos demo');
  rows = {};
  await bootstrapFromRemote();
  assert.equal(stores.useClientStore.getState().hydrated,true,'fallo no queda cacheado');
  console.log('✓ Aislamiento de sesiones, respuesta tardía, lista vacía y reintento');
} finally {
  delete globalThis.__p360Test;
  await rm(dir,{recursive:true,force:true});
}
