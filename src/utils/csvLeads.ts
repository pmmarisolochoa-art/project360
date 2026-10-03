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
 * Identidad de un lead en el archivo: si trae un id propio (`lead_id`,
 * `external_id`...) ese manda — es la misma clave que usa el endpoint
 * `/api/v1/leads` (migración 049), así que un archivo y un webhook del mismo
 * formulario nunca se pisan. Sin id propio, se identifica por teléfono o
 * email normalizado. Un lead sin ninguno de los tres se importa igual (no se
 * rechaza): pasa a revisión manual en el drawer, mejor que perderlo.
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
  externalId?: string;
  score?: number;
  banda?: string;
  ruta?: string;
  createdAt?: string;
  /**
   * Usuario de Instagram/red social del CSV (columna "Contacto" en el
   * formato de Alejo) — NO es un teléfono. Solo se usa como identidad para
   * detectar duplicados dentro del archivo; no se guarda en el Lead porque
   * no hay campo para eso todavía (ver REGLAS si algún día hace falta
   * persistirlo de verdad).
   */
  contacto?: string;
  /** Nombre crudo del CSV — se resuelve a id de equipo si hay match exacto o por primer nombre único. */
  setterNombre?: string;
  closerNombre?: string;
  setterId?: string;
  closerId?: string;
  fechaAgenda?: string;
  fechaLlamada?: string;
  asistio?: string;
  resultado?: string;
  producto?: string;
  formaPago?: string;
  programValue?: number;
  cashCollected?: number;
  lostReason?: string;
  ultimoSeguimiento?: string;
  notas?: string;
}

type CampoTexto =
  | 'nombre' | 'telefono' | 'email' | 'fuente' | 'perfilRol' | 'externalId'
  | 'score' | 'banda' | 'ruta' | 'creadoEn' | 'utmSource' | 'contacto'
  | 'setter' | 'closer' | 'fechaAgenda' | 'fechaLlamada' | 'asistio' | 'resultado'
  | 'producto' | 'formaPago' | 'precioPactado' | 'totalCobrado' | 'motivoNoCerro'
  | 'ultimoSeguimiento' | 'notas';

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

/**
 * Normaliza un NOMBRE DE PERSONA para comparar — a diferencia de `normalizar`
 * (que quita espacios, pensada para cabeceras de columna), esta SÍ conserva
 * los espacios: hace falta saber si "Andrés" es una palabra o dos para
 * decidir si se resuelve por primer-nombre-único.
 */
