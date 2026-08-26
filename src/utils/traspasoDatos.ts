/**
 * Paquete de TRASPASO de datos: lo que se le entrega a un equipo técnico para
 * que cargue esta información en OTRO sistema.
 *
 * No confundir con `exportarPortafolio.ts`, que es lo contrario: tablas
 * legibles, en español, sin identificadores, para que una persona las mire.
 * Aquí manda la fidelidad, no la belleza — van los ids reales, las claves que
 * relacionan unas tablas con otras y los valores tal como los guarda la app.
 * Un `status` traducido a "En curso" es más amable y a la vez inservible para
 * quien tiene que importarlo.
 *
 * LA IDEA QUE SOSTIENE EL ARCHIVO: el esquema de abajo (`ESQUEMA`) es la
 * ÚNICA fuente. De él salen los datos Y el diccionario que los explica. Si
 * fueran dos listas separadas, el día que alguien añada un campo actualizará
 * una y no la otra, y el diccionario empezará a mentir — que es peor que no
 * tenerlo, porque nadie duda de un documento.
 */
import type { Client } from '@/types/client';
import type { Task } from '@/types/task';
import type { Meeting } from '@/types/meeting';
import type { TaskLink } from '@/services/taskLinks';

/** Un campo documentado de una tabla. */
interface Campo {
  nombre: string;
  tipo: 'texto' | 'número' | 'sí/no' | 'fecha ISO' | 'lista' | 'objeto';
  descripcion: string;
  /** Si apunta a otra tabla, cuál: `clientes.id`. */
  relacion?: string;
  /** Valores posibles, cuando son cerrados. */
  valores?: string[];
}

interface DefinicionTabla {
  nombre: string;
  descripcion: string;
  campos: Campo[];
}

const CLIENTE_ESTADOS = ['onboarding', 'planning', 'active', 'paused', 'completed'];
const CLIENTE_TIPOS = ['ecommerce', 'launch', 'evergreen', 'personal_brand', 'other'];
const TAREA_ESTADOS = ['pending', 'in_progress', 'in_review', 'completed', 'blocked'];

