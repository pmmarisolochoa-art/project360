/**
 * Importar clientes desde un archivo CSV.
 *
 * Este archivo es LÓGICA PURA a propósito: no toca React, ni el store, ni
 * Supabase. Todo lo que decide (qué fila entra, cuál se rechaza y por qué) se
 * puede probar sin navegador — ver `pruebas/csv-clientes.mjs`.
 *
 * Las reglas que lo gobiernan (REGLAS_del_Sistema.md):
 *   R-22 — lo que llega mal formado se rechaza con motivo, no se completa a la brava.
 *   R-23 — nada entra automáticamente: entra lo que una persona marca.
 *   R-24 — lo que ya existe se muestra en gris, no se esconde.
 *   R-33 — un fallo parcial se cuenta con nombre y motivo.
 *   R-44 — la operación es idempotente: reimportar el mismo archivo no duplica.
 *
 * Y la de la casa: NO SE INVENTAN DATOS. Una columna que no viene se queda
 * vacía; un valor que no reconocemos rechaza la fila diciendo cuáles valen.
 */
import type { Client, ClientStatus, ProjectType } from '@/types/client';
import { genId } from './id';
import { siglaFromName } from './sigla';
import { generateAccentColor } from './colorGenerator';

/** Lo que sacamos de una fila del archivo. Todo opcional menos el nombre. */
export interface DatosFila {
  nombre: string;
  sigla?: string;
  industria?: string;
  tipoNegocio?: string;
  estado?: ClientStatus;
  tipoProyecto?: ProjectType;
  fundador?: string;
  email?: string;
  whatsapp?: string;
  pais?: string;
  ciudad?: string;
  sitioWeb?: string;
  presupuestoAds?: number;
}

export type EstadoFila = 'nueva' | 'existente' | 'rechazada';

export interface FilaRevision {
  /** Línea real del archivo (la 1 es la cabecera). Para que el motivo sea localizable. */
  linea: number;
  /** El nombre tal como venía, aunque la fila se rechace: sin él no hay cómo señalarla. */
  nombreCrudo: string;
  estado: EstadoFila;
  motivo?: string;
  datos?: DatosFila;
}

export interface LecturaCSV {
  filas: FilaRevision[];
  /** Si el archivo entero no sirve (vacío, sin columna de nombre), aquí va el porqué. */
  error?: string;
  /** Cabeceras que no reconocimos. No es un fallo: se avisa y se ignoran. */
  columnasIgnoradas: string[];
}

// ─────────────────────────── parseo del texto ───────────────────────────

/**
 * CSV de verdad: comillas dobles, comas dentro de comillas, comillas escapadas
 * (`""`), saltos de línea dentro de una celda, CRLF y BOM de Excel.
 *
 * Se escribe a mano en vez de sumar una dependencia: son 40 líneas y el
 * formato no cambia. Devuelve las filas en crudo, sin interpretar nada.
 */
export function parsearCSV(texto: string, separador?: string): string[][] {
  const limpio = texto.replace(/^\ufeff/, '');
  const sep = separador ?? detectarSeparador(limpio);
  const filas: string[][] = [];
  let celda = '';
  let fila: string[] = [];
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { celda += '"'; i++; }
        else enComillas = false;
      } else celda += c;
      continue;
    }
    if (c === '"') { enComillas = true; continue; }
    if (c === sep) { fila.push(celda); celda = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; continue; }
    celda += c;
  }
  fila.push(celda);
  filas.push(fila);

  // Fuera las filas totalmente vacías (la última línea del archivo casi siempre lo es).
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

/** Excel en español escribe con `;`. Se decide contando en la primera línea, fuera de comillas. */
function detectarSeparador(texto: string): string {
  const primera = texto.split(/\r?\n/)[0] ?? '';
  const contar = (sep: string) => {
    let n = 0, enComillas = false;
    for (const c of primera) {
      if (c === '"') enComillas = !enComillas;
      else if (c === sep && !enComillas) n++;
    }
    return n;
  };
  const candidatos = [',', ';', '\t'].map((s) => ({ s, n: contar(s) }));
  candidatos.sort((a, b) => b.n - a.n);
  return candidatos[0].n > 0 ? candidatos[0].s : ',';
}

// ─────────────────────────── columnas ───────────────────────────

/** Sin acentos, sin espacios ni guiones, en minúsculas: "Tipo de Negocio" → "tipodenegocio". */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Alias aceptados por columna. Generosos a propósito: quien exporta desde otra
 * herramienta no debería tener que renombrar cabeceras para que esto funcione.
 */
