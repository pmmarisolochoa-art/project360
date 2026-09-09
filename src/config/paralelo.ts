import ALIAS_PERSONAS from './aliasPersonas.json';

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
  /**
   * Con qué tipo entran sus reuniones. Por defecto `general`.
   *
   * Las de Ikigai son internas de la agencia (dailies, embudo), no reuniones
   * con un cliente: entran como `management` para que el filtro
   * Cliente/Internas de la agenda las separe bien. Si entraran como `general`
   * se mezclarían con las de clientes en todos los conteos.
   */
  tipoReunion?: 'general' | 'management';
  /** Solo para leerlo aquí — qué es este proyecto y por qué está (o no) activo. */
  nota: string;
}

export const PARALELO_PROYECTOS: ParaleloProyecto[] = [
  {
    projectId: '9077f0f0-603e-4af5-8033-444778267d9e',
    cliente: 'David Guerrero',
    nota: '42 reuniones (oct 2025 → ago 2026). El primero que se habilitó y el que se usó para verificar la integración el 14-ago.',
  },
  {
    projectId: 'ea25b849-d05a-4002-8b94-24868305c253',
    cliente: 'Andrea Torres',
    nota: '23 reuniones. Habilitado el 18-ago. Algunas comparten sesión con '
        + 'David Guerrero; manda el project_id de Paralelo, no el título.',
  },
  {
    projectId: '23a3efb4-b1f7-4634-8f92-f34dea5cf5a4',
    // OJO: el cliente se llama "Ikigai Agencia", no "Ikigai". Es el que
    // representa a la agencia (`is_agency`), por eso no sale en la lista de
    // Clientes. Estuvo un día declarado como "Ikigai" y el aviso en amarillo de
    // la bandeja lo cazó — que es exactamente para lo que se puso.
    cliente: 'Ikigai Agencia',
    tipoReunion: 'management',
    nota: '117 reuniones, casi todas dailies internas. Habilitado el 18-ago; '
        + 'el arranque del 1-ago lo acota a 3, así que el volumen histórico NO '
        + 'entra. Si algún día se mueve PARALELO_DESDE hacia atrás, este es el '
        + 'que hay que soltar de a poco.',
  },

  /* ── Pendiente de habilitar ───────────────────────────────────────────────
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
 * como los nombra la gente hablando: "Cisco", "Juanca", "Loro", "Balita
 * (David F)". La misma persona aparece con tres etiquetas distintas, y ninguna
 * se parece al nombre con el que está registrada en Project360.
 *
 * LA TABLA VIVE EN `aliasPersonas.json`, NO AQUÍ. Es la misma que lee el
 * generador de la migración que limpia las filas ya guardadas. Si estuviera
 * escrita dos veces, el día que alguien añada un apodo arreglaría lo que entra
 * de ahora en adelante y dejaría roto lo de antes — el fallo de los dos
 * traductores del 11-ago, otra vez.
 *
 * Lo que no esté en la tabla y no coincida con alguien del equipo cae en la
 * regla de desconocidos de abajo. NO se adivina por parecido: "Bala" no se
 * parece a "David Castaño" por ningún algoritmo.
 */
export const PARALELO_ALIAS: Record<string, string> = ALIAS_PERSONAS.alias;

/**
 * A quién va lo que NO ES UN NOMBRE.
 *
 * Se aplica solo a tres cosas: etiquetas de diarización ("Speaker A"), grupos
 * ("Equipo de Marketing", que están en la tabla de alias) y el vacío. Esas
 * tareas no eran de nadie: convivían con la gente real en el filtro de
 * personas y nadie las reclamaba.
 *
 * NO se aplica a un nombre real que no reconozcamos. Un "Arnoldo Lorenzo" se
 * deja tal cual — es feo pero visible, y alguien lo corrige en dos clics;
 * mandarlo a la bandeja de otro lo esconde. La primera versión de esta regla
 * mandaba a Marisol TODO lo desconocido y se llevó por delante a "Tony" y al
 * cliente "David Guerrero". Lo cazó `pruebas/alias-personas.mjs` antes de tocar
 * un solo dato: por eso la lista de esa prueba es la real del desplegable y no
 * un ejemplo inventado.
 */
export const PARALELO_DESCONOCIDO: string = ALIAS_PERSONAS._desconocido;

/**
 * Nombres que ninguna regla puede tocar. Ver el porqué de cada uno en el JSON.
 * Se comparan en minúsculas y sin acentos, como las claves de alias.
 */
export const PARALELO_CONSERVAR: ReadonlySet<string> = new Set(ALIAS_PERSONAS.conservar);

/**
 * POR QUÉ "Speaker A" SIGUE SIN MAPEARSE A UNA PERSONA CONCRETA.
 *
 * En la reunión del 5-ago Speaker A es Jhonatan Rengifo. En la del 12 puede ser
 * cualquier otro: "Speaker A" no es un apodo, es el orden en que la diarización
 * oyó las voces, y se reparte de nuevo en CADA reunión. La propia founder lo
 * confirmó el 9-sep: "Speaker A puede ser media buyer o David Castaño".
 *
 * Por eso no está en la tabla de alias: cae en la regla de desconocidos y va a
 * Marisol para que lo reparta. Que es distinto de fijarlo a un compañero, que
 * sería asignarle en silencio y para siempre el trabajo del primero que hable.
 *
 * Si algún día Paralelo entrega un id de hablante estable por persona, se
 * resuelve bien y esta nota se cae.
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
 * nombre del equipo → `PARALELO_DESCONOCIDO`.
 *
 * El último escalón cambió el 9-sep: antes devolvía el texto crudo. El porqué
 * del cambio, y lo que cuesta, están escritos en `PARALELO_DESCONOCIDO`.
 */
export function resolverResponsableParalelo(crudo: string, nombresEquipo: string[]): string {
  const limpio = limpiarNombreParalelo(crudo);
  if (!limpio) return PARALELO_DESCONOCIDO;

  const objetivo = sinAcentos(limpio);

  // Va PRIMERO: son los que ninguna regla debe tocar, ni siquiera la de primer
  // nombre único (sin esto, "David" se fundiría con "David Castaño").
  if (PARALELO_CONSERVAR.has(objetivo)) return limpio;

  const alias = PARALELO_ALIAS[objetivo];
  if (alias) return alias;

  const exacto = nombresEquipo.find((n) => sinAcentos(n) === objetivo);
  if (exacto) return exacto;

  // "Andrés" ↔ "Andrés Ramírez": basta con el primer nombre, y solo si es único.
  // Si dos personas del equipo se llaman Andrés, no se elige ninguna.
  //
  // SOLO si lo que llega es UNA palabra. Con dos, el apellido es información y
  // contradecirla es inventar: "David Guerrero" (un cliente) se convertía en
  // "David Castaño" (del equipo) porque compartían el primer nombre. Lo
  // encontró la prueba de alias el 9-sep; el fallo estaba desde el 14-ago y
  // nunca saltó porque hasta ahora nadie con nombre compuesto había caído aquí.
  const esUnaPalabra = !objetivo.includes(' ');
  const candidatos = esUnaPalabra
    ? nombresEquipo.filter((n) => sinAcentos(n).split(' ')[0] === objetivo)
    : [];
  if (candidatos.length === 1) return candidatos[0];

  // "Speaker A" / "Hablante 2": no es un nombre, es el orden en que el audio
  // oyó las voces. A la bandeja de quien reparte.
  if (ETIQUETA_DIARIZACION.test(limpio)) return PARALELO_DESCONOCIDO;

  // Un nombre real que no reconocemos se deja VISIBLE. Ver PARALELO_DESCONOCIDO.
  return limpio;
}
