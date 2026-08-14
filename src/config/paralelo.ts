/**
 * Equivalencias entre los proyectos de Paralelo y los clientes de Project360.
 *
 * Paralelo (Meetico) organiza sus reuniones por `project_id`. Nosotros las
 * organizamos por cliente. Esta tabla es el puente, y es la ÚNICA puerta de
 * entrada: un proyecto de Paralelo que no esté aquí NO se importa. Es la regla
 * que ya se decidió para esta integración — lo que existe allá y no acá se
 * rechaza, no se crea a la brava.
 *
 * El destino se declara por NOMBRE de cliente, no por UUID, a propósito: los
 * UUID cambian entre la base local y producción, y un id equivocado importaría
 * las reuniones de un cliente dentro de otro. El nombre se resuelve contra los
 * clientes cargados, y si no aparece ninguno, la importación se detiene con un
 * mensaje claro en vez de adivinar.
 *
 * Para habilitar otro proyecto: descoméntalo, verifica que el nombre coincida
 * con el del cliente en Project360, y pruébalo con UNA reunión antes de soltar
 * el histórico.
 */

export interface ParaleloProyecto {
  /** `project_id` en Meetico. */
  projectId: string;
  /** Nombre del cliente en Project360, tal cual está escrito allí. */
  cliente: string;
  /** Solo para leerlo aquí — qué es este proyecto y por qué está (o no) activo. */
  nota: string;
}

export const PARALELO_PROYECTOS: ParaleloProyecto[] = [
  {
    projectId: '9077f0f0-603e-4af5-8033-444778267d9e',
    cliente: 'David Guerrero',
    nota: '42 reuniones (oct 2025 → ago 2026). Primer proyecto habilitado: cliente vivo, sin solapamiento con las internas de Ikigai.',
  },

  /* ── Pendientes de habilitar ──────────────────────────────────────────────
   * Se activan cuando David Guerrero esté verificado en producción.
   *
   * {
   *   projectId: '23a3efb4-b1f7-4634-8f92-f34dea5cf5a4',
   *   cliente: 'Ikigai',
   *   nota: '117 reuniones, casi todas dailies internas. Ojo: al importarlas '
   *       + 'deberían entrar como meeting_type "management", no como reuniones '
   *       + 'de cliente. Es el volumen más grande — no soltarlo de un tirón.',
   * },
   * {
   *   projectId: 'ea25b849-d05a-4002-8b94-24868305c253',
   *   cliente: 'Andrea Torres',
   *   nota: '23 reuniones. Algunas comparten sesión con David Guerrero; el '
   *       + 'project_id de Paralelo decide a quién pertenecen.',
   * },
   * {
   *   projectId: 'ddfcc8a1-1a46-456d-8f85-4fb823e2c86c',
   *   cliente: 'Floppy',
   *   nota: '7 reuniones, ninguna desde el 9 dic 2025. Proyecto inactivo: '
   *       + 'habilitar solo si se reactiva la relación.',
   * },
   */
];

/** Busca la equivalencia de un `project_id` de Paralelo. undefined = no habilitado. */
export const proyectoParalelo = (projectId: string | null | undefined) =>
  projectId ? PARALELO_PROYECTOS.find((p) => p.projectId === projectId) : undefined;

/**
 * Desde cuándo se traen reuniones de Paralelo.
 *
 * Arrancó en "de hoy en adelante" y se movió al 1 de agosto (founder, 13-ago):
 * con el arranque en el día no había una sola reunión real que probar — la
 * última de David fue el 5-ago — y verificar la integración con una grabación
 * de prueba de 2 minutos no verifica nada. El histórico anterior (190 reuniones
 * y ~950 tareas de un año) sigue fuera.
 *
 * Se compara contra la fecha REAL de la reunión (`actual_start_time`), no
 * contra cuándo Paralelo la cargó — ellos procesan en lotes y una reunión del
 * 5 de agosto puede aparecer el 10.
 *
 * Para traer histórico algún día: mover esta fecha hacia atrás, de a poco, y
 * revisar la bandeja. No hay que tocar código.
 */
export const PARALELO_DESDE = '2026-08-01';

