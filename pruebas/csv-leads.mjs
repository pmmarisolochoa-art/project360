/**
 * Pruebas de la importación de leads por CSV.
 *
 * Compila `src/utils/csvLeads.ts` con esbuild (mismo truco que
 * `csv-clientes.mjs`) y ejercita el código real, sin navegador ni base.
 * Nace del archivo real de Alejo (RPM) que llegó con teléfono/usuario de
 * Instagram mezclados en una sola columna "Contacto", montos en formato
 * LATAM ("USD 3.000") y fechas de 2 dígitos de año ("18-9-26") — los tres
 * se perdían en silencio antes de este arreglo.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { csv: join(aqui, '../src/utils/csvLeads.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});
const { leerLeadsCSV, construirLeadDesdeFila } = await import('./.build/csv.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const CABECERA = 'Nombre,Contacto,Fecha 1er contacto,Canal de entrada,Setter,Fecha de agenda,Fecha de la llamada,Closer,¿Asistió?,Resultado,Producto,Precio pactado,TOTAL COBRADO,Motivo si no cerró,Último seguimiento,Notas';

// ═══ CONTACTO: teléfono vs usuario de Instagram ═══
seccion('columna "Contacto" (teléfono o IG, sin separar)');
let r = leerLeadsCSV(`${CABECERA}\nFederico,fedechas36,29/7/2026,Reel,Jessica,9-9-2026,10-9-2026,NATALIA,No,No asistió,,,,,,`, 'c1', []);
ok(r.filas[0].datos.telefono === undefined, 'usuario de IG no se cuela como teléfono');
ok(r.filas[0].datos.instagram === 'fedechas36', 'usuario de IG va al campo instagram, no se pierde');

r = leerLeadsCSV(`${CABECERA}\nPaola,@gustavomendozar57,29/7/2026,Reel,,,,,,,,,,,,`, 'c1', []);
ok(r.filas[0].datos.instagram === 'gustavomendozar57', 'el "@" inicial se limpia al guardar');

r = leerLeadsCSV(`${CABECERA}\nMaria,5574369308,29/7/2026,Reel,,,,,,,,,,,,`, 'c1', []);
ok(r.filas[0].datos.telefono === '5574369308', 'número en "Contacto" sí se clasifica como teléfono');

// ═══ DINERO LATAM/US ═══
seccion('montos "USD 3.000" / "$1,000"');
r = leerLeadsCSV(`${CABECERA}\nAna,,1/9/2026,,,,,,,,Mentoría,USD 3.000,USD 3.000,,,`, 'c1', []);
ok(r.filas[0].datos.programValue === 3000, `"USD 3.000" = 3000 (dio ${r.filas[0].datos.programValue})`);
ok(r.filas[0].datos.cashCollected === 3000, `cobrado "USD 3.000" = 3000 (dio ${r.filas[0].datos.cashCollected})`);

r = leerLeadsCSV(`${CABECERA}\nLuis,,1/9/2026,,,,,,,,Mentoría,"$1,000",,,,`, 'c1', []);
ok(r.filas[0].datos.programValue === 1000, `"$1,000" = 1000 (dio ${r.filas[0].datos.programValue})`);

r = leerLeadsCSV(`${CABECERA}\nSofi,,1/9/2026,,,,,,,,Mentoría,"12,50",,,,`, 'c1', []);
ok(r.filas[0].datos.programValue === 12.5, `"12,50" sigue siendo decimal = 12.5 (dio ${r.filas[0].datos.programValue})`);

// ═══ FECHAS CON AÑO DE 2 DÍGITOS ═══
seccion('fechas "D-M-YY"');
r = leerLeadsCSV(`${CABECERA}\nPepe,,1/9/2026,,,18-9-26,,,,,,,,,,`, 'c1', []);
ok(r.filas[0].datos.fechaAgenda === '2026-09-18', `"18-9-26" → 2026-09-18 (dio ${r.filas[0].datos.fechaAgenda})`);

// ═══ "ÚLTIMO SEGUIMIENTO" CON TEXTO LIBRE ═══
seccion('"Último seguimiento" no-fecha');
r = leerLeadsCSV(`${CABECERA}\nNadia,,1/9/2026,,,,,,,,,,,,Reagendar llamada,Nota real`, 'c1', []);
ok(r.filas[0].datos.ultimoSeguimiento === undefined, 'texto libre no se fuerza a fecha');
ok(r.filas[0].datos.notas?.includes('Reagendar llamada'), 'texto libre se preserva en notas');
ok(r.filas[0].datos.notas?.includes('Nota real'), 'la columna Notas original no se pisa');

r = leerLeadsCSV(`${CABECERA}\nCarlos,,1/9/2026,,,,,,,,,,,,12/09/2026,`, 'c1', []);
ok(r.filas[0].datos.ultimoSeguimiento === '2026-09-12', `fecha real sí se parsea (dio ${r.filas[0].datos.ultimoSeguimiento}`);

// ═══ construirLeadDesdeFila no se rompe con los campos nuevos ═══
seccion('construirLeadDesdeFila');
const lead = construirLeadDesdeFila(r.filas[0].datos, 'c1');
ok(lead.telefono === undefined && lead.cashCollected === 0, 'lead final consistente, sin inventar datos');

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas pasaron.\n`);
process.exit(fallos === 0 ? 0 : 1);
