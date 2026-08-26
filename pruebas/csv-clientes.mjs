/**
 * Pruebas de la importación de clientes por CSV.
 *
 * Compila `src/utils/csvClientes.ts` con esbuild (mismo truco que
 * `pruebas/api-v1.mjs`) y ejercita el código real, sin navegador ni base.
 * Lo corre `npm run test:csv` y también `npm run check`.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: { csv: join(aqui, '../src/utils/csvClientes.ts') },
  bundle: true, format: 'esm', platform: 'neutral',
  outdir: join(aqui, '.build'), logLevel: 'error',
  alias: { '@': join(aqui, '../src') },
});
const { parsearCSV, leerClientesCSV, construirClienteDesdeFila } = await import('./.build/csv.js');

let fallos = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { console.log('  ❌', msg); fallos++; } else console.log('  ✅', msg); };
const seccion = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

// ═══ PARSEO ═══
seccion('parseo del texto');
ok(JSON.stringify(parsearCSV('a,b\n1,2')) === JSON.stringify([['a','b'],['1','2']]), 'coma simple');
ok(parsearCSV('a;b\n1;2')[1][1] === '2', 'detecta separador ";" (Excel en español)');
ok(parsearCSV('nombre,industria\n"Pérez, S.A.",Salud')[1][0] === 'Pérez, S.A.', 'coma dentro de comillas');
ok(parsearCSV('a\n"di ""hola"""')[1][0] === 'di "hola"', 'comillas escapadas');
ok(parsearCSV('a\n"linea1\nlinea2"')[1][0] === 'linea1\nlinea2', 'salto de línea dentro de una celda');
ok(parsearCSV('﻿nombre,x\r\nA,1')[0][0] === 'nombre', 'BOM y CRLF de Excel');
ok(parsearCSV('a,b\n1,2\n\n').length === 2, 'ignora líneas vacías al final');

// ═══ CABECERAS ═══
seccion('cabeceras');
ok(leerClientesCSV('industria\nSalud', []).error !== undefined, 'sin columna de nombre → error del archivo entero');
ok(leerClientesCSV('', []).error !== undefined, 'archivo vacío → error');
let r = leerClientesCSV('Empresa,Sector\nAcme,Salud', []);
ok(r.filas[0].datos.industria === 'Salud', 'acepta alias ("Empresa", "Sector")');
r = leerClientesCSV('NOMBRE,Tipo de Negocio\nAcme,Servicios', []);
ok(r.filas[0].datos.tipoNegocio === 'Servicios', 'cabeceras con mayúsculas y espacios');
r = leerClientesCSV('nombre,columna_rara\nAcme,x', []);
ok(r.columnasIgnoradas.includes('columna_rara'), 'avisa de las columnas que ignora');
ok(r.filas[0].estado === 'nueva', 'una columna desconocida no tumba la fila');

// ═══ DUPLICADOS (R-24, R-44) ═══
seccion('duplicados');
r = leerClientesCSV('nombre\nAcme\nOtra', [{ name: 'ACME' }]);
ok(r.filas[0].estado === 'existente', 'un cliente que ya existe se marca existente, no se duplica');
ok(r.filas[1].estado === 'nueva', 'la otra fila sigue importable');
ok(leerClientesCSV('nombre\nCafé S.A.', [{ name: 'Cafe S.A.' }]).filas[0].estado === 'existente', 'empareja sin importar acentos');
r = leerClientesCSV('nombre\nAcme\nacme', []);
ok(r.filas[1].estado === 'rechazada' && r.filas[1].motivo.includes('línea 2'), 'repetido dentro del archivo, señalando la línea original');

// ═══ VALIDACIÓN (R-22, R-33) ═══
seccion('validación');
r = leerClientesCSV('nombre,industria\n,Salud\nAcme,Salud', []);
ok(r.filas[0].estado === 'rechazada' && r.filas[0].linea === 2, 'fila sin nombre se rechaza, con su número de línea');
r = leerClientesCSV('nombre,estado\nAcme,inventado', []);
ok(r.filas[0].estado === 'rechazada' && r.filas[0].motivo.includes('inventado'), 'estado no reconocido se rechaza citando el valor');
ok(leerClientesCSV('nombre,estado\nAcme,En Pausa', []).filas[0].datos.estado === 'paused', 'traduce la etiqueta en español a su valor interno');
ok(leerClientesCSV('nombre,tipo_proyecto\nAcme,Marca Personal', []).filas[0].datos.tipoProyecto === 'personal_brand', 'tipo de proyecto en español');
ok(leerClientesCSV('nombre,tipo_proyecto\nAcme,ninguno', []).filas[0].estado === 'rechazada', 'tipo de proyecto no reconocido se rechaza');
ok(leerClientesCSV('nombre,presupuesto_ads\nAcme,"$1.200"', []).filas[0].datos.presupuestoAds === 1200, 'monto con símbolo y punto de miles');
ok(leerClientesCSV('nombre,presupuesto_ads\nAcme,"1.200,50"', []).filas[0].datos.presupuestoAds === 1200.5, 'monto en formato latino');
ok(leerClientesCSV('nombre,presupuesto_ads\nAcme,"1,200.50"', []).filas[0].datos.presupuestoAds === 1200.5, 'monto en formato inglés');
ok(leerClientesCSV('nombre,presupuesto_ads\nAcme,mucho', []).filas[0].estado === 'rechazada', 'monto que no es número se rechaza');

// ═══ CONSTRUCCIÓN DEL CLIENTE ═══
seccion('construcción del cliente');
const fila = leerClientesCSV(
  'nombre,industria,estado,email,ciudad\nDavid Guerrero,Salud,activo,d@x.com,Bogotá', [],
).filas[0];
const c = construirClienteDesdeFila(fila.datos, 'ag-1');
ok(c.name === 'David Guerrero' && c.agencyId === 'ag-1', 'nombre y agencia');
ok(c.sigla === 'DG', 'sigla derivada del nombre cuando el archivo no la trae');
ok(c.status === 'active' && c.industry === 'Salud', 'estado e industria del archivo');
ok(c.onboardingData.identity.email === 'd@x.com' && c.onboardingData.identity.city === 'Bogotá', 'identidad rellenada');
ok(JSON.stringify(c.aiBrainData) === '{}', 'NO se inventa cerebro de IA');
ok(c.projectType === 'other' && c.monthlyAdsBudget === 0, 'lo que el archivo no dice queda neutro, no inventado');
const minimo = construirClienteDesdeFila(leerClientesCSV('nombre\nAcme', []).filas[0].datos, 'ag-1');
ok(minimo.status === 'onboarding', 'sin estado en el archivo, entra en onboarding');
ok(minimo.industry === '' && minimo.businessType === '', 'campos ausentes quedan vacíos');
ok(construirClienteDesdeFila({ nombre: 'X', sigla: 'ZZ' }, 'a').sigla === 'ZZ', 'la sigla del archivo manda sobre la derivada');

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas de CSV`);
process.exit(fallos === 0 ? 0 : 1);
