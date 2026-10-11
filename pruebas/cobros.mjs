import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const carpeta = await mkdtemp(join(tmpdir(), 'p360-cobros-'));
try {
  await build({
    entryPoints: ['src/utils/ventas.ts', 'src/utils/planCuotas.ts'],
    bundle: true, format: 'esm', platform: 'node', outdir: carpeta, outExtension: { '.js': '.mjs' },
    logLevel: 'error',
  });
  const { totalCobradoLead, saldoPendienteLead, resumenVentas, ventasForClient, comisionLead } = await import(pathToFileURL(join(carpeta, 'ventas.mjs')));
  const { calcularPlanCuotas, patchPlanCuotas } = await import(pathToFileURL(join(carpeta, 'planCuotas.mjs')));
  const lead = (patch = {}) => ({
    id: 'l1', clientId: 'c1', etapa: 'ganado', programValue: 500, cashCollected: 100,
    pago2Monto: 150, pago2Pagado: true, pago3Monto: 150, pago3Pagado: false,
    pago4Monto: 100, pago4Pagado: false, ...patch,
  });
  assert.equal(totalCobradoLead(lead()), 250, 'cuenta primer pago y cuota confirmada');
  assert.equal(saldoPendienteLead(lead()), 250);
  assert.equal(totalCobradoLead(lead({ pago3Fecha: '2020-01-01' })), 250, 'una fecha vencida no confirma cobro');
  assert.equal(totalCobradoLead(lead({ pago3Pagado: true, pago4Pagado: true })), 500);
  assert.equal(totalCobradoLead(lead({ pago2Pagado: false })), 100, 'desmarcar cuota revierte el total');
  assert.equal(totalCobradoLead(lead({ pago2Monto: undefined })), 100);
  assert.equal(saldoPendienteLead(lead({ cashCollected: 600 })), 0, 'sobrepago no crea deuda negativa');
  const legado = lead({ cashCollected: 3000, pago2Monto: undefined, pago2Pagado: undefined, programValue: 4000 });
  assert.equal(totalCobradoLead(legado), 3000, 'importación histórica sin cuotas conserva su importe');
  const seleccion = [lead(), lead({ id: 'l2', cashCollected: 600, pago2Pagado: false }), lead({ etapa: 'perdido' })];
  assert.deepEqual(resumenVentas(seleccion), { salesCount: 2, revenueAccumulated: 1000, cashCollected: 850, pendingCollection: 250 }, 'sobrepago no compensa deuda de otro comprador');
  assert.equal(ventasForClient([...seleccion, lead({ clientId: 'otro' })], 'c1').cashCollected, 850, 'aísla cliente');
  assert.deepEqual(resumenVentas([]), { salesCount: 0, revenueAccumulated: 0, cashCollected: 0, pendingCollection: 0 });
  assert.deepEqual(calcularPlanCuotas(5000, 2), [2500, 2500], 'dos cuotas automáticas sin recargo');
  assert.deepEqual(calcularPlanCuotas(100, 3), [33.33, 33.33, 33.34], 'resto en centavos se asigna a última cuota');
  assert.deepEqual(calcularPlanCuotas(100, 1), [100]);
  assert.equal(calcularPlanCuotas(4997, 4).reduce((a, b) => a + b, 0), 4997);
  assert.deepEqual(calcularPlanCuotas(0, 2), []);
  assert.deepEqual(calcularPlanCuotas(-100, 2), []);
  assert.deepEqual(calcularPlanCuotas(Infinity, 2), []);
  assert.equal(calcularPlanCuotas(100, 8).length, 4);
  const original = lead({ pago2Pagado: false, cashCollected: 100 });
  const patch = patchPlanCuotas(original, 5000, 2);
  assert.equal(patch.pago1Monto, 2500);
  assert.equal(patch.pago2Monto, 2500);
  assert.equal(patch.pago3Monto, null);
  assert.equal(patch.pago3Fecha, null);
  assert.equal('cashCollected' in patch, false, 'calcular no altera el primer cobro confirmado');
  assert.equal('pago2Pagado' in patch, false, 'calcular no confirma cuotas');
  assert.equal(totalCobradoLead({ ...original, ...patch }), 100, 'el plan no se convierte en dinero recibido');
  assert.throws(() => patchPlanCuotas(lead(), 5000, 2), /cuotas pagadas/, 'protege importes ya confirmados');
  assert.throws(() => patchPlanCuotas(lead({ pago4Pagado: true }), 500, 2), /cuotas pagadas/, 'no elimina una cuota pagada');
  assert.deepEqual(calcularPlanCuotas(5250, 2), [2625, 2625], 'recargo solo si está incluido en el precio acordado');
  assert.equal(comisionLead(lead(), 'setter'), 12.5, 'default setter 5%');
  assert.equal(comisionLead(lead(), 'closer'), 25, 'default closer 10%');
  assert.equal(comisionLead(lead({ setterComisionPct: 7.5 }), 'setter'), 18.75);
  assert.equal(comisionLead(lead({ closerComisionPct: 0 }), 'closer'), 0, 'cero es una comisión válida');
  assert.equal(comisionLead(lead({ etapa: 'nuevo' }), 'setter'), 0);
  assert.equal(comisionLead(lead({ cashCollected: 33.33, pago2Pagado: false }), 'setter'), 1.67, 'comisión redondeada a centavos');
  assert.equal(comisionLead(lead({ setterComisionPct: 4 }), 'setter') + comisionLead(lead({ setterComisionPct: 8 }), 'setter'), 30, 'tasas diferentes por venta');
  console.log('✓ Cobros: cuotas confirmadas, saldo por venta, filtros y propuesta de cuotas.');
} finally {
  await rm(carpeta, { recursive: true, force: true });
}