/**
 * Cuántos días hacia atrás mira cada revisión.
 *
 * NO basta con preguntar "¿qué hay desde la última vez?". Medido sobre datos
 * reales, Paralelo tarda entre 0 y 5 días en cargar una reunión ya ocurrida
 * (la del 5 de agosto apareció el 10). Una revisión con ventana corta se salta
 * reuniones en silencio, que es el peor fallo posible: nadie se entera.
 *
 * OJO — ESTE NÚMERO Y `PARALELO_DESDE` SE PISAN. El arranque efectivo es el
 * MAYOR de los dos (`max(hoy - ventana, DESDE)`), así que una ventana corta
 * anula una fecha de arranque vieja: con 10 días, mover el arranque al 1 de
 * agosto no servía de nada — el corte real habría caído el 4. Si mueves
 * `PARALELO_DESDE` hacia atrás, mueve también esto o no pasará nada.
 *
 * 20 días cubre el arranque del 1 de agosto con margen de sobra sobre el peor
 * caso observado. Revisar de más no cuesta nada: lo ya traído se descarta por
 * `external_id`.
 */
export const PARALELO_VENTANA_DIAS = 20;

/**
 * Apodos de la transcripción → persona real del equipo.
 *
 * Paralelo saca los responsables de la diarización del audio, así que llegan
 * como los nombra la gente hablando: "Bala", "Balita (David F)", "Cami". La
 * misma persona aparece con tres etiquetas distintas, y ninguna se parece al
 * nombre con el que está registrada en Project360.
 *
 * Esta tabla la dio la founder (13-ago). Es la ÚNICA fuente: lo que no esté
 * aquí y no coincida por nombre con alguien del equipo se deja como texto
 * crudo. NO se adivina — "Bala" no se parece a "David Castaño" por ningún
 * algoritmo, y asignarle trabajo a quien no es cuesta más que dejar la tarea
 * con un nombre raro que alguien corrige a mano.
 *
 * Las claves se comparan en minúsculas y sin acentos; los sufijos entre
 * paréntesis ("(Speaker B)") se quitan antes de buscar aquí.
 */
export const PARALELO_ALIAS: Record<string, string> = {
  bala: 'David Castaño',
  balita: 'David Castaño',
  'david f': 'David Castaño',
  cami: 'Camilo Beltrán',
  camilo: 'Camilo Beltrán',
  // 14-ago, founder: así la nombra el equipo en las reuniones de David Guerrero.
  'mari cruz': 'Marisol Ochoa',
  mari: 'Marisol Ochoa',
};

/**
 * POR QUÉ "Speaker A" NO ESTÁ AQUÍ, aunque sepamos quién es.
 *
 * En la reunión del 5-ago Speaker A es Jhonatan Rengifo. En la del 12 puede ser
 * cualquier otro: "Speaker A" no es un apodo, es el orden en que la diarización
 * oyó las voces, y se reparte de nuevo en CADA reunión.
 *
 * Ponerlo aquí le asignaría a Jhonatan, en silencio y para siempre, el trabajo
 * del primero que hable en cada reunión. Es justo el fallo que esta tabla
 * existe para evitar: una tarea con un nombre raro se corrige en dos clics
 * porque salta a la vista; una asignada a la persona equivocada no la corrige
 * nadie, porque nadie sabe que está mal.
 *
 * Estas se corrigen a mano al importar. Si algún día Paralelo entrega un id de
 * hablante estable por persona, se resuelve bien y se quita esta nota.
 */

/**
 * Títulos que nunca se importan: pruebas del proveedor y grabaciones sueltas.
 * Se compara en minúsculas contra el título ya limpio de sufijos.
 */
const TITULOS_BASURA = [/^prueba\d*$/, /^reu\d*\.(mp4|mov|txt)$/, /^untitled/, /^sin t[ií]tulo$/];

export const esReunionDePrueba = (titulo: string): boolean => {
  const t = titulo.trim().toLowerCase();
  return TITULOS_BASURA.some((re) => re.test(t));
};

/**
 * Paralelo nombra las reuniones así:
 *   "Alineación estrategia David Guerrero - 2026/08/12 16:00 GMT-05:00 - Recording"
 * La fecha ya viene en su propio campo, así que en el título estorba.
 */
