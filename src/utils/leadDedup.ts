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

/**
 * Clave de identidad fuerte: nombre + teléfono. Cuando NINGUNO de los dos
 * trae teléfono (ej. leads de un CSV cuyo "Contacto" es un usuario de
 * Instagram, no un número — caso real de Alejo, 03-oct-2026), se cae a
 * nombre EXACTO normalizado solo, marcado como confianza `'nombre'` para que
 * la bandeja lo distinga de un match por teléfono (más fuerte).
 */
function claveLead(l: Lead): { clave: string; confianza: 'fuerte' | 'nombre' } | null {
  const tel = l.telefono ? normalizarTelefono(l.telefono) : '';
  if (tel) return { clave: `${normalizar(l.nombre)}::${tel}`, confianza: 'fuerte' };
  const nombre = normalizar(l.nombre);
  if (!nombre) return null;
  return { clave: `nombre::${nombre}`, confianza: 'nombre' };
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
  /** 'fuerte' = mismo nombre+teléfono. 'nombre' = mismo nombre exacto, sin teléfono en ninguno — revisar con más cuidado. */
  confianza: 'fuerte' | 'nombre';
  /** El más completo del grupo — preseleccionado para CONSERVAR. */
  conservar: Lead;
  /** El resto del grupo — preseleccionados para ELIMINAR. */
  eliminar: Lead[];
}

export function detectarLeadsDuplicados(leads: Lead[], clientId: string): GrupoLeadsDuplicados[] {
  const porClave = new Map<string, { confianza: 'fuerte' | 'nombre'; grupo: Lead[] }>();
  for (const l of leads) {
    if (l.clientId !== clientId) continue;
    const k = claveLead(l);
    if (!k) continue;
    const entry = porClave.get(k.clave) ?? { confianza: k.confianza, grupo: [] };
    entry.grupo.push(l);
    porClave.set(k.clave, entry);
  }

  const grupos: GrupoLeadsDuplicados[] = [];
  for (const [clave, { confianza, grupo }] of porClave) {
    if (grupo.length < 2) continue;
    const ordenado = [...grupo].sort((a, b) => puntaje(b) - puntaje(a));
    grupos.push({ clave, confianza, conservar: ordenado[0], eliminar: ordenado.slice(1) });
  }
  // Fuerte primero (más confiable), y dentro de cada confianza, grupos más grandes primero.
  return grupos.sort((a, b) =>
    a.confianza === b.confianza ? b.eliminar.length - a.eliminar.length : a.confianza === 'fuerte' ? -1 : 1,
  );
}