function normalizarNombre(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

const COLUMNAS: Record<CampoTexto, string[]> = {
  nombre: ['nombre', 'lead', 'name', 'nombrelead', 'nombrecompleto'],
  telefono: ['telefono', 'whatsapp', 'celular', 'movil', 'phone', 'numero'],
  email: ['email', 'correo', 'correoelectronico', 'mail'],
  fuente: ['fuente', 'origen', 'source', 'canal', 'canaldeentrada'],
  // 'a5'/'b5' — patrón de formularios de calificación por ramas A/B (ej. RPM
  // Method): la última pregunta de cada rama suele ser "quién decide" o "hace
  // cuánto compite", que es justo el perfil del comprador.
  perfilRol: ['perfilrol', 'perfil', 'rol', 'quienes', 'tipodecomprador', 'comprador', 'a5', 'b5'],
  externalId: ['leadid', 'externalid', 'id'],
  score: ['score', 'puntaje', 'puntuacion'],
  banda: ['banda', 'tier', 'calificacion'],
  // OJO: 'ruta' (track de calificación: sprint/academy/method) y 'producto'
  // (lo que de verdad se cerró) son campos DISTINTOS aunque suenen parecido
  // — no comparten alias, o la misma columna llenaría los dos a la vez.
  ruta: ['ruta'],
  creadoEn: ['enviado', 'fecha', 'fechaenvio', 'timestamp', 'creadoen', 'fecha1ercontacto'],
  utmSource: ['utmsource'],
  // Usuario de IG/red social (CSV de Alejo: columna "Contacto") — NO es
  // teléfono. Solo sirve como identidad de respaldo, ver `DatosFilaLead.contacto`.
  contacto: ['contacto', 'usuario', 'usuarioinstagram', 'instagram', 'ig'],
  setter: ['setter'],
  closer: ['closer'],
  fechaAgenda: ['fechadeagenda', 'fechaagenda'],
  fechaLlamada: ['fechadelallamada', 'fechallamada'],
  asistio: ['asistio'],
  resultado: ['resultado'],
  producto: ['producto', 'programa'],
  formaPago: ['formadepago', 'formapago'],
  precioPactado: ['preciopactado', 'valorpactado', 'precio'],
  totalCobrado: ['totalcobrado', 'totalrecaudado', 'cashcollected'],
  motivoNoCerro: ['motivosinocerro', 'motivonocerro'],
  ultimoSeguimiento: ['ultimoseguimiento'],
  notas: ['notas', 'nota', 'observaciones'],
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

/**
 * `utm_source` es texto libre de la plataforma de ads (ig/fb/an…), no un dato
 * que alguien tecleó — así que a diferencia de la columna `fuente` explícita,
 * un valor que no reconocemos NO rechaza la fila: se cae a 'otro' en
 * silencio. Rechazar leads reales por un UTM raro sería peor que clasificarlo
 * genérico.
 */
const UTM_FUENTES: Record<string, LeadSource> = { ig: 'meta_ads', fb: 'meta_ads', an: 'meta_ads', instagram: 'meta_ads', facebook: 'meta_ads' };

/**
 * Fecha "D-M-Y" o "D/M/Y" (con año de 4 dígitos) → ISO. Las hojas de este
 * cliente la escriben así ("9-9-2026"), que `Date.parse` interpretaría mal
 * (formato no estándar, ambiguo entre D-M-Y y M-D-Y según motor). Si no
 * calza el patrón, se intenta `Date.parse` tal cual como respaldo.
 */
function parsearFechaLatam(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const dia = Number(d), mes = Number(mo);
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }
  return !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString().slice(0, 10) : undefined;
}

/**
 * Resuelve un nombre crudo de Setter/Closer a un id del equipo del cliente —
 * exacto o primer-nombre-único, igual criterio que la integración de
 * Paralelo (sin la limpieza de diarización, que no aplica aquí: el CSV ya
 * trae el nombre tecleado a mano, no transcrito).
 */
function resolverMiembro(nombreCrudo: string, equipo: Array<{ id: string; nombre: string }>): string | undefined {
  const objetivo = normalizarNombre(nombreCrudo);
  if (!objetivo) return undefined;
  const exacto = equipo.find((m) => normalizarNombre(m.nombre) === objetivo);
  if (exacto) return exacto.id;
  if (objetivo.includes(' ')) return undefined; // nombre compuesto que no calzó exacto: no se adivina
  const candidatos = equipo.filter((m) => normalizarNombre(m.nombre).split(' ')[0] === objetivo);
  return candidatos.length === 1 ? candidatos[0].id : undefined;
}

export function leerLeadsCSV(
  texto: string,
  clientId: string,
  existentes: Lead[],
  equipo: Array<{ id: string; nombre: string; rol: string }> = [],
): LecturaLeadsCSV {
  const crudas = parsearCSV(texto);
  if (crudas.length === 0) {
    return { filas: [], columnasIgnoradas: [], error: 'El archivo está vacío.' };
  }

  const cabecera = crudas[0].map(normalizar);
  const indice = {} as Record<CampoTexto, number>;
  const usadas = new Set<number>();
  (Object.keys(COLUMNAS) as CampoTexto[]).forEach((campo) => {
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

  const idsExternosExistentes = new Set(existentes.filter((l) => l.clientId === clientId && l.externalId).map((l) => l.externalId));
  const idsPorClave = new Map<string, string>(); // teléfono o email normalizado → id existente
  for (const l of existentes) {
    if (l.clientId !== clientId) continue;
    if (l.telefono) idsPorClave.set(`tel:${normalizarTelefono(l.telefono)}`, l.id);
    if (l.email) idsPorClave.set(`mail:${normalizar(l.email)}`, l.id);
  }
  const vistosEnElArchivo = new Set<string>();
  const idsExternosVistos = new Set<string>();

  const filas: FilaLeadRevision[] = crudas.slice(1).map((celdas, i) => {
    const linea = i + 2;
    const leer = (campo: CampoTexto): string => {
      const idx = indice[campo];
      return idx >= 0 ? (celdas[idx] ?? '').trim() : '';
    };

    const nombre = leer('nombre');
    if (!nombre) {
      return { linea, nombreCrudo: '', estado: 'rechazada', motivo: 'Sin nombre de lead.' };
    }

    const externalId = leer('externalId') || undefined;
    if (externalId) {
      if (idsExternosExistentes.has(externalId)) {
        return { linea, nombreCrudo: nombre, estado: 'existente', motivo: `Ya existe un lead con id "${externalId}".` };
      }
      if (idsExternosVistos.has(externalId)) {
        return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: `Id "${externalId}" repetido en el archivo.` };
      }
      idsExternosVistos.add(externalId);
    }

    const telefono = leer('telefono') || undefined;
    const email = leer('email') || undefined;
    const contacto = leer('contacto') || undefined;

    // El id propio, cuando viene, es la identidad. Sin eso: teléfono o email
    // normalizados. Sin NINGUNO de los tres (caso real: CSV cuyo "Contacto"
    // es un usuario de Instagram, no un teléfono) se cae a nombre+contacto —
    // más débil, pero mejor que no detectar nada.
    if (!externalId) {
      const claveTel = telefono ? `tel:${normalizarTelefono(telefono)}` : null;
      const claveMail = email ? `mail:${normalizar(email)}` : null;
      const claveContacto = (!telefono && !email && contacto) ? `contacto:${normalizarNombre(nombre)}::${normalizar(contacto)}` : null;
      for (const clave of [claveTel, claveMail, claveContacto]) {
        if (!clave || clave === 'tel:' || clave === 'mail:') continue;
        if (idsPorClave.has(clave)) {
          return { linea, nombreCrudo: nombre, estado: 'existente', motivo: 'Ya existe un lead con ese mismo contacto.' };
        }
        if (vistosEnElArchivo.has(clave)) {
          return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: 'Repetido en el archivo (mismo teléfono, email o contacto que otra línea).' };
        }
      }
      if (claveTel && claveTel !== 'tel:') vistosEnElArchivo.add(claveTel);
      if (claveMail && claveMail !== 'mail:') vistosEnElArchivo.add(claveMail);
      if (claveContacto) vistosEnElArchivo.add(claveContacto);
    }

    const fuenteTexto = leer('fuente');
    let fuente: LeadSource = 'otro';
    if (fuenteTexto) {
      const encontrada = FUENTES[normalizar(fuenteTexto)];
      if (!encontrada) {
        return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: `Fuente "${fuenteTexto}" no reconocida. Valores válidos: ${ETIQUETAS_FUENTE}.` };
      }
      fuente = encontrada;
    } else {
      const utm = leer('utmSource');
      if (utm) fuente = UTM_FUENTES[normalizar(utm)] ?? 'otro';
    }

    const scoreTexto = leer('score');
    const score = scoreTexto && /^-?\d+([.,]\d+)?$/.test(scoreTexto) ? Number(scoreTexto.replace(',', '.')) : undefined;

    const fechaTexto = leer('creadoEn');
    const createdAt = fechaTexto ? parsearFechaLatam(fechaTexto) : undefined;

    const numero = (texto: string): number | undefined => {
      const limpio = texto.replace(/[^\d.,-]/g, '').replace(',', '.');
      return limpio && !Number.isNaN(Number(limpio)) ? Number(limpio) : undefined;
    };

    const setterNombre = leer('setter') || undefined;
    const closerNombre = leer('closer') || undefined;

    const datos: DatosFilaLead = {
      nombre, telefono, email, fuente,
      perfilRol: leer('perfilRol') || undefined,
      externalId,
      score,
      banda: leer('banda') || undefined,
      ruta: leer('ruta') || undefined,
      createdAt,
      contacto,
      setterNombre,
      closerNombre,
      setterId: setterNombre ? resolverMiembro(setterNombre, equipo.filter((m) => m.rol === 'setter')) : undefined,
      closerId: closerNombre ? resolverMiembro(closerNombre, equipo.filter((m) => m.rol === 'closer')) : undefined,
      fechaAgenda: (() => { const t = leer('fechaAgenda'); return t ? parsearFechaLatam(t) : undefined; })(),
      fechaLlamada: (() => { const t = leer('fechaLlamada'); return t ? parsearFechaLatam(t) : undefined; })(),
      asistio: leer('asistio') || undefined,
      resultado: leer('resultado') || undefined,
      producto: leer('producto') || undefined,
      formaPago: leer('formaPago') || undefined,
      programValue: (() => { const t = leer('precioPactado'); return t ? numero(t) : undefined; })(),
      cashCollected: (() => { const t = leer('totalCobrado'); return t ? numero(t) : undefined; })(),
      lostReason: leer('motivoNoCerro') || undefined,
      ultimoSeguimiento: (() => { const t = leer('ultimoSeguimiento'); return t ? parsearFechaLatam(t) : undefined; })(),
      notas: leer('notas') || undefined,
    };
    return { linea, nombreCrudo: nombre, estado: 'nueva', datos };
  });

  return { filas, columnasIgnoradas };
}