/** El esquema documentado de las cuatro tablas centrales. */
const ESQUEMA: DefinicionTabla[] = [
  {
    nombre: 'clientes',
    descripcion:
      'Cada cliente de la agencia. La fila con isAgency=true no es un cliente real: ' +
      'es el espacio interno donde viven las reuniones y tareas de la propia agencia.',
    campos: [
      { nombre: 'id', tipo: 'texto', descripcion: 'Identificador único (uuid). Es la clave a la que apuntan las demás tablas por clientId.' },
      { nombre: 'agencyId', tipo: 'texto', descripcion: 'Agencia dueña del cliente. Todo el paquete pertenece a una sola agencia.' },
      { nombre: 'name', tipo: 'texto', descripcion: 'Nombre del cliente.' },
      { nombre: 'sigla', tipo: 'texto', descripcion: 'Sigla corta (DG, AT). Puede faltar; se deriva del nombre.' },
      { nombre: 'isAgency', tipo: 'sí/no', descripcion: 'true = espacio interno de la agencia, no un cliente facturable.' },
      { nombre: 'industry', tipo: 'texto', descripcion: 'Industria o sector.' },
      { nombre: 'businessType', tipo: 'texto', descripcion: 'Modelo de negocio.' },
      { nombre: 'status', tipo: 'texto', descripcion: 'Estado del cliente.', valores: CLIENTE_ESTADOS },
      { nombre: 'projectType', tipo: 'texto', descripcion: 'Tipo de proyecto contratado.', valores: CLIENTE_TIPOS },
      { nombre: 'primaryColor', tipo: 'texto', descripcion: 'Color de marca en hex, usado en la interfaz.' },
      { nombre: 'monthlyAdsBudget', tipo: 'número', descripcion: 'Presupuesto mensual de pauta, en USD.' },
      { nombre: 'adsConnected', tipo: 'objeto', descripcion: 'Qué plataformas de pauta están conectadas: meta, google, tiktok, ga4 (sí/no cada una).' },
      { nombre: 'metrics', tipo: 'objeto', descripcion: 'Foto de métricas del cliente (roas, ventas, facturación). OJO: se refresca solo en algunos caminos de la app — para conteos fiables, cuéntalos desde tareas.' },
      { nombre: 'onboardingData', tipo: 'objeto', descripcion: 'Todo lo que se respondió en el onboarding: identity (contacto, país, ciudad, redes), business, current, audience, goals, competition, content, team.' },
      { nombre: 'aiBrainData', tipo: 'objeto', descripcion: 'Lo que generó la IA a partir del onboarding: resumen ejecutivo, buyer personas, oferta, arquitectura de marca. Vacío si el cliente se creó a mano o por importación.' },
      { nombre: 'activeFunnelId', tipo: 'texto', descripcion: 'Embudo que se abre por defecto.', relacion: 'embudos.id' },
      { nombre: 'createdAt', tipo: 'fecha ISO', descripcion: 'Cuándo se creó.' },
      { nombre: 'updatedAt', tipo: 'fecha ISO', descripcion: 'Última modificación.' },
    ],
  },
  {
    nombre: 'tareas',
    descripcion:
      'La unidad de trabajo. Toda tarea pertenece a un cliente. Las marcadas como privadas ' +
      'NO están en este paquete (ver "Lo que no se entrega").',
    campos: [
      { nombre: 'id', tipo: 'texto', descripcion: 'Identificador único (uuid).' },
      { nombre: 'clientId', tipo: 'texto', descripcion: 'Cliente al que pertenece.', relacion: 'clientes.id' },
      { nombre: 'title', tipo: 'texto', descripcion: 'Qué hay que hacer.' },
      { nombre: 'description', tipo: 'texto', descripcion: 'Detalle ampliado. Puede faltar.' },
      { nombre: 'status', tipo: 'texto', descripcion: 'Estado de la tarea.', valores: TAREA_ESTADOS },
      { nombre: 'priority', tipo: 'texto', descripcion: 'Prioridad.', valores: ['P1', 'P2', 'P3'] },
      { nombre: 'assignedTo', tipo: 'texto', descripcion: 'Responsable. OJO: puede ser el NOMBRE de una persona o el SLUG de un rol (strategist, designer, copywriter…). Si es un slug, la persona concreta sale de equipo, cruzando clientId + rol.' },
      { nombre: 'dueDate', tipo: 'fecha ISO', descripcion: 'Fecha comprometida de entrega.' },
      { nombre: 'completedAt', tipo: 'fecha ISO', descripcion: 'Cuándo se completó. Vacío si no lo está.' },
      { nombre: 'isDelayed', tipo: 'sí/no', descripcion: 'Marca de atraso guardada. Para saber el atraso REAL, compara dueDate con hoy: este campo no siempre está al día.' },
      { nombre: 'delayDays', tipo: 'número', descripcion: 'Días de atraso guardados. Misma advertencia que isDelayed.' },
      { nombre: 'tag', tipo: 'texto', descripcion: 'Etiqueta temática (ADS, contenido, estrategia, reunión, entregable, ROPRE, otro).' },
      { nombre: 'moduleTag', tipo: 'texto', descripcion: 'Módulo de la app del que nació.' },
      { nombre: 'parentTaskId', tipo: 'texto', descripcion: 'Tarea madre, si es una subtarea.', relacion: 'tareas.id' },
      { nombre: 'dependsOn', tipo: 'lista', descripcion: 'Ids de tareas que deben terminar antes.', relacion: 'tareas.id' },
      { nombre: 'subtasks', tipo: 'lista', descripcion: 'Pasos internos: {id, title, done}.' },
      { nombre: 'comments', tipo: 'lista', descripcion: 'Historial de comentarios: {id, author, text, createdAt}.' },
      { nombre: 'input', tipo: 'texto', descripcion: 'Qué necesita la tarea para poder empezar.' },
      { nombre: 'output', tipo: 'texto', descripcion: 'Qué produce la tarea.' },
      { nombre: 'kpiNombre', tipo: 'texto', descripcion: 'Resultado que la tarea debe generar (ej. "500 leads captados").' },
      { nombre: 'kpiMeta', tipo: 'texto', descripcion: 'Meta numérica del KPI.' },
      { nombre: 'kpiResultado', tipo: 'texto', descripcion: 'Resultado real, se llena al completar.' },
      { nombre: 'driveLink', tipo: 'texto', descripcion: 'Link al entregable en Drive. Los entregables con historial viven además en la tabla entregables.' },
      { nombre: 'funnelId', tipo: 'texto', descripcion: 'Embudo del que forma parte.', relacion: 'embudos.id' },
      { nombre: 'phaseId', tipo: 'texto', descripcion: 'Fase del embudo.', relacion: 'fasesEmbudo.id' },
      { nombre: 'origen', tipo: 'texto', descripcion: 'De dónde nació la tarea.', valores: ['manual', 'reunion', 'embudo', 'ia', 'api'] },
      { nombre: 'meetingId', tipo: 'texto', descripcion: 'Reunión de la que salió, si origen=reunion.', relacion: 'reuniones.id' },
      { nombre: 'meetingNombre', tipo: 'texto', descripcion: 'Nombre de esa reunión, copiado para mostrarlo sin cargarla.' },
      { nombre: 'meetingFecha', tipo: 'fecha ISO', descripcion: 'Fecha de esa reunión.' },
      { nombre: 'externalId', tipo: 'texto', descripcion: 'Id de esta tarea en el sistema externo del que vino (Paralelo/Meetico). Vacío = nació dentro de Project360. ÚSALO para no duplicar al importar.' },
      { nombre: 'createdAt', tipo: 'fecha ISO', descripcion: 'Cuándo se creó.' },
      { nombre: 'updatedAt', tipo: 'fecha ISO', descripcion: 'Última modificación.' },
    ],
  },
  {
    nombre: 'reuniones',
    descripcion:
      'La agenda. Las reuniones privadas NO están en este paquete, y las transcripciones, ' +
      'notas y resúmenes solo van si se pidieron expresamente al generarlo.',
    campos: [
      { nombre: 'id', tipo: 'texto', descripcion: 'Identificador único (uuid).' },
      { nombre: 'clientId', tipo: 'texto', descripcion: 'Cliente al que pertenece. Las internas apuntan al cliente con isAgency=true.', relacion: 'clientes.id' },
      { nombre: 'title', tipo: 'texto', descripcion: 'Título de la reunión.' },
      { nombre: 'type', tipo: 'texto', descripcion: 'Tipo de reunión (kickoff, weekly_metrics, ads_review, general, management…). OJO: el tipo dice DE QUÉ va; de quién es lo dice el cliente.' },
      { nombre: 'scheduledAt', tipo: 'fecha ISO', descripcion: 'Cuándo es (fecha y hora).' },
      { nombre: 'durationMin', tipo: 'número', descripcion: 'Duración en minutos.' },
      { nombre: 'participants', tipo: 'lista', descripcion: 'Asistentes: {userId, name}. Las reuniones importadas de Paralelo suelen venir sin esta lista.' },
      { nombre: 'completed', tipo: 'sí/no', descripcion: 'Si ya se realizó.' },
      { nombre: 'agenda', tipo: 'texto', descripcion: 'Orden del día.' },
      { nombre: 'videoCallLink', tipo: 'texto', descripcion: 'Link de la videollamada.' },
      { nombre: 'recordingUrl', tipo: 'texto', descripcion: 'Link de la grabación.' },
      { nombre: 'origen', tipo: 'texto', descripcion: 'De dónde vino.', valores: ['manual', 'api', 'paralelo'] },
      { nombre: 'externalId', tipo: 'texto', descripcion: 'Id en el sistema externo del que vino. Úsalo para no duplicar al importar.' },
      { nombre: 'summary', tipo: 'texto', descripcion: 'Resumen. SOLO si se pidió incluir el contenido de las reuniones.' },
      { nombre: 'notes', tipo: 'texto', descripcion: 'Notas. SOLO si se pidió incluir el contenido de las reuniones.' },
      { nombre: 'transcription', tipo: 'texto', descripcion: 'Transcripción completa. SOLO si se pidió incluir el contenido de las reuniones.' },
    ],
  },
  {
    nombre: 'entregables',
    descripcion:
      'Links que el equipo sube como resultado de una tarea (o a mano), con su revisión del PM.',
    campos: [
      { nombre: 'id', tipo: 'texto', descripcion: 'Identificador único (uuid).' },
      { nombre: 'clientId', tipo: 'texto', descripcion: 'Cliente al que pertenece.', relacion: 'clientes.id' },
      { nombre: 'taskId', tipo: 'texto', descripcion: 'Tarea de la que salió. Vacío en los subidos a mano.', relacion: 'tareas.id' },
      { nombre: 'nombre', tipo: 'texto', descripcion: 'Nombre del entregable.' },
      { nombre: 'url', tipo: 'texto', descripcion: 'Dónde vive (Drive, Notion, Loom, web…).' },
      { nombre: 'tipo', tipo: 'texto', descripcion: 'Naturaleza del link.', valores: ['entregable', 'referencia', 'drive', 'notion', 'loom', 'web', 'otro'] },
      { nombre: 'estado', tipo: 'texto', descripcion: 'Revisión del PM.', valores: ['pendiente', 'aprobado', 'correcciones'] },
      { nombre: 'fuente', tipo: 'texto', descripcion: 'Cómo entró.', valores: ['tarea', 'manual'] },
      { nombre: 'createdBy', tipo: 'texto', descripcion: 'Usuario que lo subió.' },
      { nombre: 'createdByNombre', tipo: 'texto', descripcion: 'Su nombre visible, copiado al insertar.' },
      { nombre: 'meetingId', tipo: 'texto', descripcion: 'Reunión de la que venía la tarea que lo originó.', relacion: 'reuniones.id' },
      { nombre: 'notas', tipo: 'texto', descripcion: 'Comentario de la revisión.' },
      { nombre: 'createdAt', tipo: 'fecha ISO', descripcion: 'Cuándo se subió.' },
    ],
  },
];

