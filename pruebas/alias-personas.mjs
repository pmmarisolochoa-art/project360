/**
 * Pruebas de la normalización de responsables.
 *
 * El caso que la origina va primero: el filtro "Todas las personas" mostraba a
 * la misma persona hasta con tres etiquetas — "Cisco" y "Francisco Otalvaro",
 * "Jona"/"Jhonatan"/"Jonathan", "Lucho"/"Luisa"/"Luis David Flores" — porque
 * los alias solo se aplicaban al IMPORTAR de Paralelo.
 *
 * La lista de abajo es LA REAL, copiada del desplegable el 9-sep-2026. Sirve
 * para dos cosas: comprobar que cada apodo cae donde debe, y comprobar que
 * después de aplicar la tabla no queda ningún duplicado.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { paralelo: join(aqui, '../src/config/paralelo.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});
const { resolverResponsableParalelo, PARALELO_DESCONOCIDO } = await import('./.build/paralelo.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

// El equipo tal como está registrado en Project360.
const EQUIPO = [
  'Antonio Espitia', 'Antonio Vital', 'Camilo Beltrán', 'David Castaño',
  'Francisco Otalvaro', 'Jhonatan Rengifo', 'Juan Camilo Correa',
  'Lorenzo Cadavid', 'Luis David Flores', 'Marisol Ochoa', 'Roberto Maestre',
  'Santiago Ruiz', 'Sofía Vasquez', 'Tatiana Echeverri Gomez',
];
const r = (crudo) => resolverResponsableParalelo(crudo, EQUIPO);

seccion('los apodos que la founder fijó (9-sep)');
ok(r('Cisco') === 'Francisco Otalvaro', 'Cisco → Francisco Otalvaro');
ok(r('Jona') === 'Jhonatan Rengifo', 'Jona → Jhonatan Rengifo');
ok(r('Jhonatan') === 'Jhonatan Rengifo', 'Jhonatan → Jhonatan Rengifo');
ok(r('Jonathan') === 'Jhonatan Rengifo', 'Jonathan (con o) → Jhonatan Rengifo');
ok(r('Juanca') === 'Juan Camilo Correa', 'Juanca → Juan Camilo Correa');
ok(r('Loro') === 'Lorenzo Cadavid', 'Loro → Lorenzo Cadavid');
ok(r('Lucho') === 'Luis David Flores', 'Lucho → Luis David Flores');
ok(r('Luisa') === 'Luis David Flores', 'Luisa → Luis David Flores');
ok(r('Teo') === 'Luis David Flores', 'Teo → Luis David Flores (no es Antonio)');
ok(r('Robert') === 'Roberto Maestre', 'Robert → Roberto Maestre');
ok(r('Santi') === 'Santiago Ruiz', 'Santi → Santiago Ruiz');
ok(r('Sophie') === 'Sofía Vasquez', 'Sophie → Sofía Vasquez');
ok(r('Tati') === 'Tatiana Echeverri Gomez', 'Tati → Tatiana Echeverri Gomez');
ok(r('Toño') === 'Antonio Espitia', 'Toño → Antonio Espitia');
// Corregido por la founder el mismo 9-sep: primero se dejó Tony aparte.
ok(r('Tony') === 'Antonio Vital', 'Tony → Antonio Vital (NO Antonio Espitia)');

seccion('acentos y mayúsculas no deben importar');
ok(r('TOÑO') === 'Antonio Espitia', 'TOÑO en mayúsculas');
ok(r('Tono') === 'Antonio Espitia', 'Tono sin la tilde de la ñ');
ok(r('  cisco  ') === 'Francisco Otalvaro', 'con espacios de sobra');

seccion('lo que NO se toca (decisión explícita, no olvido)');
ok(r('Antonio Vital') === 'Antonio Vital', 'Antonio Vital no se funde con Antonio Espitia');
ok(r('Antonio Espitia') === 'Antonio Espitia', 'un nombre ya correcto se queda igual');

seccion('grupos y desconocidos → a quien reparte');
ok(r('Equipo') === PARALELO_DESCONOCIDO, 'Equipo → ' + PARALELO_DESCONOCIDO);
ok(r('Equipo de Contenido') === PARALELO_DESCONOCIDO, 'Equipo de Contenido');
ok(r('Equipo de Marketing') === PARALELO_DESCONOCIDO, 'Equipo de Marketing');
ok(r('El grupo') === PARALELO_DESCONOCIDO, 'El grupo');
ok(r('Speaker A') === PARALELO_DESCONOCIDO, 'Speaker A (no se fija a nadie: cambia en cada reunión)');
ok(r('Speaker D') === PARALELO_DESCONOCIDO, 'Speaker D');
ok(r('') === PARALELO_DESCONOCIDO, 'vacío');


seccion('un nombre real desconocido se deja VISIBLE, no se esconde');
ok(r('Arnoldo Lorenzo') === 'Arnoldo Lorenzo', 'un nombre que nadie reconoce se queda tal cual');
ok(r('David Guerrero') === 'David Guerrero', 'David Guerrero (cliente) NO se funde con David Castaño');


seccion('lo que ya funcionaba no se rompió');
ok(r('Balita (David F)') === 'David Castaño', 'el nombre FUERA del paréntesis');
ok(r('Speaker C (Mari Cruz)') === 'Marisol Ochoa', 'el nombre DENTRO del paréntesis');
ok(r('Camilo (diseñador)') === 'Camilo Beltrán', 'un paréntesis que no es diarización');
ok(r('Santiago') === 'Santiago Ruiz', 'primer nombre único del equipo');

seccion('la prueba de fondo: cero duplicados');
// La lista real del desplegable, tal cual salía el 9-sep.
const LISTA_REAL = [
  'Andrea', 'Antonio Espitia', 'Antonio Vital', 'Camilo Beltrán', 'Cisco',
  'David', 'David Castaño', 'David Guerrero', 'El grupo', 'Equipo',
  'Equipo de Contenido', 'Equipo de Marketing', 'Francisco Otalvaro',
  'Jhonatan Rengifo', 'Jona', 'Jonathan', 'Juan Camilo Correa', 'Juanca',
  'Lorenzo Cadavid', 'Loro', 'Lucho', 'Luis David Flores', 'Luisa',
  'Marisol Ochoa', 'Robert', 'Roberto Maestre', 'Santi', 'Santiago Ruiz',
  'Sofía Vasquez', 'Sophie', 'Speaker A', 'Speaker D', 'Tati',
  'Tatiana Echeverri Gomez', 'Teo', 'Tony', 'Toño',
];
const despues = [...new Set(LISTA_REAL.map(r))].sort((a, b) => a.localeCompare(b, 'es'));
console.log('  Antes:  ' + LISTA_REAL.length + ' entradas');
console.log('  Después:' + despues.length + ' entradas → ' + despues.join(', '));

// Ninguno de los apodos que ella nombró puede sobrevivir.
const APODOS = ['Cisco', 'Jona', 'Jonathan', 'Juanca', 'Loro', 'Lucho', 'Luisa',
  'Teo', 'Robert', 'Santi', 'Sophie', 'Tati', 'Toño', 'Tony', 'Andrea',
  'El grupo', 'Equipo', 'Equipo de Contenido', 'Equipo de Marketing',
  'Speaker A', 'Speaker D'];
for (const a of APODOS) ok(!despues.includes(a), `"${a}" ya no aparece en la lista`);

// Y los que decidió conservar tienen que seguir ahí.
for (const n of ['David', 'Antonio Vital', 'David Castaño', 'David Guerrero'])
  ok(despues.includes(n), `"${n}" se conserva, como se decidió`);

console.log(`\n${fallos === 0 ? '🟢' : '🔴'} ${total - fallos}/${total} PASARON`);
process.exit(fallos === 0 ? 0 : 1);
