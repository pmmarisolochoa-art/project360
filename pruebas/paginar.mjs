/**
 * El reparto de bloques en páginas del PDF.
 *
 * EL CASO QUE LA ORIGINA (21-sep-2026): el reporte semanal de Ikigai salió con
 * media página en blanco y la sección de riesgos cortada. Causa: un bloque más
 * alto que la página se colocaba igual y lo que pasaba del borde inferior se
 * PERDÍA. No fallaba nada — el PDF se generaba, se abría y tenía sus páginas.
 * Simplemente faltaba contenido, que es la peor forma de romperse.
 *
 * Medidas reales del motor: A4 de 297 mm, la primera página empieza en 56 (o en
 * 34 con portada baja), las siguientes en 19, el fondo está en 282 y entre
 * bloques van 5.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { paginar: join(aqui, '../src/utils/paginarBloques.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
});
const { paginarBloques } = await import('./.build/paginar.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const A4 = { topPrimera: 56, topResto: 19, fondo: 282, hueco: 5 };
const b = (hmm) => ({ hmm });
const pag = (bloques, opts = A4) => paginarBloques(bloques, opts);
/** ¿Algún bloque se sale del papel? Es la pregunta que nadie hacía. */
const seSale = (paginas, fondo = 282) =>
  paginas.some((p) => p.some((c) => c.y + c.bloque.hmm > fondo + 0.001));

seccion('nada puede salirse del papel — la pregunta que faltaba');
ok(!seSale(pag([b(100), b(100), b(100)])), 'tres bloques medianos caben repartidos');
ok(!seSale(pag([b(260)])), 'un bloque de 260 mm se va a la página 2, donde cabe, en vez de desbordar la 1');
ok(pag([b(260)]).length === 2, 'y por eso ocupa dos páginas aunque sea un solo bloque');
ok(!seSale(pag([b(263)])), 'justo el alto de una página de continuación: el borde exacto');
ok(!seSale(pag([b(50), b(200), b(200), b(80)])), 'una mezcla larga tampoco');

seccion('el reparto');
let p = pag([b(100), b(100), b(100)]);
ok(p.length === 2, 'tres de 100 mm no caben en una página: van a dos');
ok(p[0].length === 2 && p[1].length === 1, 'dos arriba y uno abajo');
ok(p[0][0].y === 56, 'el primero empieza en 56, bajo la portada alta');
ok(p[0][1].y === 161, 'el segundo va 100+5 más abajo');
ok(p[1][0].y === 19, 'el de la página nueva empieza en 19, bajo la cabecera de continuación');

seccion('la portada baja da más sitio');
ok(pag([b(120), b(120)], { ...A4, topPrimera: 34 }).length === 1, 'con portada baja dos de 120 caben en una página (34+120+5+120=279)');
ok(pag([b(120), b(120)]).length === 2, 'con la portada alta ya no (56+120+5+120=301): los 22 mm deciden');

seccion('un bloque más alto que la página: no se pierde ni hace páginas vacías');
p = pag([b(500)]);
ok(p.length === 1, 'se le da su propia página en vez de saltar en bucle');
ok(p[0].length === 1, 'y sigue estando: no se descarta');
p = pag([b(50), b(500), b(50)]);
ok(p.length === 3, 'el gigante empuja al de después a otra página');
ok(p.every((x) => x.length > 0), 'ninguna página queda vacía');

seccion('bordes');
ok(pag([]).length === 1 && pag([])[0].length === 0, 'sin bloques, una página vacía y no un fallo');
p = pag([b(226)]);
ok(p.length === 1 && p[0][0].y === 56, 'un bloque que llega justo al fondo (56+226=282) no salta de página');
p = pag([b(227)]);
ok(p.length === 2 && p[0].length === 0, 'uno que se pasa por un milímetro (56+227=283) baja a la página 2, donde sí cabe');
ok(!seSale(p), 'y allí no desborda');

console.log(`\n${fallos === 0 ? '🟢' : '🔴'} ${total - fallos}/${total} PASARON`);
process.exit(fallos === 0 ? 0 : 1);