export const limpiarTituloParalelo = (nombre: string | null | undefined): string => {
  if (!nombre) return 'Reunión sin título';
  return (
    nombre
      .split(/ - \d{4}\/\d{2}\/\d{2}/)[0]
      .replace(/ - Recording$/i, '')
      .trim() || 'Reunión sin título'
  );
};

/**
 * `external_id` de una tarea traída de Paralelo.
 *
 * Sus `actionItems` NO tienen id propio — solo la reunión lo tiene. Sin un
 * identificador estable, reimportar una reunión duplicaría sus tareas. Se
 * construye entonces con la reunión + una huella del texto de la tarea: si
 * Paralelo reprocesa el mismo reporte, sale el mismo id y la tarea se reconoce
 * como ya importada. Si reescriben el texto, entra como tarea nueva — que es
 * lo correcto, porque es un compromiso distinto.
 */
export const externalIdTareaParalelo = (meetingId: string, textoTarea: string): string => {
  const huella = textoTarea
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48);
  return `paralelo:${meetingId}:${huella}`;
};

/** `external_id` de una reunión traída de Paralelo. */
export const externalIdReunionParalelo = (meetingId: string): string => `paralelo:${meetingId}`;

const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Limpia el ruido de diarización de un nombre.
 *
 * Paralelo devuelve el responsable en DOS formas, y hay que distinguirlas o se
 * tira justo el dato bueno:
 *
 *   "Balita (David F)"      → el nombre está FUERA  → "Balita"
 *   "Speaker C (Mari Cruz)" → el nombre está DENTRO → "Mari Cruz"
 *
 * "Speaker C" no es un nombre, es la etiqueta que pone la diarización cuando no
 * reconoce quién habla; el paréntesis trae la corrección humana. Quedarse
 * siempre con lo de fuera dejaba 5 de las 12 tareas del 5-ago asignadas a
 * "Speaker C" y "Speaker D" — nombres que no le dicen nada a nadie.
 *
 * Solo se invierte ante una etiqueta de diarización reconocible
 * (`Speaker X`, `Hablante 2`), no ante cualquier paréntesis: "Camilo
 * (diseñador)" tiene que seguir siendo "Camilo", no "diseñador".
 */
const ETIQUETA_DIARIZACION = /^(speaker|hablante|participante)\s*[a-z0-9]{1,2}$/i;

export const limpiarNombreParalelo = (crudo: string): string => {
  const fuera = crudo.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (!ETIQUETA_DIARIZACION.test(fuera)) return fuera;

  const dentro = crudo.match(/\(([^)]*)\)/)?.[1]?.trim();
  // Si dentro tampoco hay nada útil, se devuelve la etiqueta: es fea pero
  // visible, y alguien la corrige. Inventar un nombre sería peor.
  return dentro && !ETIQUETA_DIARIZACION.test(dentro) ? dentro : fuera;
};

/**
 * Resuelve el responsable que dijo la transcripción a una persona del equipo.
 *
 * Orden: alias explícito (PARALELO_ALIAS) → nombre exacto del equipo → primer
 * nombre del equipo → el texto crudo tal cual.
 *
 * El último escalón es a propósito: una tarea con responsable "Arnoldo Lorenzo"
 * que nadie reconoce es visible y se corrige en dos clics. Una tarea asignada
 * en silencio a la persona equivocada no la corrige nadie, porque nadie sabe
 * que está mal.
 */
export function resolverResponsableParalelo(crudo: string, nombresEquipo: string[]): string {
  const limpio = limpiarNombreParalelo(crudo);
  if (!limpio) return crudo;

  const alias = PARALELO_ALIAS[sinAcentos(limpio)];
  if (alias) return alias;

  const objetivo = sinAcentos(limpio);
  const exacto = nombresEquipo.find((n) => sinAcentos(n) === objetivo);
  if (exacto) return exacto;

  // "Andrés" ↔ "Andrés Ramírez": basta con el primer nombre, y solo si es único.
  // Si dos personas del equipo se llaman Andrés, no se elige ninguna.
  const candidatos = nombresEquipo.filter(
    (n) => sinAcentos(n).split(' ')[0] === objetivo.split(' ')[0],
  );
  if (candidatos.length === 1) return candidatos[0];

  return limpio;
}