export function construirLeadDesdeFila(datos: DatosFilaLead, clientId: string): Lead {
  const ahora = datos.createdAt ?? new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    clientId,
    nombre: datos.nombre,
    telefono: datos.telefono,
    email: datos.email,
    fuente: datos.fuente,
    perfilRol: datos.perfilRol,
    externalId: datos.externalId,
    score: datos.score,
    banda: datos.banda,
    ruta: datos.ruta,
    // La etapa la decide una persona moviendo la tarjeta, no el CSV — aunque
    // "Resultado" diga "Cerró", avanzar el pipeline solo sin que nadie lo vea
    // es la misma trampa que ya se evitó en Paralelo con las tareas.
    etapa: 'nuevo',
    setterId: datos.setterId,
    closerId: datos.closerId,
    fechaAgenda: datos.fechaAgenda,
    fechaLlamada: datos.fechaLlamada,
    asistio: datos.asistio,
    resultado: datos.resultado,
    producto: datos.producto,
    formaPago: datos.formaPago,
    programValue: datos.programValue,
    cashCollected: datos.cashCollected ?? 0,
    lostReason: datos.lostReason,
    ultimoSeguimiento: datos.ultimoSeguimiento,
    notas: datos.notas,
    createdAt: ahora,
    updatedAt: ahora,
  };
}

export const CSV_PLANTILLA_LEADS = [
  'nombre,telefono,email,fuente,perfil_rol',
  'Camila Restrepo,+57 300 000 0000,camila@ejemplo.com,meta_ads,Mamá',
].join('\n');
