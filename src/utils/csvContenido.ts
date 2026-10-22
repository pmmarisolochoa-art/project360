/**
 * Importar piezas de contenido desde el CSV que entrega la terminal externa
 * de generación de contenido (fecha de publicación, guion, tipo de
 * contenido/formato y caption — la plataforma es siempre Instagram, fija).
 *
 * A diferencia de `csvLeads.ts`/`csvClientes.ts`, esta importación entra
 * DIRECTO al Kanban sin bandeja de revisión intermedia — decisión explícita
 * de la founder (22-oct-2026): el contenido generado por la terminal externa
 * ya viene listo para producción, puesto en "Sin empezar" en su fecha real.
 *
 * Mismo patrón de validación que el resto de importadores de este archivo:
 * una fila mal formada se RECHAZA con motivo, nunca se completa a la brava.
 * Idempotencia simple por (título normalizado + fecha de publicación) dentro
 * del cliente — si la terminal reenvía el mismo archivo por error, la fila ya
 * importada se marca "ya existe" en vez de duplicarse.
 */
import { parsearCSV } from './csvClientes';
import type { ContentFormat, ContentPiece } from '@/types/content';
import { genId } from './id';

type CampoContenido = 'titulo' | 'formato' | 'fechaPublicacion' | 'guion' | 'caption';

const COLUMNAS: Record<CampoContenido, string[]> = {
  titulo: ['titulo', 'title', 'nombre', 'pieza'],
  formato: ['formato', 'tipodecontenido', 'tipo', 'format'],
  fechaPublicacion: ['fechadepublicacion', 'fechapublicacion', 'fecha', 'publishdate'],
  guion: ['guion', 'script', 'guionscript'],
  caption: ['caption', 'copy', 'texto'],
};

const FORMATOS: Record<string, ContentFormat> = {
  reel: 'reel', reels: 'reel',
  post: 'post',
  story: 'story', stories: 'story', historia: 'story',
  video: 'video',
  carrusel: 'carousel', carousel: 'carousel',
  short: 'short', shorts: 'short',
};
const ETIQUETAS_FORMATO = 'reel, post, story, video, carrusel, short';

/**
 * Fecha "D-M-Y" o "D/M/Y" (año de 2 o 4 dígitos) → ISO, con `Date.parse` como
 * respaldo para formatos ya estándar ("2026-11-03") — mismo criterio que
 * `parsearFechaLatam` de `csvLeads.ts`, duplicado aquí porque esta función
 * también la usa `api/calendly/webhook.ts` vía import relativo y no vale la
 * pena acoplar dos importadores de CSV que no comparten nada más.
 */
