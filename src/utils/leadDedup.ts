import type { Lead } from '@/types/lead';

/**
 * Detecta leads duplicados DENTRO de un cliente — mismo criterio que la
 * limpieza manual del 02-oct-2026 (31 pares, "David Guerrero/Alejo"): mismo
 * nombre + mismo teléfono normalizado. Dos leads con el mismo nombre pero sin
 * teléfono en ninguno de los dos, o con teléfonos distintos, NO se consideran
 * duplicados — coincidencia de nombre sola es demasiado débil (puede haber dos
 * personas reales con el mismo nombre).
 *
 * No borra nada por sí solo — devuelve los grupos para que una persona revise
 * y confirme, igual que el resto de bandejas de esta app (R-23).
 */

const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

const normalizarTelefono = (s: string): string => s.replace(/\D/g, '');

/** Clave de identidad: nombre normalizado + teléfono (solo si hay teléfono). */
function claveLead(l: Lead): string | null {
  const tel = l.telefono ? normalizarTelefono(l.telefono) : '';
  if (!tel) return null; // sin teléfono no se arriesga un falso positivo
  return `${normalizar(l.nombre)}::${tel}`;
}

/**
 * Qué tan "completo" está un lead — para sugerir cuál conservar del grupo.
 * Prioriza, en orden: haber avanzado de etapa (una venta real no se borra por
 * accidente), más campos llenos, más reciente.
 */
function puntaje(l: Lead): number {
  let p = 0;
  if (l.etapa !== 'nuevo') p += 1000; // lo que ya avanzó en el pipeline manda
  if (l.etapa === 'ganado') p += 1000; // una venta cerrada, doblemente protegida
  const campos: Array<keyof Lead> = [
    'email', 'perfilRol', 'score', 'banda', 'ruta', 'producto', 'formaPago',
    'setterId', 'closerId', 'fechaAgenda', 'fechaLlamada', 'resultado',
  ];
  p += campos.filter((c) => l[c] != null && l[c] !== '').length;
  if (l.cashCollected) p += 5;
  if (l.programValue) p += 5;
  p += new Date(l.createdAt).getTime() / 1e15; // desempate: más reciente
  return p;
}

export interface GrupoLeadsDuplicados {
  clave: string;
  /** El más completo del grupo — preseleccionado para CONSERVAR. */
  conservar: Lead;
  /** El resto del grupo — preseleccionados para ELIMINAR. */
  eliminar: Lead[];
}

export function detectarLeadsDuplicados(leads: Lead[], clientId: string): GrupoLeadsDuplicados[] {
  const porClave = new Map<string, Lead[]>();
  for (const l of leads) {
    if (l.clientId !== clientId) continue;
    const k = claveLead(l);
    if (!k) continue;
    const arr = porClave.get(k) ?? [];
    arr.push(l);
    porClave.set(k, arr);
  }

  const grupos: GrupoLeadsDuplicados[] = [];
  for (const [clave, grupo] of porClave) {
    if (grupo.length < 2) continue;
    const ordenado = [...grupo].sort((a, b) => puntaje(b) - puntaje(a));
    grupos.push({ clave, conservar: ordenado[0], eliminar: ordenado.slice(1) });
  }
  return grupos.sort((a, b) => b.eliminar.length - a.eliminar.length);
}
