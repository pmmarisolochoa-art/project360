/**
 * Casos de prueba de la API pública v1.
 *
 * Lo ejecuta `npm run test:api` (ver `pruebas/api-v1.mjs`, que compila los
 * endpoints con un Supabase falso antes de importarlos).
 *
 * QUÉ CUBRE Y QUÉ NO
 * Cubre TODO el middleware con los endpoints reales: autenticación, permisos,
 * rate limit, aislamiento, validación, fugas en errores, cabeceras y audit
 * log. Lo que NO cubre es el SQL de la migración 033 — las funciones
 * `security definer` solo se pueden probar contra una base real. Ahí el
 * aislamiento está verificado por lectura del código, no por ejecución.
 */

import { createHash } from 'node:crypto';
import { estado, reset } from './stub-supabase.mjs';
import tasks from './.build/tasks.js';
import tarea from './.build/tarea.js';
import cambiarEstado from './.build/estado.js';
import meetings from './.build/meetings.js';

process.env.VITE_SUPABASE_URL = 'https://falso.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-falsa';

const AG_A = '11111111-1111-4111-8111-111111111111';
const KEY_OK = 'pk_live_' + 'aBcDeFgHjKmNpQrStUvWxYz23456789A';
const hash = (k) => createHash('sha256').update(k).digest('hex');

const keyBase = (over = {}) => ({
  id: 'key-1', agencia_id: AG_A, scopes: ['read:tasks', 'write:tasks', 'read:meetings', 'write:meetings'],
  rate_limit: 100, activa: true, expira_en: null, key_hash: hash(KEY_OK), ...over,
});

const pedir = (handler, { url = 'https://app.com/api/v1/tasks', metodo = 'GET', key = KEY_OK, body, headers = {} } = {}) =>
  handler(new Request(url, {
    method: metodo,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      'x-forwarded-proto': 'https',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  }));

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

// ═══ AUTENTICACIÓN ═══
seccion('PASO 2-3: autenticación');
reset({ keys: [keyBase()] });
let r = await pedir(tasks, { key: null });
ok(r.status === 401, `sin key → 401 (fue ${r.status})`);
ok((await r.clone().json()).error.code === 'no_autenticado', 'código no_autenticado');

r = await pedir(tasks, { key: 'pk_live_' + 'x'.repeat(32) });
ok(r.status === 401, `key inexistente → 401 (fue ${r.status})`);
ok(estado.llamadasRpc.length === 0, 'NO se consultó ningún dato con key inválida');

r = await pedir(tasks, { key: 'basura' });
ok(r.status === 401, 'key con forma inválida → 401');

reset({ keys: [keyBase({ activa: false })] });
const revocada = await (await pedir(tasks)).json();
reset({ keys: [keyBase({ key_hash: 'otro' })] });
const inexistente = await (await pedir(tasks)).json();
ok(JSON.stringify(revocada) === JSON.stringify(inexistente),
   'key REVOCADA e INEXISTENTE dan respuesta idéntica (no se filtra cuál existió)');

reset({ keys: [keyBase({ expira_en: new Date(Date.now() - 1000).toISOString() })] });
r = await pedir(tasks);
ok(r.status === 401 && (await r.json()).error.code === 'key_expirada', 'key expirada → 401 key_expirada');

// ═══ PERMISOS ═══
seccion('PASO 4: permisos (scopes)');
reset({ keys: [keyBase({ scopes: ['read:tasks'] })] });
r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'X' } });
ok(r.status === 403, `key de solo lectura intentando CREAR → 403 (fue ${r.status})`);
ok(estado.llamadasRpc.length === 0, 'no llegó a tocar la base');
r = await pedir(tasks);
ok(r.status === 200, 'esa misma key SÍ puede listar → 200');

reset({ keys: [keyBase({ scopes: ['read:tasks'] })] });
r = await pedir(meetings, { url: 'https://app.com/api/v1/meetings' });
ok(r.status === 403, 'key sin read:meetings no ve la agenda → 403');