/**
 * Tablas de apoyo. Van completas y sin recortar, pero documentadas a nivel de
 * tabla: son estructuras internas de Project360 y describirlas campo a campo
 * sería inventar precisión que no tengo. El diccionario lista los campos que
 * REALMENTE traen los datos entregados, leídos de los datos mismos.
 */
const TABLAS_APOYO: Array<{ nombre: string; descripcion: string }> = [
  { nombre: 'equipo', descripcion: 'Las personas del equipo, con su rol y el cliente en el que trabajan. Cruza con tareas.assignedTo cuando ahí hay un slug de rol en vez de un nombre.' },
  { nombre: 'asignaciones', descripcion: 'Qué rol está asignado a qué cliente, y su carga. Es la capa de roles; las personas concretas están en equipo.' },
  { nombre: 'ropre', descripcion: 'ROPRE: Riesgos, Oportunidades, PRoblemas y Entregables del cliente. Los riesgos importados de Paralelo entran aquí con su mitigación.' },
  { nombre: 'programas', descripcion: 'Programas o servicios contratados por el cliente.' },
  { nombre: 'embudos', descripcion: 'Embudos de lanzamiento activos. Las tareas apuntan aquí por funnelId.' },
  { nombre: 'fasesEmbudo', descripcion: 'Fases de cada embudo. Las tareas apuntan aquí por phaseId.' },
  { nombre: 'contenido', descripcion: 'Piezas de contenido planificadas o publicadas.' },
  { nombre: 'proyecciones', descripcion: 'OKRs, líneas de inversión e indicadores de éxito, agrupados por cliente.' },
];

