/**
 * Integración con Fathom — reuniones grabadas automáticamente, sin pasar por
 * Paralelo (que solo cubre David Guerrero, Andrea Torres e Ikigai).
 *
 * Fathom no tiene "proyectos" como Paralelo: una llave de cuenta ve TODAS las
 * reuniones grabadas por quien la generó, de cualquier cliente. El puente a
 * cliente de Project360 se hace por PALABRA CLAVE en el título — igual que
 * Paralelo, es una lista blanca: lo que no calce con ningún cliente declarado
 * aquí no se importa, no se adivina.
 *
 * Para habilitar un cliente nuevo: agrega sus palabras clave (minúsculas, sin
 * acentos) y prueba con UNA reunión antes de soltar el histórico.
 */

export interface FathomCliente {
  /** Cliente de Project360, tal cual está escrito allí. */
  cliente: string;
  /**
   * Palabras que, si aparecen en el título de la reunión (sin acentos, en
   * minúsculas), la asignan a este cliente. Basta con que aparezca UNA.
   */
  palabrasClave: string[];
  nota: string;
}

export const FATHOM_CLIENTES: FathomCliente[] = [
  {
    cliente: 'Alejo Luengas',
    palabrasClave: ['alejo', 'al'],
    nota: 'Habilitado 2026-10-02. Sus reuniones ya se graban en Fathom '
        + '(confirmado: 5 reuniones desde el 9-sep). Primer cliente de esta integración.',
  },
];

/** Desde cuándo se traen reuniones de Fathom. Arranca en la fecha de habilitación. */
export const FATHOM_DESDE = '2026-09-01';

const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * A qué cliente pertenece un título de reunión de Fathom. `undefined` = no
 * calza con ningún cliente habilitado → no se importa.
 *
 * Si el título calza con las palabras clave de MÁS DE UN cliente, se rechaza
 * (ambiguo) en vez de elegir el primero: una reunión en el cliente equivocado
 * es de lo más caro de deshacer.
 */
export function clienteDeTituloFathom(titulo: string): FathomCliente | 'ambiguo' | undefined {
  const t = sinAcentos(titulo);
  const palabras = new Set(t.split(/[^a-z0-9]+/).filter(Boolean));
  const coincide = FATHOM_CLIENTES.filter((c) =>
    c.palabrasClave.some((p) => palabras.has(sinAcentos(p))),
  );
  if (coincide.length === 0) return undefined;
  if (coincide.length > 1) return 'ambiguo';
  return coincide[0];
}

/** `external_id` de una reunión traída de Fathom. */
export const externalIdReunionFathom = (recordingId: number | string): string =>
  `fathom:${recordingId}`;

/**
 * `external_id` de un action item de Fathom.
 *
 * Los action items no traen id propio — solo la reunión. Se construye con la
 * reunión + una huella del texto, igual que Paralelo: si Fathom reprocesa el
 * mismo reporte sale el mismo id (no se duplica); si el texto cambia, entra
 * como tarea nueva (es un compromiso distinto).
 */
export const externalIdTareaFathom = (recordingId: number | string, descripcion: string): string => {
  const huella = descripcion
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48);
  return `fathom:${recordingId}:${huella}`;
};

/**
 * Resuelve el nombre del assignee de Fathom a una persona del equipo.
 *
 * A diferencia de Paralelo, Fathom ya entrega el nombre limpio (no viene de
 * diarización con etiquetas "Speaker A"), así que no hace falta la limpieza de
 * paréntesis ni la tabla de alias — solo exacto o primer-nombre-único.
 */
export function resolverResponsableFathom(nombreCrudo: string | undefined, nombresEquipo: string[]): string {
  const nombre = (nombreCrudo ?? '').trim();
  if (!nombre) return 'Sin asignar';

  const objetivo = sinAcentos(nombre);
  const exacto = nombresEquipo.find((n) => sinAcentos(n) === objetivo);
  if (exacto) return exacto;

  const esUnaPalabra = !objetivo.includes(' ');
  const candidatos = esUnaPalabra
    ? nombresEquipo.filter((n) => sinAcentos(n).split(' ')[0] === objetivo)
    : [];
  if (candidatos.length === 1) return candidatos[0];

  // Nombre real que no reconocemos: se deja visible, se corrige en dos clics.
  return nombre;
}