// ═══ RATE LIMIT ═══
seccion('PASO 5: rate limit');
reset({ keys: [keyBase({ rate_limit: 10 })], conteo: 10 });
r = await pedir(tasks);
ok(r.status === 429, `en el límite → 429 (fue ${r.status})`);
ok(r.headers.get('retry-after') === '60', 'incluye Retry-After: 60');
ok(estado.llamadasRpc.length === 0, 'no se sirvieron datos al pasarse del límite');
reset({ keys: [keyBase({ rate_limit: 10 })], conteo: 9 });
ok((await pedir(tasks)).status === 200, 'justo debajo del límite → 200');

// ═══ AISLAMIENTO ═══
seccion('PASO 6: aislamiento por agencia');
reset({ keys: [keyBase()] });
await pedir(tasks, { url: 'https://app.com/api/v1/tasks?client_id=99999999-9999-4999-8999-999999999999' });
const args = estado.llamadasRpc[0].args;
ok(estado.llamadasRpc[0].nombre === 'api_tareas_listar', 'usa la función SQL, no la tabla directa');
ok(args.p_agencia === AG_A, 'el agencia_id viaja SIEMPRE desde la key, no del request');

reset({ keys: [keyBase()] });
await pedir(tasks, { url: 'https://app.com/api/v1/tasks?agencia_id=' + '2'.repeat(8) + '-2222-4222-8222-222222222222' });
ok(estado.llamadasRpc[0].args.p_agencia === AG_A,
   'mandar agencia_id en la query NO cambia la agencia consultada');

reset({ keys: [keyBase()] });
r = await pedir(tarea, { url: 'https://app.com/api/v1/tasks/33333333-3333-4333-8333-333333333333' });
ok(r.status === 404, `tarea de otra agencia → 404, nunca 403 (fue ${r.status})`);

// ═══ VALIDACIÓN ═══
seccion('Validación de entrada');
reset({ keys: [keyBase()] });
r = await pedir(tasks, { metodo: 'POST', body: '{roto' });
ok(r.status === 400 && (await r.json()).error.code === 'datos_invalidos', 'JSON malformado → 400');

r = await pedir(tasks, { metodo: 'POST', body: { client_id: 'no-uuid', titulo: 'X' } });
ok(r.status === 400, 'client_id que no es uuid → 400');

r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'X', es_privada: true } });
ok(r.status === 400, 'campo desconocido (es_privada) → 400, no se ignora');
ok((await r.json()).error.message.includes('privada'), 'el mensaje dice cuál campo sobra');

r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: '' } });
ok(r.status === 400, 'título vacío → 400');

r = await pedir(cambiarEstado, { url: 'https://app.com/api/v1/tasks/33333333-3333-4333-8333-333333333333/status', metodo: 'PATCH', body: { estado: 'archivado' } });
ok(r.status === 400, 'estado inexistente → 400 (no llega al CHECK de Postgres)');
ok((await r.json()).error.message.includes('pending'), 'el error lista los estados válidos');

r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'x'.repeat(500) } });
ok(r.status === 400, 'título de 500 chars → 400 (límite 300)');

// ── Etiqueta: dejó de ser texto libre (25-ago) ──────────────────────────────
// Antes aceptaba 60 caracteres cualesquiera. Como el SLA se busca POR etiqueta,
// un "Ads " con mayúscula o con espacio entraba sin queja y esa tarea quedaba
// fuera de toda medición de tiempos, en silencio.
r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'X', etiqueta: 'Ads ' } });
ok(r.status === 400, 'etiqueta inventada → 400 (antes entraba como texto libre)');
ok((await r.json()).error.message.includes('deliverable'), 'el error lista las etiquetas válidas');

reset({ keys: [keyBase()] });
r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'X', etiqueta: 'ads' } });
ok(r.status === 201 || r.status === 200, `etiqueta válida en minúscula → aceptada (fue ${r.status})`);

