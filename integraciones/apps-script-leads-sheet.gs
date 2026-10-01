/**
 * Apps Script — empuja leads nuevos de un Sheet a /api/v1/leads.
 *
 * Sirve para CUALQUIER cliente cuyo formulario de captación escriba en un
 * Google Sheet (nativo o de una herramienta externa tipo quiz/typeform): no
 * hay nada hardcodeado a un cliente — lo que cambia por cliente son las 3
 * constantes de arriba.
 *
 * CÓMO INSTALARLO (una vez por Sheet):
 *   1. Abre el Sheet → Extensiones → Apps Script.
 *   2. Borra el contenido de Code.gs y pega este archivo completo.
 *   3. Rellena API_KEY y CLIENT_ID abajo (ver "Cómo conseguirlos").
 *   4. Ejecuta la función `sincronizarLeads` una vez a mano (▶) para
 *      autorizar los permisos (Apps Script pide acceso al Sheet y a
 *      internet — es normal, es lo que necesita para mandar el POST).
 *   5. Reloj (⏰) en la barra lateral → Activadores → Añadir activador:
 *        función: sincronizarLeads · evento: controlado por tiempo ·
 *        cada 10 minutos.
 *   Desde ahí corre solo: cada 10 min revisa si hay filas nuevas desde la
 *   última vez y las manda. No duplica aunque el Sheet reciba la misma fila
 *   dos veces — el `lead_id` de la columna A es la identidad, y el endpoint
 *   es idempotente por eso.
 *
 * CÓMO CONSEGUIR API_KEY y CLIENT_ID:
 *   - API_KEY: en Project360 → Configuración → API y Desarrolladores →
 *     Generar llave → permiso "write:leads". Se ve UNA sola vez al crearla,
 *     cópiala ahí mismo.
 *   - CLIENT_ID: en Project360, entra al cerebro del cliente — el uuid está
 *     en la URL (/client/<CLIENT_ID>/ventas).
 *
 * QUÉ HACE CON CADA FILA:
 *   Lee la cabecera del Sheet (fila 1) y busca por NOMBRE de columna, no por
 *   posición — si el orden de las columnas cambia, esto no se rompe. Columnas
 *   que reconoce (todas opcionales salvo un nombre/identificador):
 *     lead_id, nombre, correo/email, whatsapp/telefono, banda, score, ruta,
 *     a5, b5 (perfil del comprador — la última pregunta de cada rama),
 *     utm_source (para inferir la fuente si no hay columna "fuente").
 *   Una columna que no reconoce simplemente se ignora — no rompe nada.
 */

const WEBHOOK_URL = 'https://project360-pearl.vercel.app/api/v1/leads';
// .trim() en los dos — un espacio de más al copiar/pegar (pasó en vivo el
// 30-sep-2026: el client_id llegó con un espacio al final y la API lo
// rechazó) no debe tumbar la sincronización.
const API_KEY = 'PEGA_AQUI_TU_API_KEY'.trim(); // pk_live_... generada en Configuración → API
const CLIENT_ID = 'PEGA_AQUI_EL_CLIENT_ID'.trim(); // uuid del cliente en Project360

const PROP_ULTIMA_FILA = 'ultima_fila_procesada';
const NOMBRE_HOJA_LOG = 'sync_log'; // se crea sola si no existe

const ALIAS_COLUMNAS = {
  leadId: ['lead_id', 'id', 'external_id'],
  nombre: ['nombre', 'name'],
  correo: ['correo', 'email'],
  whatsapp: ['whatsapp', 'telefono', 'phone'],
  banda: ['banda'],
  score: ['score', 'puntaje'],
  ruta: ['ruta'],
  a5: ['a5'],
  b5: ['b5'],
  utmSource: ['utm_source'],
};

const UTM_A_FUENTE = { ig: 'meta_ads', fb: 'meta_ads', an: 'meta_ads', instagram: 'meta_ads', facebook: 'meta_ads' };