const COLUMNAS: Record<keyof DatosFila, string[]> = {
  nombre: ['nombre', 'cliente', 'empresa', 'negocio', 'name', 'nombrecliente', 'nombredelnegocio'],
  sigla: ['sigla', 'siglas', 'iniciales', 'codigo'],
  industria: ['industria', 'sector', 'industry', 'nicho'],
  tipoNegocio: ['tiponegocio', 'tipodenegocio', 'modelodenegocio', 'businesstype', 'modelo'],
  estado: ['estado', 'status', 'estadocliente'],
  tipoProyecto: ['tipoproyecto', 'tipodeproyecto', 'proyecto', 'projecttype', 'sistema'],
  fundador: ['fundador', 'founder', 'contacto', 'nombrefundador', 'responsable'],
  email: ['email', 'correo', 'correoelectronico', 'mail'],
  whatsapp: ['whatsapp', 'telefono', 'celular', 'movil', 'phone'],
  pais: ['pais', 'country'],
  ciudad: ['ciudad', 'city'],
  sitioWeb: ['sitioweb', 'web', 'website', 'pagina', 'paginaweb', 'url'],
  presupuestoAds: ['presupuestoads', 'presupuesto', 'presupuestomensual', 'inversionads', 'adsbudget', 'budget'],
};

/** Etiqueta en español ⇄ valor interno. La app se lee en español; la base guarda en inglés. */
const ESTADOS: Record<string, ClientStatus> = {
  onboarding: 'onboarding',
  planificacion: 'planning', planning: 'planning', enplanificacion: 'planning',
  activo: 'active', active: 'active', activa: 'active',
  enpausa: 'paused', pausado: 'paused', pausa: 'paused', paused: 'paused',
  completado: 'completed', completada: 'completed', finalizado: 'completed', completed: 'completed',
};

const TIPOS: Record<string, ProjectType> = {
  ecommerce: 'ecommerce', tienda: 'ecommerce', tiendaonline: 'ecommerce',
  lanzamiento: 'launch', launch: 'launch',
  evergreen: 'evergreen', perpetuo: 'evergreen',
  marcapersonal: 'personal_brand', personalbrand: 'personal_brand', personal: 'personal_brand',
  otro: 'other', other: 'other',
};

const ETIQUETAS_ESTADO = 'onboarding, planificación, activo, en pausa, completado';
const ETIQUETAS_TIPO = 'ecommerce, lanzamiento, evergreen, marca personal, otro';

// ─────────────────────────── lectura ───────────────────────────

/**
 * Convierte el texto del archivo en la bandeja de revisión.
 *
 * `existentes` son los clientes que ya están en la app: sus nombres marcan las
 * filas como `existente` (R-24) en vez de crear un duplicado (R-44). El
 * emparejamiento es por nombre normalizado porque es lo único que el archivo
 * y la app comparten con seguridad — un CSV no trae nuestros ids.
 */
export function leerClientesCSV(
  texto: string,
  existentes: Array<Pick<Client, 'name'>>,
): LecturaCSV {
  const crudas = parsearCSV(texto);
  if (crudas.length === 0) {
    return { filas: [], columnasIgnoradas: [], error: 'El archivo está vacío.' };
  }

  const cabecera = crudas[0].map(normalizar);
  const indice = {} as Record<keyof DatosFila, number>;
  const usadas = new Set<number>();
  (Object.keys(COLUMNAS) as Array<keyof DatosFila>).forEach((campo) => {
    const i = cabecera.findIndex((h) => COLUMNAS[campo].includes(h));
    indice[campo] = i;
    if (i >= 0) usadas.add(i);
  });

  if (indice.nombre < 0) {
    return {
      filas: [],
      columnasIgnoradas: [],
      error: 'No encontramos la columna del nombre del cliente. La primera fila del archivo debe traer una cabecera con "nombre" (o "cliente", "empresa").',
    };
  }

  const columnasIgnoradas = crudas[0]
    .map((h, i) => ({ h: h.trim(), i }))
    .filter(({ h, i }) => h !== '' && !usadas.has(i))
    .map(({ h }) => h);

  const yaEnLaApp = new Set(existentes.map((c) => normalizar(c.name)));
  const vistosEnElArchivo = new Map<string, number>(); // nombre normalizado → línea

  const filas: FilaRevision[] = crudas.slice(1).map((celdas, i) => {
    const linea = i + 2; // +1 por la cabecera, +1 porque las líneas se cuentan desde 1
    const leer = (campo: keyof DatosFila): string => {
      const idx = indice[campo];
      return idx >= 0 ? (celdas[idx] ?? '').trim() : '';
    };

    const nombre = leer('nombre');
    if (!nombre) {
      return { linea, nombreCrudo: '', estado: 'rechazada', motivo: 'Sin nombre de cliente.' };
    }

    const clave = normalizar(nombre);

    if (yaEnLaApp.has(clave)) {
      return { linea, nombreCrudo: nombre, estado: 'existente', motivo: 'Ya existe en Project360.' };
    }
    const repetida = vistosEnElArchivo.get(clave);
    if (repetida !== undefined) {
      return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: `Repetido en el archivo (ya venía en la línea ${repetida}).` };
    }
    vistosEnElArchivo.set(clave, linea);

    // Un valor que no reconocemos NO se sustituye por el defecto en silencio:
    // eso convierte un error de datos en un cliente mal clasificado que nadie
    // revisa. Se rechaza la fila diciendo qué valores valen.
    const estadoTexto = leer('estado');
    let estado: ClientStatus | undefined;
    if (estadoTexto) {
      estado = ESTADOS[normalizar(estadoTexto)];
      if (!estado) {
        return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: `Estado "${estadoTexto}" no reconocido. Valores válidos: ${ETIQUETAS_ESTADO}.` };
      }
    }

    const tipoTexto = leer('tipoProyecto');
    let tipoProyecto: ProjectType | undefined;
    if (tipoTexto) {
      tipoProyecto = TIPOS[normalizar(tipoTexto)];
      if (!tipoProyecto) {
        return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: `Tipo de proyecto "${tipoTexto}" no reconocido. Valores válidos: ${ETIQUETAS_TIPO}.` };
      }
    }

    const presupuestoTexto = leer('presupuestoAds');
    let presupuestoAds: number | undefined;
    if (presupuestoTexto) {
      presupuestoAds = parsearMonto(presupuestoTexto);
      if (presupuestoAds === undefined) {
        return { linea, nombreCrudo: nombre, estado: 'rechazada', motivo: `Presupuesto "${presupuestoTexto}" no es un número.` };
      }
    }

    const datos: DatosFila = {
      nombre,
      sigla: leer('sigla') || undefined,
      industria: leer('industria') || undefined,
      tipoNegocio: leer('tipoNegocio') || undefined,
      estado,
      tipoProyecto,
      fundador: leer('fundador') || undefined,
      email: leer('email') || undefined,
      whatsapp: leer('whatsapp') || undefined,
      pais: leer('pais') || undefined,
      ciudad: leer('ciudad') || undefined,
      sitioWeb: leer('sitioWeb') || undefined,
      presupuestoAds,
    };

    return { linea, nombreCrudo: nombre, estado: 'nueva', datos };
  });

  return { filas, columnasIgnoradas };
}

