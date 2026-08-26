/**
 * Pruebas de la exportación del portafolio.
 *
 * Lo que más importa aquí NO son las columnas: es que lo privado no se escape
 * y que las transcripciones no salgan. Esas dos van primero y con nombre
 * propio, para que si alguien añade una columna y las rompe, el CI lo diga.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { exportar: join(aqui, '../src/utils/exportarPortafolio.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});
const M = await import('./.build/exportar.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const hoy = new Date().toISOString().slice(0, 10);
const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const CLIENTES = [
  { id: 'c1', name: 'Acme', sigla: 'AC', industry: 'Salud', businessType: 'Servicios',
    status: 'active', projectType: 'launch', monthlyAdsBudget: 500,
    onboardingData: { identity: { country: 'Colombia', city: 'Bogotá', founderName: 'Ana', email: 'a@x.com', whatsapp: '300', website: 'https://x.com' } },
    createdAt: '2026-01-15T10:00:00.000Z' },
  { id: 'c2', name: 'Ikigai', isAgency: true, industry: '', businessType: '',
    status: 'active', projectType: 'other', monthlyAdsBudget: 0, onboardingData: {}, createdAt: '2026-01-01T10:00:00.000Z' },
];

const TAREAS = [
  { id: 't1', clientId: 'c1', title: 'Landing', assignedTo: 'Marcelo', status: 'completed', priority: 'P1', dueDate: ayer, completedAt: ayer, createdAt: ayer },
  { id: 't2', clientId: 'c1', title: 'Ads', assignedTo: 'designer', status: 'pending', priority: 'P2', dueDate: ayer, createdAt: ayer },
  { id: 't3', clientId: 'c1', title: 'Copy', assignedTo: 'Ana', status: 'pending', priority: 'P3', dueDate: manana, createdAt: hoy },
  { id: 't4', clientId: 'c1', title: 'MI TAREA PRIVADA', assignedTo: 'Mari', status: 'pending', priority: 'P1', dueDate: manana, createdAt: hoy, esPrivada: true },
];

const REUNIONES = [
  { id: 'm1', clientId: 'c1', title: 'Kickoff', type: 'kickoff', scheduledAt: '2026-08-05T14:30:00.000Z', durationMin: 60,
    participants: [{ userId: 'u1', name: 'Ana' }, { userId: 'u2', name: 'Marcelo' }], completed: true,
    transcription: 'SECRETO DE LA TRANSCRIPCION', notes: 'SECRETO DE LAS NOTAS', summary: 'SECRETO DEL RESUMEN' },
  { id: 'm2', clientId: 'c1', title: 'MI REUNION PRIVADA', type: 'general', scheduledAt: manana + 'T09:00:00.000Z', durationMin: 30, participants: [], esPrivada: true },
];

const ENTREGABLES = [
  { id: 'l1', clientId: 'c1', nombre: 'Video final', url: 'https://drive/x', tipo: 'entregable',
    estado: 'aprobado', createdByNombre: 'Juan Camilo', fuente: 'tarea', createdAt: ayer },
];

const resolver = (a) => (a === 'designer' ? 'Diseñador' : a);

// ═══ PRIVACIDAD — lo primero ═══
seccion('privacidad (lo que NUNCA puede salir)');
const csvTareas = M.tablaACSV(M.tablaTareas(TAREAS, CLIENTES, resolver));
ok(!csvTareas.includes('MI TAREA PRIVADA'), 'una tarea privada NO sale en el archivo');
ok(M.tablaTareas(TAREAS, CLIENTES, resolver).filas.length === 3, 'salen las 3 no privadas');

const csvAgenda = M.tablaACSV(M.tablaReuniones(REUNIONES, CLIENTES));
ok(!csvAgenda.includes('MI REUNION PRIVADA'), 'una reunión privada NO sale');
ok(!csvAgenda.includes('SECRETO DE LA TRANSCRIPCION'), 'la transcripción NO sale');
ok(!csvAgenda.includes('SECRETO DE LAS NOTAS'), 'las notas NO salen');
ok(!csvAgenda.includes('SECRETO DEL RESUMEN'), 'el resumen NO sale');
ok(csvAgenda.includes('Kickoff'), 'pero la reunión sí figura, con su título');

const csvClientes = M.tablaACSV(M.tablaClientes(CLIENTES, TAREAS));
ok(!csvClientes.includes('MI TAREA PRIVADA'), 'la privada tampoco se cuela por los conteos');

// ═══ CLIENTES ═══
seccion('tabla de clientes');
let t = M.tablaClientes(CLIENTES, TAREAS);
const acme = t.filas[0];
const col = (nombre) => t.columnas.indexOf(nombre);
ok(acme[col('Cliente')] === 'Acme' && acme[col('Estado')] === 'Activo', 'nombre y estado en español');
ok(acme[col('Tipo de proyecto')] === 'Lanzamiento', 'tipo de proyecto en español');
ok(acme[col('Tareas totales')] === 3, 'cuenta solo las tareas NO privadas');
ok(acme[col('Tareas pendientes')] === 2, 'pendientes');
ok(acme[col('Tareas vencidas')] === 1, 'vencidas: la de ayer sin completar; la completada no cuenta');
ok(acme[col('Avance %')] === 33, 'avance = completadas / totales');
ok(acme[col('Ciudad')] === 'Bogotá' && acme[col('Email')] === 'a@x.com', 'datos de contacto');
ok(t.filas[1][col('Es espacio interno')] === 'Sí', 'el espacio de la agencia se marca, no se esconde');
ok(t.filas[1][col('Avance %')] === 0, 'un cliente sin tareas da 0 y no se rompe');

// ═══ TAREAS ═══
seccion('tabla de tareas');
t = M.tablaTareas(TAREAS, CLIENTES, resolver);
const c2 = (nombre) => t.columnas.indexOf(nombre);
ok(t.filas[0][c2('Cliente')] === 'Acme', 'el cliente sale por nombre, no por id');
ok(t.filas[1][c2('Responsable')] === 'Diseñador', 'el responsable pasa por el traductor de siempre');
ok(t.filas[0][c2('Estado')] === 'Completada', 'estado en español');
ok(t.filas[1][c2('Vencida')] === 'Sí' && t.filas[1][c2('Días de atraso')] === 1, 'vencida con sus días');
ok(t.filas[0][c2('Vencida')] === 'No', 'una completada no está vencida aunque su fecha pasara');
ok(t.filas[2][c2('Vencida')] === 'No', 'una pendiente con fecha futura no está vencida');
ok(t.filas[0][c2('Fecha de entrega')].length === 10, 'la fecha sale sin hora');

// ═══ ENTREGABLES ═══
seccion('tabla de entregables');
t = M.tablaEntregables(ENTREGABLES, CLIENTES);
ok(t.filas[0][t.columnas.indexOf('Link')] === 'https://drive/x', 'el link sale entero');
ok(t.filas[0][t.columnas.indexOf('Revisión')] === 'Aprobado', 'estado de revisión en español');
ok(t.filas[0][t.columnas.indexOf('Origen')] === 'De una tarea', 'origen legible');

// ═══ FORMATO CSV ═══
seccion('formato del archivo');
ok(M.SEPARADOR === ';', 'separador ";" — el que abre bien el Excel en español');
const conComillas = M.tablaACSV({ nombre: 'X', columnas: ['a'], filas: [['di "hola"']] });
ok(conComillas.includes('"di ""hola"""'), 'las comillas se duplican y la celda se entrecomilla');
const conSep = M.tablaACSV({ nombre: 'X', columnas: ['a'], filas: [['uno; dos']] });
ok(conSep.split('\r\n')[1] === '"uno; dos"', 'una celda con el separador dentro se entrecomilla');
const conSalto = M.tablaACSV({ nombre: 'X', columnas: ['a'], filas: [['linea1\nlinea2']] });
ok(conSalto.split('\r\n').length === 2 && conSalto.includes('"linea1\nlinea2"'), 'un salto de línea dentro de la celda no parte la fila (2 filas, no 3)');
ok(M.tablaACSV({ nombre: 'X', columnas: ['a', 'b'], filas: [] }) === 'a;b', 'una tabla vacía deja la cabecera, no un archivo en blanco');
ok(M.nombreArchivo('Tareas', '2026-08-26T00:00:00Z', 'csv') === 'Project360-Tareas-2026-08-26.csv', 'nombre del archivo con fecha');

// ═══ IDA Y VUELTA ═══
seccion('ida y vuelta');
const { parsearCSV } = await import('./.build/csv.js').catch(() => ({}));
if (parsearCSV) {
  const vuelta = parsearCSV(M.tablaACSV(M.tablaTareas(TAREAS, CLIENTES, resolver)));
  ok(vuelta.length === 4, 'lo que exportamos lo vuelve a leer nuestro propio parser (1 cabecera + 3 filas)');
} else {
  console.log('  ⏭  (ida y vuelta se prueba junto con test:csv)');
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas de exportación`);
process.exit(fallos === 0 ? 0 : 1);