function parsearFecha(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (m) {
    const [, d, mo, yCrudo] = m;
    const dia = Number(d), mes = Number(mo);
    const y = yCrudo.length === 2 ? `20${yCrudo}` : yCrudo;
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }
  return !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString().slice(0, 10) : undefined;
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizarTitulo(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export type EstadoFilaContenido = 'creada' | 'existente' | 'rechazada';

export interface FilaContenidoResultado {
  linea: number;
  tituloCrudo: string;
  estado: EstadoFilaContenido;
  motivo?: string;
}

export interface ResultadoImportacionContenido {
  filas: FilaContenidoResultado[];
  piezas: ContentPiece[];
  error?: string;
  columnasIgnoradas: string[];
}

export function leerContenidoCSV(
  texto: string,
  clientId: string,
  existentes: ContentPiece[],
): ResultadoImportacionContenido {
  const crudas = parsearCSV(texto);
  if (crudas.length === 0) {
    return { filas: [], piezas: [], columnasIgnoradas: [], error: 'El archivo está vacío.' };
  }

  const cabecera = crudas[0].map(normalizar);
  const indice = {} as Record<CampoContenido, number>;
  const usadas = new Set<number>();
  (Object.keys(COLUMNAS) as CampoContenido[]).forEach((campo) => {
    const i = cabecera.findIndex((h) => COLUMNAS[campo].includes(h));
    indice[campo] = i;
    if (i >= 0) usadas.add(i);
  });

  const faltantes = (Object.keys(COLUMNAS) as CampoContenido[]).filter((c) => indice[c] < 0);
  if (faltantes.length > 0) {
    return {
      filas: [], piezas: [], columnasIgnoradas: [],
      error: `Faltan columnas obligatorias en la cabecera: ${faltantes.map((f) => COLUMNAS[f][0]).join(', ')}.`,
    };
  }

  const columnasIgnoradas = crudas[0]
    .map((h, i) => ({ h: h.trim(), i }))
    .filter(({ h, i }) => h !== '' && !usadas.has(i))
    .map(({ h }) => h);

  const clavesExistentes = new Set(
    existentes
      .filter((p) => p.clientId === clientId && p.publishDate)
      .map((p) => `${normalizarTitulo(p.title)}::${p.publishDate!.slice(0, 10)}`),
  );
  const vistasEnElArchivo = new Set<string>();

  const piezas: ContentPiece[] = [];
  const ahora = new Date().toISOString();

  const filas: FilaContenidoResultado[] = crudas.slice(1).map((celdas, i) => {
    const linea = i + 2;
    const leer = (campo: CampoContenido): string => {
      const idx = indice[campo];
      return idx >= 0 ? (celdas[idx] ?? '').trim() : '';
    };

    if (celdas.every((c) => !c.trim())) {
      return { linea, tituloCrudo: '', estado: 'rechazada', motivo: 'Fila vacía.' };
    }

    const titulo = leer('titulo');
    if (!titulo) {
      return { linea, tituloCrudo: '', estado: 'rechazada', motivo: 'Sin título.' };
    }

    const formatoTexto = leer('formato');
    const formato = FORMATOS[normalizar(formatoTexto)];
    if (!formato) {
      return { linea, tituloCrudo: titulo, estado: 'rechazada', motivo: `Formato "${formatoTexto}" no reconocido. Valores válidos: ${ETIQUETAS_FORMATO}.` };
    }

    const fechaTexto = leer('fechaPublicacion');
    const fecha = fechaTexto ? parsearFecha(fechaTexto) : undefined;
    if (!fecha) {
      return { linea, tituloCrudo: titulo, estado: 'rechazada', motivo: `Fecha de publicación "${fechaTexto}" no reconocida (usa AAAA-MM-DD o DD/MM/AAAA).` };
    }

    const guion = leer('guion');
    if (!guion) {
      return { linea, tituloCrudo: titulo, estado: 'rechazada', motivo: 'Sin guion/script.' };
    }

    const caption = leer('caption');
    if (!caption) {
      return { linea, tituloCrudo: titulo, estado: 'rechazada', motivo: 'Sin caption.' };
    }

    const clave = `${normalizarTitulo(titulo)}::${fecha}`;
    if (clavesExistentes.has(clave)) {
      return { linea, tituloCrudo: titulo, estado: 'existente', motivo: 'Ya existe una pieza con el mismo título y fecha de publicación.' };
    }
    if (vistasEnElArchivo.has(clave)) {
      return { linea, tituloCrudo: titulo, estado: 'rechazada', motivo: 'Repetida en el archivo (mismo título y fecha que otra línea).' };
    }
    vistasEnElArchivo.add(clave);

    const pieza: ContentPiece = {
      id: genId(),
      clientId,
      title: titulo,
      platform: 'instagram',
      format: formato,
      script: guion,
      caption,
      copyText: caption,
      status: 'not_started',
      approval: 'pending',
      publishDate: new Date(`${fecha}T12:00:00`).toISOString(),
      hasLeadMagnet: false,
      createdAt: ahora,
    };
    piezas.push(pieza);
    return { linea, tituloCrudo: titulo, estado: 'creada' };
  });

  return { filas, piezas, columnasIgnoradas };
}

export const CSV_PLANTILLA_CONTENIDO = [
  'titulo,formato,fecha_publicacion,guion,caption',
  '"Rutina de brazos en 5 min",reel,2026-11-03,"Hook: ¿poco tiempo para entrenar? Muestra 3 ejercicios seguidos, cierre con CTA.","💪 5 minutos, cero excusas. Guarda este reel para tu próximo entreno. #fitness"',
].join('\n');