// ── La fecha de entrega sale de NUESTRO SLA, no de un 7 inventado ───────────
// Sin `fecha_limite`, la base ponía `now() + 7 días` — un número que no respeta
// los tiempos acordados. Ahora la pone el SLA según la etiqueta.
const diasHasta = (iso) => Math.round((new Date(iso).getTime() - Date.now()) / 86400000);

reset({ keys: [keyBase()] });
await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'Preparar la reunión', etiqueta: 'meeting' } });
let sla = estado.llamadasRpc.find((l) => l.nombre === 'api_tarea_crear')?.args;
ok(diasHasta(sla?.p_fecha_limite) === 1, `sin fecha + etiqueta 'meeting' → SLA de 1 día (fueron ${diasHasta(sla?.p_fecha_limite)})`);

reset({ keys: [keyBase()] });
await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'Entregable ROPRE', etiqueta: 'ropre' } });
sla = estado.llamadasRpc.find((l) => l.nombre === 'api_tarea_crear')?.args;
ok(diasHasta(sla?.p_fecha_limite) === 5, `sin fecha + etiqueta 'ropre' → SLA de 5 días (fueron ${diasHasta(sla?.p_fecha_limite)})`);

reset({ keys: [keyBase()] });
await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'Sin etiqueta' } });
sla = estado.llamadasRpc.find((l) => l.nombre === 'api_tarea_crear')?.args;
ok(diasHasta(sla?.p_fecha_limite) === 3, `sin fecha ni etiqueta → SLA de 'other', 3 días (fueron ${diasHasta(sla?.p_fecha_limite)})`);
ok(sla?.p_fecha_limite !== null, 'ya nunca llega null: la base no vuelve a inventar 7 días');

reset({ keys: [keyBase()] });
const pactada = new Date(Date.now() + 30 * 86400000).toISOString();
await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'Con fecha propia', etiqueta: 'ads', fecha_limite: pactada } });
sla = estado.llamadasRpc.find((l) => l.nombre === 'api_tarea_crear')?.args;
ok(diasHasta(sla?.p_fecha_limite) === 30, 'si mandan fecha, manda la suya: el SLA no la pisa');

reset({ keys: [keyBase()] });

r = await pedir(tasks, { metodo: 'POST', headers: { 'content-length': String(200 * 1024) }, body: { client_id: AG_A, titulo: 'X' } });
ok(r.status === 413, 'body declarado >100KB → 413');

r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'A', descripcion: 'x'.repeat(120 * 1024) } });
ok(r.status === 413, 'body REAL >100KB → 413 aunque no lo declare');

// ═══ ERRORES ═══
seccion('Fugas de información en errores');
reset({ keys: [keyBase()], rpcResp: { api_tareas_listar: { data: null, error: { message: 'column tasks.secreto_interno does not exist', code: '42703', hint: 'perhaps you meant...' } } } });
r = await pedir(tasks);
const cuerpo = await r.text();
ok(r.status === 500, 'error de Postgres → 500');
ok(!cuerpo.includes('secreto_interno') && !cuerpo.includes('42703') && !cuerpo.includes('hint'),
   'el mensaje de Postgres NO viaja al cliente');

reset({ keys: [keyBase()] });
r = await pedir(cambiarEstado, { url: 'https://app.com/api/v1/tasks/33333333-3333-4333-8333-333333333333/status', metodo: 'PATCH', body: { estado: 'completed' } });
// la rpc devuelve data:[] por defecto → no hay error → 200
reset({ keys: [keyBase()], rpcResp: { api_tarea_estado: { data: null, error: { message: 'tarea_en_revision' } } } });
r = await pedir(cambiarEstado, { url: 'https://app.com/api/v1/tasks/33333333-3333-4333-8333-333333333333/status', metodo: 'PATCH', body: { estado: 'completed' } });
ok(r.status === 409, `tarea en revisión → 409 (fue ${r.status})`);

