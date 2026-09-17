/**
 * Los cortes de periodo del informe.
 *
 * Aquí el error típico no revienta: desplaza el rango un día y el informe sale
 * sin un entregable que sí era del periodo, sin que nada avise. Por eso se
 * prueban los bordes — fin de mes, febrero, domingo, y el rango al revés.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { periodos: join(aqui, '../src/utils/periodos.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
});
const { semanaDe, quincenaDe, mesDe, rangoDe } = await import('./.build/periodos.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const d = (p) => `${p.desde.getDate()}/${p.desde.getMonth() + 1} – ${p.hasta.getDate()}/${p.hasta.getMonth() + 1}`;

seccion('semana: lunes a domingo');
ok(d(semanaDe(new Date(2026, 8, 17))) === '14/9 – 20/9', 'un jueves cae en la semana 14–20 sep');
ok(d(semanaDe(new Date(2026, 8, 14))) === '14/9 – 20/9', 'el lunes es el primer día, no el último');
ok(d(semanaDe(new Date(2026, 8, 20))) === '14/9 – 20/9', 'el DOMINGO pertenece a la semana que empezó el lunes');
ok(d(semanaDe(new Date(2026, 9, 1))) === '28/9 – 4/10', 'una semana puede cruzar de mes');

seccion('quincena: 1–15 y 16–fin');
ok(d(quincenaDe(new Date(2026, 8, 17))) === '16/9 – 30/9', 'el 17 está en la segunda quincena');
ok(d(quincenaDe(new Date(2026, 8, 15))) === '1/9 – 15/9', 'el 15 cierra la primera, no abre la segunda');
ok(d(quincenaDe(new Date(2026, 8, 16))) === '16/9 – 30/9', 'el 16 abre la segunda');
ok(d(quincenaDe(new Date(2026, 0, 20))) === '16/1 – 31/1', 'enero acaba el 31');
ok(d(quincenaDe(new Date(2028, 1, 20))) === '16/2 – 29/2', 'febrero bisiesto acaba el 29, no el 28');
ok(d(quincenaDe(new Date(2026, 1, 20))) === '16/2 – 28/2', 'y un febrero normal el 28');

seccion('mes completo');
ok(d(mesDe(new Date(2026, 8, 17))) === '1/9 – 30/9', 'septiembre son 30 días');
ok(d(mesDe(new Date(2026, 11, 3))) === '1/12 – 31/12', 'diciembre son 31');

seccion('los bordes del día');
const q = quincenaDe(new Date(2026, 8, 17));
ok(q.desde.getHours() === 0 && q.desde.getMinutes() === 0, 'empieza a las 00:00');
ok(q.hasta.getHours() === 23 && q.hasta.getMinutes() === 59, 'termina a las 23:59');
ok(new Date(2026, 8, 30, 18, 0) <= q.hasta, 'un entregable del día 30 a las 18:00 SÍ es de la quincena');

seccion('rango a mano');
ok(d(rangoDe('2026-09-16', '2026-09-30')) === '16/9 – 30/9', 'un rango normal');
ok(rangoDe('2026-09-16', '2026-09-30').desde.getDate() === 16,
   'el 16 es el 16: construido por partes, no con new Date(texto), que lo interpreta en UTC y en Colombia cae el 15');
ok(d(rangoDe('2026-09-30', '2026-09-16')) === '16/9 – 30/9', 'al revés se endereza en vez de dar un rango vacío');
ok(rangoDe('', '2026-09-30') === null, 'una fecha vacía devuelve null y quien llama decide qué decir');
ok(rangoDe('no-es-fecha', 'tampoco') === null, 'texto basura también');

console.log(`\n${fallos === 0 ? '🟢' : '🔴'} ${total - fallos}/${total} PASARON`);
process.exit(fallos === 0 ? 0 : 1);
