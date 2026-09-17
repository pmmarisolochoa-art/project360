/**
 * Los periodos que puede cubrir un informe.
 *
 * Van aquí, puros y sin dependencias, porque los cortes de fecha son
 * exactamente donde se cuela el error de un día — y así se pueden probar de
 * verdad en vez de probar una copia de la regla.
 *
 * Todos los rangos son INCLUSIVOS por los dos lados: `desde` empieza a las
 * 00:00 y `hasta` termina a las 23:59:59. Un entregable que vence el día 30 a
 * las 18:00 pertenece a la quincena que acaba el 30.
 */
export type ClavePeriodo = 'semana' | 'quincena' | 'mes' | 'rango';

export interface Periodo {
  etiqueta: string;
  desde: Date;
  hasta: Date;
}

const inicioDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const finDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Lunes a domingo de la semana en la que cae `ref`. */
export function semanaDe(ref: Date): Periodo {
  const dow = ref.getDay();               // 0 = domingo
  const alLunes = dow === 0 ? 6 : dow - 1; // el domingo pertenece a la semana que empezó el lunes
  const lunes = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - alLunes);
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
  return { etiqueta: 'Semana', desde: inicioDe(lunes), hasta: finDe(domingo) };
}

/** Del 1 al 15, o del 16 al último día del mes. */
export function quincenaDe(ref: Date): Periodo {
  const primera = ref.getDate() <= 15;
  const desde = new Date(ref.getFullYear(), ref.getMonth(), primera ? 1 : 16);
  // Día 0 del mes siguiente = último del actual. Sirve para 28, 29, 30 y 31 sin
  // tener que saber cuál es, febrero bisiesto incluido.
  const hasta = primera
    ? new Date(ref.getFullYear(), ref.getMonth(), 15)
    : new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { etiqueta: 'Quincena', desde: inicioDe(desde), hasta: finDe(hasta) };
}

/** El mes completo en el que cae `ref`. */
export function mesDe(ref: Date): Periodo {
  const desde = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const hasta = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { etiqueta: 'Mes', desde: inicioDe(desde), hasta: finDe(hasta) };
}

/**
 * Rango elegido a mano. Acepta 'YYYY-MM-DD' (lo que da un <input type="date">).
 *
 * Se construye con partes y no con `new Date('2026-09-16')`, que el navegador
 * interpreta como UTC: en Colombia eso cae el día 15 a las 19:00 y el rango
 * empieza un día antes de lo que se eligió.
 */
export function rangoDe(desdeISO: string, hastaISO: string): Periodo | null {
  const parse = (s: string): Date | null => {
    const [y, m, d] = (s ?? '').split('-').map(Number);
    if (!y || !m || !d) return null;
    const fecha = new Date(y, m - 1, d);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  };
  const a = parse(desdeISO);
  const b = parse(hastaISO);
  if (!a || !b) return null;
  // Si vienen al revés se enderezan en vez de devolver un rango vacío que no
  // explicaría por qué el informe sale sin entregables.
  const [ini, fin] = a <= b ? [a, b] : [b, a];
  return { etiqueta: 'Rango', desde: inicioDe(ini), hasta: finDe(fin) };
}

export function periodoDe(clave: Exclude<ClavePeriodo, 'rango'>, ref: Date): Periodo {
  return clave === 'semana' ? semanaDe(ref) : clave === 'quincena' ? quincenaDe(ref) : mesDe(ref);
}