reset({ keys: [keyBase()], rpcResp: { api_tarea_crear: { data: null, error: { message: 'cliente_no_encontrado' } } } });
r = await pedir(tasks, { metodo: 'POST', body: { client_id: '44444444-4444-4444-8444-444444444444', titulo: 'Tarea de un proyecto que no existe acá' } });
ok(r.status === 400, `cliente inexistente → 400 claro (fue ${r.status})`);
ok((await r.json()).error.message.includes('client_id'), 'el mensaje explica qué revisar');

// ═══ CABECERAS Y CORS ═══
seccion('Cabeceras de seguridad y CORS');
reset({ keys: [keyBase()] });
r = await pedir(tasks);
for (const [h, v] of [['x-content-type-options','nosniff'],['x-frame-options','DENY'],['cache-control','no-store']])
  ok(r.headers.get(h) === v, `${h}: ${v}`);
ok(!!r.headers.get('strict-transport-security'), 'Strict-Transport-Security presente');
ok(r.headers.get('access-control-allow-origin') === null,
   'SIN Access-Control-Allow-Origin (el navegador no puede llamarla)');

r = await pedir(tasks, { metodo: 'OPTIONS' });
ok(r.status === 204 && r.headers.get('access-control-allow-origin') === null, 'preflight no autoriza ningún origen');

r = await pedir(tasks, { metodo: 'DELETE' });
ok(r.status === 405, `DELETE → 405 (la API no borra nada, fue ${r.status})`);
ok(r.headers.get('allow') === 'GET, POST', 'Allow lista solo GET y POST');

reset({ keys: [keyBase()] });
r = await pedir(tasks, { headers: { 'x-forwarded-proto': 'http' } });
ok(r.status === 400 && (await r.json()).error.code === 'https_requerido', 'HTTP plano → rechazado');

// ═══ AUDIT LOG ═══
seccion('Audit log');
reset({ keys: [keyBase()] });
await pedir(tasks);
await new Promise((r) => setTimeout(r, 10));
ok(estado.requests.length === 1, 'la llamada quedó registrada');
ok(estado.requests[0].status_code === 200 && estado.requests[0].endpoint === '/api/v1/tasks', 'registra endpoint y status');
ok(typeof estado.requests[0].response_time_ms === 'number', 'registra el tiempo de respuesta');

reset({ keys: [keyBase()] });
await pedir(tasks, { key: 'pk_live_' + 'z'.repeat(32) });
await new Promise((r) => setTimeout(r, 10));
ok(estado.requests.length === 1 && estado.requests[0].status_code === 401,
   'los intentos FALLIDOS también se registran (sirve para detectar ataques)');
ok(!JSON.stringify(estado.requests[0]).includes('zzzz'), 'la key intentada NO se guarda en el log');

// ═══ SANEAMIENTO (S5D) ═══
seccion('Saneamiento de entrada y de logs');
reset({ keys: [keyBase()] });
r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'Tarea\u0000 con byte nulo' } });
ok(r.status === 201 || r.status === 200, `título con byte nulo → aceptado, no 500 (fue ${r.status})`);
let arg = estado.llamadasRpc.find((l) => l.nombre === 'api_tarea_crear')?.args;
ok(arg && !arg.p_titulo.includes('\u0000'), 'el byte nulo se quitó antes de llegar a Postgres');

reset({ keys: [keyBase()] });
r = await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: '   \u0007\u001b   ' } });
ok(r.status === 400, 'título de solo caracteres invisibles → 400 (cuenta como vacío)');

reset({ keys: [keyBase()] });
await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: "'; DROP TABLE tasks; --" } });
arg = estado.llamadasRpc.find((l) => l.nombre === 'api_tarea_crear')?.args;
ok(arg?.p_titulo === "'; DROP TABLE tasks; --",
   'intento de inyección SQL viaja como parámetro, sin concatenar (se guarda como texto)');

reset({ keys: [keyBase()] });
await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'Normal', descripcion: 'x'.repeat(3000) } });
await new Promise((r) => setTimeout(r, 10));
let logueado = estado.requests[0]?.request_body;
ok(String(logueado.descripcion).length < 600, 'el audit log recorta valores largos');
ok(String(logueado.descripcion).includes('recortado'), 'y marca que fueron recortados');