function sincronizarLeads() {
  if (API_KEY.indexOf('PEGA_AQUI') === 0 || CLIENT_ID.indexOf('PEGA_AQUI') === 0) {
    throw new Error('Falta configurar API_KEY y/o CLIENT_ID al inicio del script.');
  }

  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName('LEADS_WEB') || libro.getActiveSheet();
  const datos = hoja.getDataRange().getValues();

  // Diagnóstico SIEMPRE, no solo cuando falla — así se ve de un vistazo en
  // qué hoja buscó y cuántas filas encontró, sin adivinar por qué no mandó nada.
  registrarLog(`Diagnóstico: hoja="${hoja.getName()}", filas totales=${datos.length} (incluye cabecera).`);

  if (datos.length < 2) {
    registrarLog('No hay filas de datos (solo cabecera o vacía) — nada que mandar.');
    return;
  }

  const cabecera = datos[0].map((h) => normalizar(String(h)));
  registrarLog(`Cabecera leída: ${datos[0].join(' | ')}`);

  const indice = {};
  Object.keys(ALIAS_COLUMNAS).forEach((campo) => {
    const i = cabecera.findIndex((h) => ALIAS_COLUMNAS[campo].includes(h));
    indice[campo] = i;
  });
  registrarLog(`Columnas encontradas: ${JSON.stringify(indice)}`);

  const props = PropertiesService.getScriptProperties();
  const ultimaFila = Number(props.getProperty(PROP_ULTIMA_FILA) || '1'); // fila 1 = cabecera
  registrarLog(`Última fila ya procesada (según memoria del script): ${ultimaFila}. Se revisan filas ${ultimaFila + 1} a ${datos.length}.`);

  let procesadas = 0;
  let fallidas = 0;
  let saltadas = 0;

  for (let fila = ultimaFila + 1; fila <= datos.length; fila++) {
    const celdas = datos[fila - 1];
    const leer = (campo) => {
      const i = indice[campo];
      return i >= 0 ? String(celdas[i] || '').trim() : '';
    };

    const nombre = leer('nombre') || leer('whatsapp') || leer('correo');
    if (!nombre) { saltadas++; continue; } // fila sin ningún identificador — se salta, no hay qué mandar

    const utm = normalizar(leer('utmSource'));
    const scoreTexto = leer('score');
    const score = /^-?\d+([.,]\d+)?$/.test(scoreTexto) ? Number(scoreTexto.replace(',', '.')) : undefined;

    const payload = {
      client_id: CLIENT_ID,
      nombre: nombre,
      telefono: leer('whatsapp') || undefined,
      email: leer('correo') || undefined,
      fuente: UTM_A_FUENTE[utm] || 'otro',
      perfil_rol: leer('a5') || leer('b5') || undefined,
      external_id: leer('leadId') || undefined,
      banda: leer('banda') || undefined,
      ruta: leer('ruta') || undefined,
    };
    if (score !== undefined) payload.score = score;

    const ok = mandarLead(payload);
    if (ok) procesadas++; else fallidas++;
  }

  props.setProperty(PROP_ULTIMA_FILA, String(datos.length));

  registrarLog(`Resultado: ${procesadas} enviados, ${fallidas} con error, ${saltadas} sin nombre/whatsapp/correo (no se mandaron).`);
}

/**
 * Corre esto UNA vez a mano (▶, eligiendo esta función en el desplegable de
 * arriba) si necesitas que `sincronizarLeads` vuelva a mirar TODAS las filas
 * desde el principio — por ejemplo, tras corregir la cabecera del Sheet o el
 * mapeo de columnas. Sin esto, el script recuerda hasta dónde llegó y solo
 * mira filas nuevas.
 */
function reiniciarContador() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_ULTIMA_FILA);
  registrarLog('Contador reiniciado a mano — la próxima corrida revisa todas las filas desde la 2.');
}

function mandarLead(payload) {
  try {
    const res = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + API_KEY },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const codigo = res.getResponseCode();
    if (codigo >= 200 && codigo < 300) return true;
    registrarLog(`Error ${codigo} mandando "${payload.nombre}": ${res.getContentText().slice(0, 300)}`);
    return false;
  } catch (e) {
    registrarLog(`Excepción mandando "${payload.nombre}": ${e}`);
    return false;
  }
}

function registrarLog(mensaje) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(NOMBRE_HOJA_LOG);
  if (!hoja) hoja = libro.insertSheet(NOMBRE_HOJA_LOG);
  hoja.appendRow([new Date(), mensaje]);
}

function normalizar(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
