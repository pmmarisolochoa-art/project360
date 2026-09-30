/**
 * Importar leads desde un archivo CSV/Excel (la Sheet que alimenta el
 * formulario de la landing, exportada a CSV).
 *
 * Mismo patrón que `csvClientes.ts` — lógica pura, sin React ni Supabase — y
 * las mismas reglas (REGLAS_del_Sistema.md):
 *   R-22 — lo mal formado se rechaza con motivo, no se completa a la brava.
 *   R-23 — nada entra automáticamente: entra lo que una persona marca.
 *   R-24 — lo que ya existe se muestra en gris, no se esconde.
 *   R-44 — idempotente: reimportar el mismo archivo no duplica.
 *
 * Identidad de un lead en el archivo: NO tiene nombre único como un cliente
 * (dos leads bien pueden llamarse igual). Se identifica por teléfono o email
 * normalizado — lo primero que traiga el formulario de captación. Un lead sin
 * ninguno de los dos se importa igual (no se rechaza): pasa a revisión manual
 * en el drawer, mejor que perderlo.
 */
import { parsearCSV } from './csvClientes';
import type { Lead, LeadSource } from '@/types/lead';
import { LEAD_SOURCES } from '@/types/lead';

export interface DatosFilaLead {
  nombre: string;
  telefono?: string;
  email?: string;
  fuente: LeadSource;
  perfilRol?: string;
}

export type EstadoFilaLead = 'nueva' | 'existente' | 'rechazada';

export interface FilaLeadRevision {
  linea: number;
  nombreCrudo: string;
  estado: EstadoFilaLead;
  motivo?: string;
  datos?: DatosFilaLead;
}

export interface LecturaLeadsCSV {
  filas: FilaLeadRevision[];
  error?: string;
  columnasIgnoradas: string[];
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Deja solo dígitos — así "+57 300 000 0000" y "300-000-0000" son el mismo teléfono. */
function normalizarTelefono(s: string): string {
  return s.replace(/\D/g, '');
}

const COLUMNAS: Record<keyof DatosFilaLead, string[]> = {
  nombre: ['nombre', 'lead', 'name', 'nombrelead', 'nombrecompleto'],
  telefono: ['telefono', 'whatsapp', 'celular', 'movil', 'phone', 'numero'],
  email: ['email', 'correo', 'correoelectronico', 'mail'],
  fuente: ['fuente', 'origen', 'source', 'canal'],
  perfilRol: ['perfilrol', 'perfil', 'rol', 'quienes', 'tipodecomprador', 'comprador'],
};

/** Alias generosos: el nombre exacto de la fuente en el CSV rara vez calza con nuestro enum. */
const FUENTES: Record<string, LeadSource> = {
  metaads: 'meta_ads', meta: 'meta_ads', ads: 'meta_ads', facebookads: 'meta_ads', instagramads: 'meta_ads',
  reel: 'reel', reels: 'reel',
  story: 'story', stories: 'story', historia: 'story',
  carrusel: 'carrusel', carousel: 'carrusel',
  perfil: 'perfil', bio: 'perfil', biolink: 'perfil',
  referido: 'referido', referral: 'referido', recomendado: 'referido',
  otro: 'otro', other: 'otro', organico: 'otro', landing: 'otro', formulario: 'otro', web: 'otro',
};
const ETIQUETAS_FUENTE = LEAD_SOURCES.join(', ');

export function leerLeadsCSV(
  texto: string,
  clientId: string,
  existentes: Lead[],
): LecturaLeadsCSV {
  const crudas = parsearCSV(texto);
  if (crudas.length === 0) {
    return { filas: [], columnasIgnoradas: [], error: 'El archivo está vacío.' };
  }

  const cabecera = crudas[0].map(normalizar);
  const indice = {} as Record<keyof DatosFilaLead, number>;
  const usadas = new Set<number>();
  (Object.keys(COLUMNAS) as Array<keyof DatosFilaLead>).forEach((campo) => {
    const i = cabecera.findIndex((h) => COLUMNAS[campo].includes(h));
    indice[campo] = i;
    if (i >= 0) usadas.add(i);
  });

  if (indice.nombre < 0) {
    return {
      filas: [],
      columnasIgnoradas: [],
      error: 'No encontramos la columna del nombre del lead. La primera fila debe traer una cabecera con "nombre" (o "lead").',
    };
  }

  const columnasIgnoradas = crudas[0]
    .map((h, i) => ({ h: h.trim(), i }))
    .filter(({ h, i }) => h !== '' && !usadas.has(i))
    .map(({ h }) => h);

  const idsPorClave = new Map<string, string>(); // teléfono o email normalizado → id existente
  for (const l of existentes) {
    if (l.clientId !== clientId) continue;
    if (l.telefono) idsPorClave.set(`tel:${normalizarTelefono(l.telefono)}`, l.id);
    if (l.email) idsPorClave.set(`mail:${normalizar(l.email)}`, l.id);
  }
  const vistosEnElArchivo = new Set<string>();

  const filas: FilaLeadRevision[] = crudas.slice(1).map((celdas, i) => {
    const linea = i + 2;
    const leer = (campo: keyof DatosFilaLead): string => {
      const idx = indice[campo];
      return idx >= 0 ? (celdas[idx] ?? '').trim() : '';
    };

    const nombre = leer('nombre');
    if (!nombre) {
      return { linea, nombreCrudo: '', estado: 'rechazada', motivo: 'Sin nombre de lead.' };
    }

    const telefono = leer('telefono') || undefined;
    const email = leer('email') || undefined;
    const claveTel = telefono ? `tel:${normalizarTelefono(telefono)}` : null;
    const claveMail = email ? `mail:${normalizar(email)}` : null;

    for (const clave of [claveTel, claveMail]) {
      if (!clave || clave === 'tel:' || clave === 'mail:') continue;
      if (idsPorClave.has(clave)) {
        return { linea, nombreCrudo: nombre, estado: 'existente', motivo: 'Ya existe un lead con ese teléfono o email.' };
      }
      if (vistosEnElArchivo.has(clave)) {
        return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: 'Repetido en el archivo (mismo teléfono o email que otra línea).' };
      }
    }
    if (claveTel && claveTel !== 'tel:') vistosEnElArchivo.add(claveTel);
    if (claveMail && claveMail !== 'mail:') vistosEnElArchivo.add(claveMail);

    const fuenteTexto = leer('fuente');
    let fuente: LeadSource = 'otro';
    if (fuenteTexto) {
      const encontrada = FUENTES[normalizar(fuenteTexto)];
      if (!encontrada) {
        return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: `Fuente "${fuenteTexto}" no reconocida. Valores válidos: ${ETIQUETAS_FUENTE}.` };
      }
      fuente = encontrada;
    }

    const datos: DatosFilaLead = { nombre, telefono, email, fuente, perfilRol: leer('perfilRol') || undefined };
    return { linea, nombreCrudo: nombre, estado: 'nueva', datos };
  });

  return { filas, columnasIgnoradas };
}

export function construirLeadDesdeFila(datos: DatosFilaLead, clientId: string): Lead {
  const ahora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    clientId,
    nombre: datos.nombre,
    telefono: datos.telefono,
    email: datos.email,
    fuente: datos.fuente,
    perfilRol: datos.perfilRol,
    etapa: 'nuevo',
    cashCollected: 0,
    createdAt: ahora,
    updatedAt: ahora,
  };
}

export const CSV_PLANTILLA_LEADS = [
  'nombre,telefono,email,fuente,perfil_rol',
  'Camila Restrepo,+57 300 000 0000,camila@ejemplo.com,meta_ads,Mamá',
].join('\n');
