/**
 * Limpieza del texto que se sube o se pega en las notas de una reunión.
 *
 * EL CASO QUE LA ORIGINA (18-sep-2026): la founder subió las notas de Gemini de
 * una daily y el campo de notas empezaba con dos líneas que decían "&nbsp;",
 * seguidas del pie de página de Gemini. Causa: el .md se convertía a HTML con
 * `marked` y se le quitaban las etiquetas con una regex, que no decodifica las
 * entidades. La extracción de tareas no encontró nada, y era esperable: lo que
 * le llegó a la IA no era la reunión.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { limpiar: join(aqui, '../src/utils/limpiarTexto.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
});
const { limpiarTextoPegado } = await import('./.build/limpiar.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

seccion('el archivo real de Gemini que lo originó');
const gemini = [
  '&nbsp;', '', '&nbsp;', '',
  'Revisa las notas de Gemini para asegurarte de que sean precisas.',
  'Obtén sugerencias y descubre cómo Gemini toma notas',
  '',
  '## Resumen',
  'Se revisó el avance de la semana. Jhonatan presenta las estrategias de facturación.',
  '',
  '## Próximos pasos',
  '- Francisco: construir los brand books',
  '- Marisol: planificar el evento presencial',
].join('\n');
const limpio = limpiarTextoPegado(gemini);

ok(!limpio.includes('&nbsp;'), 'no queda ningún "&nbsp;" literal');
ok(!limpio.toLowerCase().includes('revisa las notas de gemini'), 'se va el pie de página de Gemini');
ok(!limpio.toLowerCase().includes('obtén sugerencias'), 'y su segunda línea también');
ok(limpio.startsWith('## Resumen'), 'el texto empieza en el contenido de verdad');
ok(limpio.includes('Jhonatan presenta las estrategias'), 'lo que se dijo en la reunión se conserva');
ok(limpio.includes('- Francisco: construir los brand books'), 'y las viñetas siguen siendo viñetas');
ok(limpio.includes('## Próximos pasos'), 'los títulos de markdown NO se destruyen — ayudan a la IA a situarse');

seccion('entidades HTML');
ok(limpiarTextoPegado('Dise&ntilde;o &amp; copy') === 'Dise&ntilde;o & copy', 'las conocidas se decodifican; una rara se deja visible en vez de inventarla');
ok(limpiarTextoPegado('&#8220;el pixel&#8221;') === '“el pixel”', 'las numéricas también');
ok(limpiarTextoPegado('&#x201C;ads&#x201D;') === '“ads”', 'y las hexadecimales');
ok(limpiarTextoPegado('5 &lt; 10 &amp;&amp; 10 &gt; 5') === '5 < 10 && 10 > 5', 'varias seguidas');

seccion('lo que NO debe tocar');
ok(limpiarTextoPegado('Roberto dijo que revisa las notas de Gemini el lunes').includes('revisa las notas'),
   'la coletilla DENTRO de una frase se respeta: ahí puede haberlo dicho alguien');
// La sangría del INICIO de cada línea se conserva a propósito: en markdown
// distingue una viñeta anidada o un bloque de código. Solo se recorta el final.
ok(limpiarTextoPegado('hola  \n\nmundo  ') === 'hola\n\nmundo', 'los espacios al final de línea se van');
ok(limpiarTextoPegado('- uno\n  - anidada') === '- uno\n  - anidada', 'la sangría de una viñeta anidada se respeta: en markdown significa algo');
ok(limpiarTextoPegado('a\n\n\n\n\nb') === 'a\n\nb', 'cinco saltos se quedan en dos');
ok(limpiarTextoPegado('') === '', 'vacío sigue vacío, sin reventar');
ok(limpiarTextoPegado('   \n  \n ') === '', 'solo espacios devuelve vacío — quien llame sabrá que no hay nada que mandar');

console.log(`\n${fallos === 0 ? '🟢' : '🔴'} ${total - fallos}/${total} PASARON`);
process.exit(fallos === 0 ? 0 : 1);