export interface DatosCrudos {
  clientes: Client[];
  tareas: Task[];
  reuniones: Meeting[];
  entregables: TaskLink[];
  equipo: unknown[];
  asignaciones: unknown[];
  ropre: unknown[];
  programas: unknown[];
  embudos: unknown[];
  fasesEmbudo: unknown[];
  contenido: unknown[];
  proyecciones: Record<string, unknown>;
}

export interface OpcionesTraspaso {
  /** Transcripciones, notas y resúmenes de reuniones. Apagado por defecto. */
  incluirContenidoReuniones: boolean;
  /**
   * Qué tablas entran. Se elige por envío y no se fija en el código porque
   * depende de quién recibe: si el sistema de destino ya gestiona embudos o
   * contenido por su cuenta, mandárselos no ayuda — le crea un segundo sitio
   * donde vive lo mismo.
   */
  tablas: string[];
}

/** Todas las tablas que el paquete PUEDE llevar, en el orden en que se muestran. */
export const TABLAS_TRASPASO = [
  'clientes', 'tareas', 'reuniones', 'entregables', 'equipo', 'asignaciones',
  'ropre', 'programas', 'embudos', 'fasesEmbudo', 'contenido', 'proyecciones',
] as const;

/**
 * Tablas que dependen de otra para poder leerse.
 * `fasesEmbudo` sin `embudos` deja fases apuntando a un embudo que no viaja:
 * no es un error fatal, pero quien importe se encontrará una referencia rota
 * y merece saberlo antes y no después.
 */
