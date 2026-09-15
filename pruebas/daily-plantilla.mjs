/**
 * ¿Qué reuniones usan la plantilla de la Daily?
 *
 * EL CASO QUE LA ORIGINA (14-sep-2026): hasta hoy la condición era
 * `client.isAgency`, y funcionaba de casualidad — Ikigai ERA el espacio de
 * agencia. Al pasarlo a cliente normal, sus dailies habrían caído al reporte
 * genérico, que le pide todo a la IA a partir de las NOTAS; y una daily de
 * Paralelo no tiene notas sino resumen.
 *
 * Eso no falla: sale un titular, un párrafo y una página en blanco. Es el bug
 * del 20-ago, y es exactamente el tipo de rotura que ninguna prueba de tipos
 * ni el CI detectan. De ahí este archivo.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { daily: join(aqui, '../src/config/reporteDaily.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});
const { esDaily, tieneDaily } = await import('./.build/daily.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const ikigai      = { name: 'Ikigai Agencia', isAgency: false }; // ya es cliente
const interno     = { name: 'Project360',     isAgency: true };  // el espacio nuevo
const otroCliente = { name: 'Andrea Torres',  isAgency: false };

seccion('el caso que la originó');
ok(esDaily(ikigai, { title: 'Daily sprint Ikigai' }), 'la daily de Ikigai SIGUE usando su plantilla aunque ya no sea espacio de agencia');
ok(esDaily(ikigai, { title: 'Daily planeación semana Ikigai' }), 'y la de planeación también');

seccion('el espacio interno siempre');
ok(esDaily(interno, { title: 'Daily del equipo' }), 'una daily del espacio interno');
ok(tieneDaily(interno), 'el espacio interno tiene daily por ser interno, sin estar en la lista');

seccion('lo que NO debe colarse');
ok(!esDaily(otroCliente, { title: 'Daily de Andrea' }), 'una reunión de otro cliente llamada "daily" NO usa la plantilla');
ok(!esDaily(ikigai, { title: 'Reunión de estrategia' }), 'una reunión de Ikigai que no es daily tampoco');
ok(!esDaily(ikigai, { title: '' }), 'sin título');
ok(esDaily(ikigai, { title: 'Dailies de la semana' }), 'el plural "dailies" también cuenta');

seccion('acentos y mayúsculas en el nombre del cliente');
ok(esDaily({ name: 'IKIGAI AGENCIA', isAgency: false }, { title: 'Daily x' }), 'en mayúsculas');
ok(esDaily({ name: 'Ikigai', isAgency: false }, { title: 'Daily x' }), 'si algún día se renombra a solo "Ikigai"');

console.log(`\n${fallos === 0 ? '🟢' : '🔴'} ${total - fallos}/${total} PASARON`);
process.exit(fallos === 0 ? 0 : 1);
