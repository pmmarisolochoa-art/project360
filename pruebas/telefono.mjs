/**
 * Pruebas de la validación de teléfono.
 *
 * El caso que la origina va primero y con nombre propio: "Colombia" llegó a
 * producción como el WhatsApp de un cliente porque la regla medía el largo del
 * texto (`min(7)`) en vez de contar cifras.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { telefono: join(aqui, '../src/utils/telefono.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});
const { esTelefonoPlausible, digitosDe } = await import('./.build/telefono.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

seccion('el caso que la originó');
ok(!esTelefonoPlausible('Colombia'), '"Colombia" NO es un teléfono (8 letras pasaban el min(7) anterior)');
ok(!esTelefonoPlausible('Medellín'), 'ni "Medellín"');
ok(!esTelefonoPlausible('no tiene'), 'ni una frase');

seccion('números reales que NO se pueden rechazar');
[
  ['+57 300 123 4567', 'colombiano con código y espacios'],
  ['+52 1 55 1234 5678', 'mexicano'],
  ['(300) 123-4567', 'con paréntesis y guion'],
  ['3001234567', 'a secas'],
  ['+1 305 555 0199', 'de Estados Unidos'],
  ['+57 300 123 4567 ext 12', 'con extensión escrita en letras'],
  ['300.123.4567', 'separado por puntos'],
].forEach(([n, que]) => ok(esTelefonoPlausible(n), `${que}: ${n}`));

seccion('casos límite');
ok(!esTelefonoPlausible(''), 'vacío');
ok(!esTelefonoPlausible('   '), 'solo espacios');
ok(!esTelefonoPlausible('123456'), '6 cifras es demasiado corto para cualquier país');
ok(esTelefonoPlausible('1234567'), '7 cifras justas sí pasan');
ok(!esTelefonoPlausible('Casa 3, piso 2'), 'una dirección con números sueltos no cuela');
ok(digitosDe('+57 300 123 4567') === 12, 'cuenta las cifras ignorando lo demás');

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas de teléfono`);
process.exit(fallos === 0 ? 0 : 1);