export const DEPENDENCIAS: Record<string, string> = {
  fasesEmbudo: 'embudos',
};

/** Avisos de referencias que quedarán rotas con la selección actual. */
export function avisosDeSeleccion(tablas: string[]): string[] {
  return Object.entries(DEPENDENCIAS)
    .filter(([hija, madre]) => tablas.includes(hija) && !tablas.includes(madre))
    .map(([hija, madre]) => `\`${hija}\` apunta a \`${madre}\`, que no va en este envío: esas referencias quedarán sin destino.`);
}

export interface Paquete {
  _meta: Record<string, unknown>;
  [tabla: string]: unknown;
}

/** Campos de reunión que solo salen si se piden expresamente. */
const CONTENIDO_REUNION = ['transcription', 'notes', 'summary', 'reporte', 'reporteGeneradoEn', 'extractedTasks', 'notesUpdatedAt'];

/** Campos que NO salen nunca: son marcas internas de privacidad. */
const NUNCA = ['esPrivada', 'propietarioId'];

function limpiar<T extends Record<string, unknown>>(fila: T, quitar: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fila)) {
    if (quitar.includes(k)) continue;
    if (v === undefined) continue; // JSON no los representa; ensucian el archivo
    out[k] = v;
  }
  return out;
}

/**
 * Arma el paquete completo.
 *
 * Las exclusiones de privacidad se aplican aquí y no son opcionales: una fila
 * privada es de una persona, no de la agencia, y no se entrega a nadie.
 */
export function construirPaquete(
  datos: DatosCrudos,
  opciones: OpcionesTraspaso,
  generadoEnISO: string,
): Paquete {
  const quitarDeReunion = opciones.incluirContenidoReuniones
    ? NUNCA
    : [...NUNCA, ...CONTENIDO_REUNION];

  const tareas = datos.tareas.filter((t) => !t.esPrivada).map((t) => limpiar(t as unknown as Record<string, unknown>, NUNCA));
  const reuniones = datos.reuniones.filter((m) => !m.esPrivada).map((m) => limpiar(m as unknown as Record<string, unknown>, quitarDeReunion));
  const clientes = datos.clientes.map((c) => limpiar(c as unknown as Record<string, unknown>, NUNCA));
  const entregables = datos.entregables.map((l) => limpiar(l as unknown as Record<string, unknown>, NUNCA));

  const tareasPrivadas = datos.tareas.length - tareas.length;
  const reunionesPrivadas = datos.reuniones.length - reuniones.length;

  const todas: Record<string, unknown> = {
    clientes,
    tareas,
    reuniones,
    entregables,
    equipo: datos.equipo,
    asignaciones: datos.asignaciones,
    ropre: datos.ropre,
    programas: datos.programas,
    embudos: datos.embudos,
    fasesEmbudo: datos.fasesEmbudo,
    contenido: datos.contenido,
    proyecciones: datos.proyecciones,
  };

  const paquete: Paquete = {
    _meta: {
      origen: 'Project360',
      formatoVersion: 1,
      generadoEn: generadoEnISO,
      agenciaId: datos.clientes[0]?.agencyId ?? null,
      /**
       * Se dice cuántas filas se quedaron fuera y por qué. Un paquete que
       * calla lo que omite obliga a quien lo recibe a descubrir el hueco
       * cuando ya cargó los datos.
       */
      excluido: {
        tareasPrivadas,
        reunionesPrivadas,
        contenidoDeReuniones: opciones.incluirContenidoReuniones
          ? 'incluido a petición'
          : 'excluido (transcripciones, notas y resúmenes)',
      },
      /**
       * Las tablas que NO se mandaron se nombran. Un paquete al que le falta
       * una tabla sin decirlo se lee como "esta agencia no usa embudos", y eso
       * es una conclusión falsa sacada de un archivo incompleto.
       */
      tablasNoIncluidas: TABLAS_TRASPASO.filter((t) => !opciones.tablas.includes(t)),
      avisos: avisosDeSeleccion(opciones.tablas),
      conteos: {} as Record<string, number>,
    },
  };

  TABLAS_TRASPASO.forEach((t) => {
    if (opciones.tablas.includes(t)) paquete[t] = todas[t];
  });

  const conteos: Record<string, number> = {};
  for (const [k, v] of Object.entries(paquete)) {
    if (k === '_meta') continue;
    conteos[k] = Array.isArray(v) ? v.length : Object.keys(v as object).length;
  }
  (paquete._meta as Record<string, unknown>).conteos = conteos;

  return paquete;
}

