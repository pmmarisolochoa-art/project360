/**
 * Pruebas de los 4 contadores de seguimiento del Pipeline (sin contactar, sin
 * dueño, no-show, sin respuesta) — founder, 08-oct-2026, mismo tablero de
 * referencia que motivó conectar Calendly.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { f: join(aqui, '../src/utils/leadSeguimiento.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});
const { calcularContadoresSeguimiento } = await import('./.build/f.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const AHORA = '2026-10-08T00:00:00.000Z';
const lead = (over) => ({
  id: 'l1', clientId: 'c1', nombre: 'Test', fuente: 'otro', etapa: 'nuevo',
  cashCollected: 0, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

seccion('sin contactar');
let r = calcularContadoresSeguimiento([lead({ etapa: 'nuevo' })], []);
ok(r.sinContactar === 1, 'nuevo sin ningún evento de contacto cuenta');

r = calcularContadoresSeguimiento(
  [lead({ id: 'l1', etapa: 'nuevo' })],
  [{ id: 'e1', leadId: 'l1', etapaNueva: 'contactado', createdAt: '2026-10-02T00:00:00.000Z' }],
);
ok(r.sinContactar === 0, 'si ya hay un evento a "contactado", no cuenta (aunque haya vuelto a nuevo)');

seccion('sin dueño');
r = calcularContadoresSeguimiento([lead({ setterId: undefined, closerId: undefined })], []);
ok(r.sinDueño === 1, 'sin setterId ni closerId cuenta');
r = calcularContadoresSeguimiento([lead({ setterId: 's1' })], []);
ok(r.sinDueño === 0, 'con setterId ya no cuenta');

seccion('no-show');
r = calcularContadoresSeguimiento([lead({ resultado: 'No asistió' })], []);
ok(r.noShow === 1, '"No asistió" cuenta');
r = calcularContadoresSeguimiento([lead({ resultado: 'no-show' })], []);
ok(r.noShow === 1, '"no-show" (inglés) también cuenta');
r = calcularContadoresSeguimiento([lead({ resultado: 'Cerró' })], []);
ok(r.noShow === 0, '"Cerró" no cuenta');

seccion('sin respuesta');
r = calcularContadoresSeguimiento(
  [lead({ id: 'l1', etapa: 'contactado' })],
  [{ id: 'e1', leadId: 'l1', etapaNueva: 'contactado', createdAt: '2026-10-01T00:00:00.000Z' }],
  AHORA, 5,
);
ok(r.sinRespuesta === 1, 'contactado hace 7 días sin avance cuenta (umbral 5)');

r = calcularContadoresSeguimiento(
  [lead({ id: 'l1', etapa: 'contactado' })],
  [{ id: 'e1', leadId: 'l1', etapaNueva: 'contactado', createdAt: '2026-10-07T00:00:00.000Z' }],
  AHORA, 5,
);
ok(r.sinRespuesta === 0, 'contactado hace 1 día NO cuenta todavía');

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas pasaron.\n`);
process.exit(fallos === 0 ? 0 : 1);
