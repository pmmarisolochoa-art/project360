/**
 * ¿Qué entra en "mis pendientes" y qué no?
 *
 * Dos fallos posibles, y el silencioso es el segundo:
 *   · que te salgan tareas que no son tuyas → ruido, molesto pero visible
 *   · que NO te salgan las tuyas → te pierdes una entrega y no te enteras
 *
 * Se prueba el corte de fechas, que es lo delicado: "hoy" va por FECHA y no por
 * horas, porque una tarea que vence hoy a las 23:00 tiene que aparecer desde la
 * mañana y no a última hora.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: {
    pendientes: join(aqui, '../src/utils/repartirPendientes.ts'),
    dias: join(aqui, '../src/utils/dias.ts'),
  },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const { repartirPendientes } = await import('./.build/pendientes.js');

// `futuras` no lo devuelve la función: lo que no es vencida ni de hoy,
// simplemente no sale. Se comprueba por ausencia.
const repartir = (tareas, ahora) => repartirPendientes(tareas, ahora);

const AHORA = new Date('2026-09-15T09:00:00');
const t = (id, dueDate, status = 'pending') => ({ id, dueDate, status });

seccion('el corte de "hoy" va por fecha, no por horas');
let r = repartir([
  t('a', '2026-09-15T23:00:00'),   // hoy, tardísimo
  t('b', '2026-09-15T00:30:00'),   // hoy, de madrugada (ya pasó la hora)
  t('c', '2026-09-16T08:00:00'),   // mañana temprano
], AHORA);
ok(r.hoy.some((x) => x.id === 'a'), 'una tarea de hoy a las 23:00 aparece desde la mañana');
ok(r.hoy.some((x) => x.id === 'b'), 'una de hoy a las 00:30 cuenta como HOY, no como vencida');
ok(!r.hoy.some((x) => x.id === 'c') && !r.vencidas.some((x) => x.task.id === 'c'), 'la de mañana temprano NO se cuela en hoy ni en vencidas');
ok(r.vencidas.length === 0, 'ninguna de esas tres es un retraso');

seccion('los retrasos y sus días');
r = repartir([
  t('ayer', '2026-09-14T10:00:00'),
  t('semana', '2026-09-08T10:00:00'),
], AHORA);
ok(r.vencidas.find((x) => x.task.id === 'ayer')?.dias === 1, 'la de ayer son 1 día de retraso');
ok(r.vencidas.find((x) => x.task.id === 'semana')?.dias === 7, 'la de hace una semana son 7');

seccion('lo que NO debe aparecer');
r = repartir([
  t('hecha', '2026-09-01T10:00:00', 'completed'),
  t('rota', 'no-es-una-fecha'),
], AHORA);
ok(r.vencidas.length === 0 && r.hoy.length === 0, 'una completada no es un pendiente aunque esté vencidísima');
ok(true, 'una fecha ilegible no revienta: la función devolvió sin lanzar');

seccion('la cuenta de días, que ya se escribió mal dos veces');
const { diasEntre } = await import('./.build/dias.js');
ok(diasEntre(new Date('2026-09-14T10:00:00'), new Date('2026-09-15T09:00:00')) === 1,
   'ayer a las 10:00, hoy a las 9:00 → 1 día (restando horas daba 0)');
ok(diasEntre(new Date('2026-09-12T23:00:00'), new Date('2026-09-15T09:00:00')) === 3,
   'hace 3 días a las 23:00 → 3 (restando horas daba 2)');
ok(diasEntre(new Date('2026-09-15T23:00:00'), new Date('2026-09-15T00:30:00')) === 0,
   'el mismo día son 0, aunque las horas vayan al revés');

seccion('el orden importa: lo más atrasado primero');
r = repartir([t('x','2026-09-14T10:00:00'), t('y','2026-09-01T10:00:00'), t('z','2026-09-13T10:00:00')], AHORA);
ok(r.vencidas[0].task.id === 'y', 'la más atrasada encabeza la lista');
ok(r.vencidas[2].task.id === 'x', 'y la más reciente cierra');

console.log(`\n${fallos === 0 ? '🟢' : '🔴'} ${total - fallos}/${total} PASARON`);
process.exit(fallos === 0 ? 0 : 1);