// ─────────────────────────── el diccionario ───────────────────────────

/** Claves que trae de verdad una colección, leídas de los datos. */
function clavesPresentes(filas: unknown[]): string[] {
  const set = new Set<string>();
  filas.forEach((f) => {
    if (f && typeof f === 'object') Object.keys(f).forEach((k) => set.add(k));
  });
  return [...set].sort();
}

/**
 * Genera el documento que acompaña al JSON.
 *
 * Sale del mismo `ESQUEMA` que los datos y de los datos mismos: los conteos y
 * los campos de las tablas de apoyo se leen del paquete, así que el
 * diccionario no puede describir algo que el archivo no traiga.
 */
export function diccionarioDeDatos(paquete: Paquete, nombreJSON: string): string {
  const meta = paquete._meta as Record<string, any>;
  const conteos = meta.conteos as Record<string, number>;
  const L: string[] = [];

  L.push('# Traspaso de datos — Project360');
  L.push('');
  L.push(`Generado el ${String(meta.generadoEn).slice(0, 10)} · formato versión ${meta.formatoVersion}`);
  L.push('');
  L.push('Este documento explica el archivo `' + nombreJSON + '`, que contiene los datos operativos');
  L.push('de una agencia gestionados con Project360, listos para cargarse en otro sistema.');
  L.push('');

  L.push('## Cómo está armado el archivo');
  L.push('');
  L.push('Es un único JSON. En la raíz hay una clave por tabla, y cada una es una lista de filas');
  L.push('(`proyecciones` es la excepción: es un objeto indexado por `clientId`).');
  L.push('La clave `_meta` no son datos: describe el paquete y dice qué se dejó fuera.');
  L.push('');
  L.push('Todas las tablas se relacionan por `clientId`, que apunta a `clientes.id`.');
  L.push('Los identificadores son los reales de Project360 (uuid): consérvalos si vas a');
  L.push('sincronizar en el futuro, o mapéalos a los tuyos guardando el original.');
  L.push('');

  L.push('## Qué trae');
  L.push('');
  L.push('| Tabla | Filas | Qué es |');
  L.push('|---|---:|---|');
  const descripciones = new Map<string, string>([
    ...ESQUEMA.map((t) => [t.nombre, t.descripcion] as [string, string]),
    ...TABLAS_APOYO.map((t) => [t.nombre, t.descripcion] as [string, string]),
  ]);
  Object.keys(conteos).forEach((tabla) => {
    const d = (descripciones.get(tabla) ?? '').split('.')[0];
    L.push(`| \`${tabla}\` | ${conteos[tabla]} | ${d}. |`);
  });
  L.push('');

  L.push('## Lo que NO se entrega, y por qué');
  L.push('');
  L.push('Esto no es un olvido: es una decisión, y conviene que la conozcas antes de');
  L.push('preguntarte por qué faltan filas.');
  L.push('');
  const fuera = (meta.tablasNoIncluidas ?? []) as string[];
  if (fuera.length > 0) {
    L.push(`- **Tablas no incluidas en este envío:** ${fuera.map((t) => `\`${t}\``).join(', ')}.`);
    L.push('  Se dejaron fuera a propósito al generar el paquete, normalmente porque el');
    L.push('  sistema de destino ya las gestiona. Que no estén no significa que la agencia');
    L.push('  no las use.');
  }
  L.push(`- **${meta.excluido.tareasPrivadas} tarea(s) y ${meta.excluido.reunionesPrivadas} reunión(es) privadas.** En Project360 cada persona`);
  L.push('  tiene un espacio propio. Eso es suyo, no de la agencia, y no sale en ninguna');
  L.push('  exportación ni reporte. Tampoco salen las marcas internas que lo señalan.');
  L.push(`- **Contenido de las reuniones:** ${meta.excluido.contenidoDeReuniones}.`);
  L.push('  La agenda dice QUE hubo una reunión, con quién y de qué tipo. Lo que se dijo');
  L.push('  dentro es otra cosa y se entrega solo si se pide expresamente.');
  L.push('');

  const avisos = (meta.avisos ?? []) as string[];
  if (avisos.length > 0) {
    L.push('### Referencias que quedan sin destino');
    L.push('');
    L.push('Por la selección de tablas de este envío:');
    L.push('');
    avisos.forEach((a) => L.push(`- ${a}`));
    L.push('');
  }

  L.push('## Antes de importar — cuatro avisos que ahorran trabajo');
  L.push('');
  L.push('1. **`tareas.assignedTo` no siempre es una persona.** Puede traer el nombre de');
  L.push('   alguien o el *slug* de un rol (`strategist`, `designer`, `copywriter`…). Si es');
  L.push('   un slug, la persona concreta sale de `equipo`, cruzando `clientId` + rol.');
  L.push('2. **Para saber si una tarea está vencida, compara `dueDate` con la fecha de hoy.**');
  L.push('   Los campos `isDelayed` y `delayDays` están guardados y no siempre al día.');
  L.push('3. **Lo mismo con `clientes.metrics`:** es una foto que solo se refresca en algunos');
  L.push('   caminos de la app. Los conteos fiables se calculan desde `tareas`.');
  L.push('4. **`externalId` (en tareas y reuniones) es la clave anti-duplicados.** Las filas');
  L.push('   que lo traen vinieron de un sistema externo (Paralelo/Meetico). Si vas a');
  L.push('   sincronizar contra esa misma fuente, empareja por ahí y no por el título.');
  L.push('');

  L.push('## Diccionario de campos');
  L.push('');
  ESQUEMA.filter((t) => t.nombre in conteos).forEach((tabla) => {
    L.push(`### \`${tabla.nombre}\` — ${conteos[tabla.nombre] ?? 0} filas`);
    L.push('');
    L.push(tabla.descripcion);
    L.push('');
    L.push('| Campo | Tipo | Descripción |');
    L.push('|---|---|---|');
    tabla.campos.forEach((c) => {
      const extra = [
        c.relacion ? `Apunta a \`${c.relacion}\`.` : '',
        c.valores ? `Valores: ${c.valores.map((v) => `\`${v}\``).join(', ')}.` : '',
      ].filter(Boolean).join(' ');
      L.push(`| \`${c.nombre}\` | ${c.tipo} | ${c.descripcion}${extra ? ' ' + extra : ''} |`);
    });
    L.push('');
  });

  const apoyoIncluidas = TABLAS_APOYO.filter((t) => t.nombre in conteos);
  if (apoyoIncluidas.length > 0) {
  L.push('### Tablas de apoyo');
  L.push('');
  L.push('Van completas y sin recortar. Son estructuras internas de Project360, así que en');
  L.push('vez de describirlas campo a campo —lo que sería fingir una precisión que no');
  L.push('tenemos— se listan los campos que traen los datos entregados:');
  L.push('');
  TABLAS_APOYO.filter((t) => t.nombre in conteos).forEach((t) => {
    const filas = paquete[t.nombre];
    const n = conteos[t.nombre] ?? 0;
    L.push(`**\`${t.nombre}\`** (${n} filas) — ${t.descripcion}`);
    if (Array.isArray(filas) && filas.length > 0) {
      L.push('');
      L.push(`Campos: ${clavesPresentes(filas).map((k) => `\`${k}\``).join(', ')}`);
    } else if (n === 0) {
      L.push('');
      L.push('_Sin filas en este paquete._');
    }
    L.push('');
  });

  }

  L.push('---');
  L.push('');
  L.push('Si algo de este documento no coincide con el archivo, gana el archivo — y avísanos.');
  L.push('');
  return L.join('\n');
}

export function nombreTraspaso(hoyISO: string, extension: string): string {
  return `Project360-traspaso-${hoyISO.slice(0, 10)}.${extension}`;
}