reset({ keys: [keyBase()] });
await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'X', api_key: KEY_OK } });
await new Promise((r) => setTimeout(r, 10));
logueado = estado.requests[0]?.request_body;
ok(logueado.api_key === '[redactado]', 'un secreto mandado por error queda REDACTADO en el log');
ok(!JSON.stringify(estado.requests[0]).includes(KEY_OK.slice(8)), 'la llave no aparece en ninguna parte del log');

// ═══ ATRIBUCIÓN DEL LOG ═══
seccion('Atribución del audit log');
reset({ keys: [keyBase({ activa: false })] });
r = await pedir(tasks);
await new Promise((r) => setTimeout(r, 10));
ok(r.status === 401, 'llave revocada → 401');
ok(estado.requests[0]?.agencia_id === AG_A,
   'la llamada de una llave REVOCADA se atribuye a su agencia (si no, sería invisible en el panel)');
ok(estado.requests[0]?.api_key_id === 'key-1', 'y se sabe qué llave fue');

reset({ keys: [keyBase({ expira_en: new Date(Date.now() - 1000).toISOString() })] });
await pedir(tasks);
await new Promise((r) => setTimeout(r, 10));
ok(estado.requests[0]?.agencia_id === AG_A, 'igual con una llave EXPIRADA');

reset({ keys: [keyBase()] });
await pedir(tasks, { key: 'pk_live_' + 'q'.repeat(32) });
await new Promise((r) => setTimeout(r, 10));
ok(estado.requests[0]?.agencia_id === null,
   'una llave DESCONOCIDA queda sin agencia — no hay a quién atribuírsela (limitación conocida)');

// ═══ TODO CAMINO REGISTRA (regresión del 06-ago) ═══
seccion('Ningún camino se salta el registro');
// El 405 no se registraba: su `return` era el único sin llamada al log. Se
// descubrió en producción, no acá — de ahí esta prueba.
reset({ keys: [keyBase()] });
r = await pedir(tasks, { metodo: 'DELETE' });
ok(r.status === 405, 'DELETE → 405');
ok(estado.requests.length === 1, 'el 405 SÍ queda registrado (antes se perdía)');
ok(estado.requests[0]?.status_code === 405, 'y con su código correcto');

reset({ keys: [keyBase({ scopes: ['read:tasks'] })] });
await pedir(tasks, { metodo: 'POST', body: { client_id: AG_A, titulo: 'X' } });
ok(estado.requests.length === 1 && estado.requests[0].status_code === 403,
   'el 403 de permiso queda registrado (alimenta la alerta de ataque)');

reset({ keys: [keyBase()] });
await pedir(tasks, { headers: { 'x-forwarded-proto': 'http' } });
ok(estado.requests.length === 1, 'el rechazo por HTTP también se registra');

reset({ keys: [keyBase()], rpcResp: { api_tareas_listar: { data: null, error: { message: 'boom' } } } });
await pedir(tasks);
ok(estado.requests.length === 1 && estado.requests[0].status_code === 500,
   'un error interno también se registra');

// El registro se ESPERA: al volver de la llamada la fila ya tiene que estar.
// Antes se lanzaba sin esperar y Vercel mataba la escritura al responder, lo
// que además dejaba al rate limit contando de menos.
reset({ keys: [keyBase()] });
await pedir(tasks);
ok(estado.requests.length === 1,
   'la fila existe SIN esperar nada más (el registro se completó antes de responder)');

reset({ keys: [keyBase()] });
for (let i = 0; i < 12; i++) await pedir(tasks);
ok(estado.requests.length === 12, `12 llamadas → 12 filas, ninguna perdida (fueron ${estado.requests.length})`);

console.log(`\n${'═'.repeat(62)}`);
console.log(fallos === 0 ? `🟢 ${total}/${total} PASARON` : `🔴 ${fallos} de ${total} FALLARON`);
process.exit(fallos ? 1 : 0);
