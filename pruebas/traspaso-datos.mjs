/**
 * Pruebas del paquete de traspaso.
 *
 * Aquí lo crítico son tres cosas, en este orden: que lo privado no salga, que
 * el contenido de las reuniones solo salga si se pidió, y que el diccionario
 * describa el archivo que de verdad se entrega y no otro imaginario.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: {
    traspaso: join(aqui, '../src/utils/traspasoDatos.ts'),
    zip: join(aqui, '../src/utils/crearZip.ts'),
  },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});
const { construirPaquete, diccionarioDeDatos, nombreTraspaso } = await import('./.build/traspaso.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const DATOS = {
  clientes: [
    { id: 'c1', agencyId: 'ag1', name: 'Acme', status: 'active', projectType: 'launch', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'c2', agencyId: 'ag1', name: 'Interno', isAgency: true, status: 'active', projectType: 'other', createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  tareas: [
    { id: 't1', clientId: 'c1', title: 'Pública', status: 'pending', priority: 'P1', assignedTo: 'designer', dueDate: '2026-09-01', externalId: 'PAR-9', createdAt: '2026-08-01' },
    { id: 't2', clientId: 'c1', title: 'MI TAREA PRIVADA', status: 'pending', priority: 'P1', assignedTo: 'Mari', dueDate: '2026-09-01', createdAt: '2026-08-01', esPrivada: true, propietarioId: 'u-mari' },
    { id: 't3', clientId: 'c1', title: 'Con undefined', status: 'pending', priority: 'P2', assignedTo: 'Ana', dueDate: '2026-09-02', createdAt: '2026-08-02', description: undefined },
  ],
  reuniones: [
    { id: 'm1', clientId: 'c1', title: 'Kickoff', type: 'kickoff', scheduledAt: '2026-08-05T14:00:00.000Z', durationMin: 60,
      participants: [{ userId: 'u1', name: 'Ana' }],
      transcription: 'SECRETO-TRANSCRIPCION', notes: 'SECRETO-NOTAS', summary: 'SECRETO-RESUMEN',
      reporte: { plantilla: 'daily', datos: 'SECRETO-REPORTE' } },
    { id: 'm2', clientId: 'c1', title: 'MI REUNION PRIVADA', type: 'general', scheduledAt: '2026-08-06T09:00:00.000Z', durationMin: 30, esPrivada: true, propietarioId: 'u-mari' },
  ],
  entregables: [{ id: 'l1', clientId: 'c1', taskId: 't1', nombre: 'Video', url: 'https://d/1', tipo: 'entregable', estado: 'aprobado', fuente: 'tarea', createdAt: '2026-08-03' }],
  equipo: [{ id: 'p1', clientId: 'c1', nombre: 'Ana', rol: 'designer' }],
  asignaciones: [{ clientId: 'c1', role: 'designer', carga: 3 }],
  ropre: [{ id: 'r1', clientId: 'c1', tipo: 'risk', texto: 'Riesgo X' }],
  programas: [],
  embudos: [{ id: 'f1', clientId: 'c1', nombre: 'Lanzamiento' }],
  fasesEmbudo: [{ id: 'fp1', funnelId: 'f1', nombre: 'Fase 1' }],
  contenido: [],
  proyecciones: { c1: { okrs: [] } },
};

const TODAS = ['clientes','tareas','reuniones','entregables','equipo','asignaciones','ropre','programas','embudos','fasesEmbudo','contenido','proyecciones'];
const AHORA = '2026-08-26T12:00:00.000Z';

// ═══ PRIVACIDAD ═══
seccion('privacidad (lo que NUNCA sale)');
let p = construirPaquete(DATOS, { incluirContenidoReuniones: false, tablas: TODAS }, AHORA);
let json = JSON.stringify(p);
ok(!json.includes('MI TAREA PRIVADA'), 'la tarea privada NO está en el paquete');
ok(!json.includes('MI REUNION PRIVADA'), 'la reunión privada NO está');
ok(!json.includes('u-mari'), 'ni el id del propietario de lo privado');
// Ojo: NO se puede buscar el texto 'esPrivada' en el JSON entero — aparece
// dentro de `_meta.excluido.reunionesPrivadas`, que es el contador. Se
// comprueba sobre las filas, que es donde importaría.
const filasTodas = [...p.clientes, ...p.tareas, ...p.reuniones, ...p.entregables];
ok(filasTodas.every((f) => !('esPrivada' in f) && !('propietarioId' in f)),
  'la marca interna de privacidad no viaja en ninguna fila');
ok(p.tareas.length === 2 && p.reuniones.length === 1, 'quedan las filas no privadas');

seccion('contenido de las reuniones');
ok(!json.includes('SECRETO-TRANSCRIPCION'), 'sin pedirlo, la transcripción NO sale');
ok(!json.includes('SECRETO-NOTAS'), 'sin pedirlo, las notas NO salen');
ok(!json.includes('SECRETO-RESUMEN'), 'sin pedirlo, el resumen NO sale');
ok(!json.includes('SECRETO-REPORTE'), 'sin pedirlo, el reporte guardado NO sale');
ok(p.reuniones[0].title === 'Kickoff' && p.reuniones[0].participants.length === 1, 'pero la reunión y sus asistentes sí');

const conContenido = JSON.stringify(construirPaquete(DATOS, { incluirContenidoReuniones: true, tablas: TODAS }, AHORA));
ok(conContenido.includes('SECRETO-TRANSCRIPCION'), 'pidiéndolo, la transcripción sí sale');
ok(!conContenido.includes('MI REUNION PRIVADA'), 'pero lo privado sigue fuera aunque se pida el contenido');

// ═══ FIDELIDAD ═══
seccion('fidelidad de los datos');
ok(p.tareas[0].id === 't1' && p.tareas[0].clientId === 'c1', 'los ids reales se conservan');
ok(p.tareas[0].status === 'pending', 'los valores van CRUDOS, sin traducir a español');
ok(p.tareas[0].assignedTo === 'designer', 'el responsable va tal cual, slug de rol incluido');
ok(p.tareas[0].externalId === 'PAR-9', 'el externalId anti-duplicados viaja');
ok(!Object.prototype.hasOwnProperty.call(p.tareas[1], 'description'), 'los campos vacíos no ensucian el archivo');
ok(p.clientes[1].isAgency === true, 'el espacio interno va marcado, no escondido');
ok(p.embudos.length === 1 && p.fasesEmbudo.length === 1, 'las tablas de apoyo van completas');
ok(p.proyecciones.c1 !== undefined, 'las proyecciones van indexadas por cliente');

// ═══ META ═══
seccion('_meta (qué dice el paquete de sí mismo)');
ok(p._meta.origen === 'Project360' && p._meta.formatoVersion === 1, 'origen y versión del formato');
ok(p._meta.agenciaId === 'ag1', 'la agencia dueña');
ok(p._meta.excluido.tareasPrivadas === 1 && p._meta.excluido.reunionesPrivadas === 1, 'dice CUÁNTAS filas dejó fuera');
ok(p._meta.conteos.tareas === 2 && p._meta.conteos.clientes === 2, 'los conteos cuadran con las listas');
ok(Object.keys(p._meta.conteos).length === Object.keys(p).length - 1, 'hay un conteo por cada tabla del paquete');

// ═══ DICCIONARIO ═══
seccion('diccionario');
const doc = diccionarioDeDatos(p, 'datos.json');
ok(doc.includes('datos.json'), 'nombra el archivo que explica');
ok(doc.includes('`clientId`'), 'explica la relación entre tablas');
ok(doc.includes('assignedTo'), 'avisa de la trampa del responsable (nombre o slug de rol)');
ok(doc.includes('externalId'), 'avisa de la clave anti-duplicados');
ok(doc.includes('1 tarea(s) y 1 reunión(es) privadas'), 'dice qué se dejó fuera, con números');
ok(doc.includes('excluido (transcripciones'), 'dice que el contenido de reuniones no va');
ok(diccionarioDeDatos(construirPaquete(DATOS, { incluirContenidoReuniones: true, tablas: TODAS }, AHORA), 'd.json').includes('incluido a petición'),
  'y si se pidió, lo dice también');
ok(!doc.includes('SECRETO'), 'el diccionario tampoco filtra contenido');
// El diccionario se genera del paquete: no puede describir tablas que no van.
const tablasDoc = [...doc.matchAll(/^\| `([a-zA-ZáéíóúÁÉÍÓÚ]+)` \| (\d+) \|/gm)].map((m) => [m[1], Number(m[2])]);
ok(tablasDoc.length > 0 && tablasDoc.every(([t, n]) => p._meta.conteos[t] === n),
  'los conteos del documento salen del paquete, no de una lista aparte');
ok(doc.includes('`fasesEmbudo`') && doc.includes('`funnelId`'),
  'las tablas de apoyo listan los campos que traen DE VERDAD los datos');

// ═══ SELECCIÓN DE TABLAS ═══
seccion('selección de tablas');
const OCHO = ['clientes','tareas','reuniones','entregables','equipo','asignaciones','ropre','fasesEmbudo'];
const sel = construirPaquete(DATOS, { incluirContenidoReuniones: false, tablas: OCHO }, AHORA);
ok(!('embudos' in sel) && !('contenido' in sel) && !('proyecciones' in sel) && !('programas' in sel),
  'las tablas no seleccionadas NO están en el paquete');
ok('clientes' in sel && 'ropre' in sel && sel.ropre.length === 1, 'las seleccionadas sí, con sus filas');
ok(Object.keys(sel._meta.conteos).length === OCHO.length, 'los conteos son solo de lo que va');
ok(sel._meta.tablasNoIncluidas.join(',') === 'programas,embudos,contenido,proyecciones',
  '_meta nombra las tablas que se dejaron fuera, en vez de callarlas');

const docSel = diccionarioDeDatos(sel, 'd.json');
ok(!docSel.includes('| `embudos` |'), 'el diccionario NO documenta una tabla que no viaja');
ok(docSel.includes('Tablas no incluidas en este envío'), 'y avisa de cuáles faltan');
ok(docSel.includes('`fasesEmbudo` apunta a `embudos`'),
  'avisa de la referencia que queda rota: fases sin su embudo');
ok(!diccionarioDeDatos(construirPaquete(DATOS, { incluirContenidoReuniones: false, tablas: TODAS }, AHORA), 'd.json')
  .includes('Referencias que quedan sin destino'), 'sin referencias rotas, no inventa el aviso');

const soloClientes = construirPaquete(DATOS, { incluirContenidoReuniones: false, tablas: ['clientes'] }, AHORA);
ok(Object.keys(soloClientes).length === 2, 'se puede mandar una sola tabla (_meta + clientes)');
ok(!diccionarioDeDatos(soloClientes, 'd.json').includes('### Tablas de apoyo'),
  'si no va ninguna tabla de apoyo, esa sección no se anuncia vacía');

seccion('nombres de archivo');
ok(nombreTraspaso(AHORA, 'json') === 'Project360-traspaso-2026-08-26.json', 'nombre del JSON');
ok(nombreTraspaso(AHORA, 'LEEME.md') === 'Project360-traspaso-2026-08-26.LEEME.md', 'nombre del documento');

// ═══ EL ZIP ═══
// Se genera de verdad y se abre con `unzip` del sistema: que la librería no
// tire error no prueba que el archivo se pueda abrir.
seccion('el zip (un envío = un archivo)');
const { crearZip } = await import('./.build/zip.js');
const { writeFileSync, mkdtempSync } = await import('node:fs');
const { execSync } = await import('node:child_process');
const { tmpdir } = await import('node:os');
const dir = mkdtempSync(join(tmpdir(), 'p360-zip-'));
const blob = await crearZip({ 'datos.json': JSON.stringify(sel, null, 2), 'LEEME.md': docSel });
writeFileSync(join(dir, 'p.zip'), Buffer.from(await blob.arrayBuffer()));
const listado = execSync(`unzip -l ${join(dir, 'p.zip')}`).toString();
ok(listado.includes('datos.json') && listado.includes('LEEME.md'), 'el zip lleva los DOS archivos');
const contenidoJson = execSync(`unzip -p ${join(dir, 'p.zip')} datos.json`).toString();
ok(JSON.parse(contenidoJson)._meta.origen === 'Project360', 'el JSON de dentro se abre y es el bueno');
const contenidoDoc = execSync(`unzip -p ${join(dir, 'p.zip')} LEEME.md`).toString();
ok(contenidoDoc.includes('Traspaso de datos'), 'el LEEME de dentro también');
ok(!contenidoJson.includes('MI TAREA PRIVADA') && !contenidoDoc.includes('MI TAREA PRIVADA'),
  'y lo privado sigue fuera dentro del zip');

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas de traspaso`);
process.exit(fallos === 0 ? 0 : 1);