/** "$1.200", "1200", "1,200.50", "1.200,50" → número. `undefined` si no lo es. */
function parsearMonto(texto: string): number | undefined {
  let limpio = texto.replace(/[^\d.,-]/g, '');
  if (!limpio) return undefined;
  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    // Vienen los dos: el ÚLTIMO es el decimal y el otro es el de miles.
    limpio = ultimaComa > ultimoPunto
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '');
  } else if (ultimaComa >= 0 || ultimoPunto >= 0) {
    /**
     * Viene UNO SOLO, y ahí "1.200" es ambiguo: puede ser mil doscientos o
     * uno coma dos. Se decide por la forma — un separador seguido de
     * exactamente tres cifras es de miles ("$1.200"), cualquier otra cosa es
     * decimal ("1200.50"). Es la lectura que acierta con presupuestos.
     */
    const pos = Math.max(ultimaComa, ultimoPunto);
    const decimales = limpio.length - pos - 1;
    limpio = decimales === 3
      ? limpio.slice(0, pos) + limpio.slice(pos + 1)
      : limpio.slice(0, pos) + '.' + limpio.slice(pos + 1);
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : undefined;
}

// ─────────────────────────── construcción del cliente ───────────────────────────

/**
 * Arma el `Client` que se va a guardar.
 *
 * Deliberadamente NO llama a la IA ni rellena el cerebro: un cliente importado
 * entra vacío y con estado `onboarding` salvo que el archivo diga otra cosa.
 * Inventarle personas, entregables o industria sería exactamente el fallo que
 * ya costó una ficha con un rol que no existe.
 */
export function construirClienteDesdeFila(datos: DatosFila, agencyId: string): Client {
  const ahora = new Date().toISOString();
  return {
    id: genId(),
    agencyId,
    name: datos.nombre,
    sigla: datos.sigla || siglaFromName(datos.nombre),
    industry: datos.industria ?? '',
    businessType: datos.tipoNegocio ?? '',
    primaryColor: generateAccentColor(datos.nombre),
    status: datos.estado ?? 'onboarding',
    projectType: datos.tipoProyecto ?? 'other',
    onboardingData: {
      identity: {
        businessName: datos.nombre,
        founderName: datos.fundador ?? '',
        email: datos.email ?? '',
        whatsapp: datos.whatsapp ?? '',
        industry: datos.industria ?? '',
        yearsInMarket: 0,
        country: datos.pais ?? '',
        city: datos.ciudad ?? '',
        website: datos.sitioWeb || undefined,
        socials: {},
      },
    },
    aiBrainData: {},
    metrics: {
      roas: null,
      pendingTasksToday: 0,
      nextMeetingAt: null,
      progressPercent: 0,
    },
    adsConnected: { meta: false, google: false, tiktok: false, ga4: false },
    monthlyAdsBudget: datos.presupuestoAds ?? 0,
    createdAt: ahora,
    updatedAt: ahora,
  };
}

/** La plantilla que se descarga desde el modal, para no adivinar las cabeceras. */
export const CSV_PLANTILLA = [
  'nombre,sigla,industria,tipo_negocio,estado,tipo_proyecto,fundador,email,whatsapp,pais,ciudad,sitio_web,presupuesto_ads',
  'Ejemplo S.A.,EJ,Salud,Servicios,activo,evergreen,Ana Pérez,ana@ejemplo.com,+57 300 000 0000,Colombia,Bogotá,https://ejemplo.com,500',
].join('\n');
