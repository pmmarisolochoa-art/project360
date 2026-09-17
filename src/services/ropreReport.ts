import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import type { RopreItem, RopreType } from '@/types/ropre';
import { composeReport, escapeReport as esc, type ReportModel } from '@/services/htmlReport';
import { resolveAssignee } from '@/utils/roleResolver';
import { descargarArchivo } from '@/utils/descargarArchivo';
import { BRAND } from '@/config/brand';
import { diasEntre } from '@/utils/dias';

/**
 * Informe del ROPRE de un cliente en PDF.
 *
 * Usa el MISMO motor paginado que el reporte semanal y el de reunión
 * (`composeReport`), para que los tres se vean igual y una corrección del
 * motor valga para todos. Y descarga por la ÚNICA función de descarga
 * (`descargarArchivo`) — cuatro maneras de bajar un archivo fue un bug real.
 *
 * NO usa IA a propósito. El ROPRE ya es una estructura curada a mano, no notas
 * en bruto que haya que sintetizar: todo lo que sale aquí está CONTADO desde
 * los items. Así el informe no depende de que Claude responda, no añade
 * latencia, y no hay nada que marcar como "lectura" (R-46).
 *
 * Dos entradas, mismas que el reporte de reunión:
 *  - buildRopreReport(): arma el doc → blob + base64 (para adjuntar al correo).
 *  - downloadRopreReportPdf(): lo genera y lo descarga (botón manual).
 */

const BRAND_V = '#6366F1';

const ESTADO_LABEL: Record<string, string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  review: 'En revisión',
  done: 'Completado',
};

/** Orden de riesgo: primero lo que puede tumbar el proyecto. */
const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function ropreStyles(accent: string): string {
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    .rep{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;line-height:1.5;background:#fff;width:760px}
    .rep .body{width:760px}
    .rep .block{width:760px;padding-bottom:2px}
    .rep .lead{font-size:20px;font-weight:800;letter-spacing:-.01em;color:#111827;line-height:1.25;margin-bottom:10px}
    .rep .deck{font-size:13.5px;color:#3a4150;line-height:1.7;margin-bottom:16px;max-width:680px}
    .rep .chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
    .rep .chip{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:7px 12px;border-radius:7px;border-left:4px solid #6b7280;background:#f7f8fa;color:#334}
    .rep .chip.g{border-color:#10b981}.rep .chip.a{border-color:#f59e0b}.rep .chip.r{border-color:#ef4444}.rep .chip.b{border-color:${accent}}
    /* Las cifras van en una TIRA de celdas pegadas, no en tarjetas sueltas con
       borde propio: entran cinco donde antes cabían tres y ocupan menos alto. */
    .rep .figs{display:grid;gap:1px;background:#e6e8ee;border:1px solid #e6e8ee;border-radius:6px;overflow:hidden}
    .rep .fig{background:#fff;padding:7px 9px}
    .rep .fig .l{font-size:7.5px;letter-spacing:.09em;text-transform:uppercase;color:#8a93a2;font-weight:700}
    .rep .fig .n{font-size:15px;font-weight:800;line-height:1.15;margin-top:2px}
    .rep .fig .s{font-size:8px;color:#8a93a2;line-height:1.3;margin-top:1px}
    .rep .fig.r .n{color:#9a2a2a}
    .rep .fig.a .n{color:#b45309}
    .rep .fig .stale{color:#8a5a12;font-weight:600}
    /* Objetivos con barra de avance */
    .rep .obj{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f0f1f5}
    .rep .obj:last-child{border-bottom:0}
    .rep .obj .t{font-size:11.5px;font-weight:600;flex:1;min-width:0}
    .rep .obj .bar{width:84px;height:5px;border-radius:3px;background:#e6e8ee;overflow:hidden;flex:none}
    .rep .obj .bar i{display:block;height:100%;background:${accent};border-radius:3px}
    .rep .obj .v{font-size:11px;white-space:nowrap;color:#46505f}
    .rep .obj .v b{color:#1f2430;font-weight:700}
    .rep .resumen{font-size:10.5px;color:#46505f;line-height:1.55;border-left:2px solid ${accent};padding:2px 0 2px 10px}
    /* Riesgos en FILAS. Como tarjetas, seis riesgos eran media página. */
    .rep .riesgo{display:flex;gap:9px;padding:6px 0;border-bottom:1px solid #f0f1f5}
    .rep .riesgo:last-child{border-bottom:0}
    .rep .riesgo .franja{width:3px;border-radius:2px;flex:none;background:#9a2a2a}
    .rep .riesgo.md .franja{background:#9a6a2a;opacity:.55}
    .rep .riesgo .rtxt{min-width:0;flex:1}
    .rep .riesgo .rtit{font-size:11px;font-weight:700;line-height:1.35}
    .rep .riesgo .rmit{font-size:10px;color:#46505f;line-height:1.45;margin-top:1px}
    .rep .riesgo .rlvl{font-size:7.5px;font-weight:800;letter-spacing:.08em;color:#9a2a2a;padding-top:1px}
    .rep .riesgo.md .rlvl{color:#9a6a2a}
    .rep .kpi{border:1px solid #e6e8ee;border-top:3px solid ${accent};border-radius:9px;padding:12px;background:#fff}
    .rep .kpi.g{border-top-color:#10b981}.rep .kpi.a{border-top-color:#f59e0b}.rep .kpi.r{border-top-color:#ef4444}.rep .kpi.b{border-top-color:${accent}}
    .rep .kpi .l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;font-weight:700}
    .rep .kpi .n{font-size:20px;font-weight:800;margin-top:6px;line-height:1.1}
    .rep .kpi .s{font-size:10px;color:#6b7280;margin-top:4px;line-height:1.4}
    .rep .sec{display:flex;align-items:center;gap:12px;margin:6px 0 14px}
    .rep .sec .no{font-size:11px;font-weight:800;color:${accent}}
    .rep .sec h2{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    .rep .sec .tag{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${accent};border:1px solid ${accent};border-radius:20px;padding:0 10px;height:18px;display:inline-flex;align-items:center;line-height:1}
    .rep .sec .ln{flex:1;height:1px;background:#e6e8ee}
    .rep .ropre{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .rep .col .ch{display:flex;align-items:center;gap:7px;color:#fff;padding:9px 10px;border-radius:8px 8px 0 0;font-weight:800}
    .rep .col .ch .big{font-size:16px}.rep .col .ch .lab{font-size:9px;letter-spacing:.1em;text-transform:uppercase}
    .rep .col .items{border:1px solid #e6e8ee;border-top:none;border-radius:0 0 8px 8px;padding:8px 9px;min-height:150px}
    .rep .col .it{font-size:10.5px;color:#3a4150;line-height:1.4;padding:7px 0;border-bottom:1px solid #f0f1f5}
    .rep .col .it:last-child{border-bottom:none}
    .rep .c1 .ch{background:${accent}}.rep .c2 .ch{background:#7c8aa0}.rep .c3 .ch{background:#b08948}.rep .c4 .ch{background:#ef4444}.rep .c5 .ch{background:#10b981}
    .rep .risks{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rep .risk{border:1px solid #e6e8ee;border-radius:10px;overflow:hidden}
    .rep .risk .rh{padding:9px 12px;color:#fff;font-size:11.5px;font-weight:700;display:flex;justify-content:space-between;gap:8px;align-items:center}
    .rep .risk.hi .rh{background:#9a2a2a}.rep .risk.md .rh{background:#9a6a2a}.rep .risk.lo .rh{background:#5a6a3a}
    .rep .risk .badge{font-size:8.5px;font-weight:800;background:rgba(255,255,255,.22);padding:2px 7px;border-radius:5px}
    .rep .risk .rb{padding:10px 12px;font-size:11px;color:#46505f;line-height:1.55}
    .rep .risk .mit{margin-top:6px;font-size:10.5px;color:#1f2430}.rep .risk .mit b{color:${accent}}
    .rep table{width:100%;border-collapse:collapse;font-size:11.5px}
    .rep thead th{text-align:left;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;padding:9px 10px;border-bottom:2px solid #e6e8ee;font-weight:700}
    .rep tbody td{padding:9px 10px;border-bottom:1px solid #f0f1f5;color:#3a4150;vertical-align:top}
    .rep tbody tr:nth-child(even){background:#fafbfc}
    .rep td.task{color:#1f2430;font-weight:600}
    .rep td.task .sub{font-weight:400;color:#8a93a2;font-size:10px;margin-top:2px}
    .rep td.due{white-space:nowrap;text-align:center}
    .rep .due-pill{font-size:10px;font-weight:700;color:${accent};background:${accent}14;padding:3px 9px;border-radius:6px;white-space:nowrap}
    .rep .due-pill.late{color:#b91c1c;background:#fee2e2}
    .rep .link{font-size:9.5px;font-weight:700;color:${accent};background:${accent}14;padding:2px 7px;border-radius:5px;white-space:nowrap}
    .rep .note{border:1px solid #e6e8ee;border-left:3px solid ${accent};border-radius:10px;padding:14px 16px;font-size:12.5px;color:#46505f;line-height:1.6}
    .rep .lista{display:flex;flex-direction:column;gap:8px}
    .rep .li{border:1px solid #e6e8ee;border-left:3px solid ${accent};border-radius:10px;padding:11px 14px}
    .rep .li .t{font-size:12.5px;font-weight:700;color:#26303f;line-height:1.4}
    .rep .li .d{font-size:11px;color:#56606f;line-height:1.55;margin-top:4px}
  `;
}

/** ¿La fecha ya pasó? Comparación por día, no por instante. */
function estaVencido(dueDate: string | undefined, hoy: Date): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.setHours(23, 59, 59, 999) < hoy.getTime();
}

function fechaCorta(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'd MMM yyyy', { locale: es });
}

/** Un periodo con nombre. `undefined` = sin acotar, sale el estado completo. */
export interface PeriodoInforme {
  etiqueta: string;   // "Quincena", "Semana", "Mes", "Rango"
  desde: Date;
  hasta: Date;
}

/** Texto del periodo para la cabecera: "16 – 30 sep 2026". */
function rotuloPeriodo(p: PeriodoInforme): string {
  const mismoAnio = p.desde.getFullYear() === p.hasta.getFullYear();
  const a = format(p.desde, mismoAnio ? 'd MMM' : 'd MMM yyyy', { locale: es });
  const b = format(p.hasta, 'd MMM yyyy', { locale: es });
  return `${a} – ${b}`;
}

/**
 * Arma los bloques HTML. Todo contado desde los items; nada interpretado.
 *
 * ORDEN Y RECORTE (founder, 16 y 17-sep-2026).
 *
 * Los OBJETIVOS van primero: son el marco con el que se lee todo lo demás.
 * Debajo, el resumen de la reunión cuando el informe se manda desde una — sale
 * de `meeting.summary`, que ya está guardado, así que no lo escribe una IA y no
 * puede inventarse nada.
 *
 * Fuera el tablero de 5 columnas (imprimía los mismos títulos que volvían a
 * salir abajo: casi una página de duplicado), fuera las premisas (son supuestos
 * de partida, no cambian de una semana a otra) y fuera los entregables ya
 * cerrados, que convertían el informe en un archivo en vez de una foto de qué
 * falta. Los riesgos bajos se cuentan pero no se despliegan.
 *
 * Dos hojas si hacen falta: la segunda ya no se aprieta.
 */
function buildBlocks(
  client: Client,
  items: RopreItem[],
  meeting?: Meeting,
  periodo?: PeriodoInforme,
): string[] {
  const hoy = new Date();
  const sh = (title: string, tag?: string) =>
    `<div class="sec"><h2>${esc(title)}</h2>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="ln"></span></div>`;

  const por = (t: RopreType) => items.filter((i) => i.type === t);

  // El periodo acota SOLO los entregables. Un riesgo vivo lo sigue estando
  // aunque se registrara el mes pasado, y un objetivo del trimestre no cabe en
  // una quincena: esos van con su estado de hoy.
  const enPeriodo = (e: RopreItem) => {
    if (!periodo || !e.dueDate) return true;
    const d = new Date(e.dueDate);
    return !Number.isNaN(d.getTime()) && d >= periodo.desde && d <= periodo.hasta;
  };

  const entregables = por('deliverable').filter(enPeriodo);
  const abiertos = entregables.filter((e) => e.status !== 'done');
  const cerrados = entregables.length - abiertos.length;
  const vencidos = abiertos.filter((e) => estaVencido(e.dueDate, hoy)).length;

  const riesgos = por('risk').slice().sort((a, b) => (RISK_ORDER[a.riskLevel ?? 'medium'] ?? 1) - (RISK_ORDER[b.riskLevel ?? 'medium'] ?? 1));
  const riesgosVisibles = riesgos.filter((r) => r.riskLevel !== 'low');
  const riesgosBajos = riesgos.length - riesgosVisibles.length;
  const riesgosAltos = riesgos.filter((r) => r.riskLevel === 'high').length;

  const blocks: string[] = [];

  // ── Cinco cifras en una tira baja ──
  const m = client.metrics ?? ({} as Client['metrics']);
  const fig = (l: string, n: string, sub: string, cls = '') =>
    `<div class="fig ${cls}"><div class="l">${esc(l)}</div><div class="n">${esc(n)}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;

  /**
   * Inversión y ROAS son valores GUARDADOS y no siempre al día — lo avisa el
   * propio LEEME del traspaso. En un informe que se le manda al cliente, un
   * ROAS de hace dos semanas presentado como el de hoy es una mentira con
   * número, y nadie duda de un número. Cuando no está fresco se dice desde
   * cuándo; cuando no hay dato se pone "—" y NO se cae al presupuesto, que es
   * lo que se pensaba gastar y no lo que se gastó.
   */
  const fresco = m.invertedThisMonthFresh === true;
  const nota = fresco ? 'actualizado' : `<span class="stale">${esc(format(new Date(client.updatedAt ?? hoy), "'al' d MMM", { locale: es }))}</span>`;
  const invertido = typeof m.invertedThisMonth === 'number'
    ? `$${m.invertedThisMonth.toLocaleString('es-CO')}`
    : '—';
  const roas = typeof m.roas === 'number' ? `${m.roas.toFixed(1)}x` : '—';

  blocks.push(
    `<div class="figs" style="grid-template-columns:repeat(5,1fr)">${
      fig('Entregables', `${cerrados}/${entregables.length}`, 'completados',
          entregables.length > 0 && cerrados === entregables.length ? '' : '') +
      fig('Riesgos altos', String(riesgosAltos), riesgosBajos ? `${riesgos.length} en total` : '', riesgosAltos ? 'r' : '') +
      fig('Vencidos', String(vencidos), 'fuera de fecha', vencidos ? 'a' : '') +
      fig('Invertido', invertido, invertido === '—' ? 'sin dato' : 'este mes') +
      fig('ROAS', roas, roas === '—' ? 'sin dato' : nota)
    }</div>`,
  );

  if (!items.length) {
    blocks.push(sh('Sin ROPRE registrado') + `<div class="note">Este cliente aún no tiene ningún item de ROPRE registrado. En cuanto se carguen objetivos, riesgos o entregables aparecerán en este informe.</div>`);
    return blocks;
  }

  // ── Objetivos, primero ──
  const objetivos = [...por('result'), ...por('objective')];
  if (objetivos.length) {
    const avance = (meta?: string, actual?: string): number | null => {
      const n = (v?: string) => {
        const x = parseFloat(String(v ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.'));
        return Number.isFinite(x) ? x : null;
      };
      const a = n(actual), b = n(meta);
      if (a === null || b === null || b === 0) return null;
      return Math.max(0, Math.min(100, Math.round((a / b) * 100)));
    };
    blocks.push(
      sh('Objetivos') +
      objetivos.map((o) => {
        const pct = avance(o.targetValue, o.currentValue);
        return `<div class="obj"><span class="t">${esc(o.title)}</span>${
          pct !== null ? `<span class="bar"><i style="width:${pct}%"></i></span>` : ''
        }<span class="v">${o.currentValue ? `<b>${esc(o.currentValue)}</b>` : '—'}${o.targetValue ? ` / ${esc(o.targetValue)}` : ''}</span></div>`;
      }).join(''),
    );
  }

  // ── De la reunión: texto YA guardado, sin IA ──
  if (meeting?.summary?.trim()) {
    blocks.push(
      sh('De la última reunión', format(parseISO(meeting.scheduledAt), 'd MMM', { locale: es })) +
      `<div class="resumen">${esc(meeting.summary.trim().slice(0, 700))}</div>`,
    );
  }

  // ── Riesgos, en filas ──
  if (riesgosVisibles.length) {
    const riskRow = (r: RopreItem) => {
      const md = r.riskLevel !== 'high';
      return `<div class="riesgo${md ? ' md' : ''}"><span class="franja"></span><span class="rtxt"><span class="rtit">${esc(r.title)}</span>${
        r.mitigation ? `<div class="rmit">&rarr; ${esc(r.mitigation)}</div>` : (r.description ? `<div class="rmit">${esc(r.description)}</div>` : '')
      }</span><span class="rlvl">${md ? 'MEDIO' : 'ALTO'}</span></div>`;
    };
    blocks.push(
      sh('Riesgos', riesgosBajos ? `+${riesgosBajos} de nivel bajo` : undefined) +
      riesgosVisibles.map(riskRow).join(''),
    );
  }

  // ── Qué falta: solo lo abierto, lo vencido primero ──
  if (abiertos.length) {
    const orden = abiertos.slice().sort((a, b) => {
      const va = estaVencido(a.dueDate, hoy) ? 0 : 1;
      const vb = estaVencido(b.dueDate, hoy) ? 0 : 1;
      if (va !== vb) return va - vb;
      return new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime();
    });
    blocks.push(
      sh('Qué falta', `${abiertos.length} abierto${abiertos.length === 1 ? '' : 's'} · ${cerrados} cerrado${cerrados === 1 ? '' : 's'}`) +
      `<table><thead><tr><th>Entregable</th><th>Responsable</th><th style="text-align:right">Entrega</th></tr></thead><tbody>${
        orden.map((e) => {
          const tarde = estaVencido(e.dueDate, hoy);
          const dias = tarde && e.dueDate ? Math.max(1, diasEntre(new Date(e.dueDate), hoy)) : 0;
          const responsable = e.responsible ? resolveAssignee(e.responsible, client.id) : '—';
          const estado = ESTADO_LABEL[e.status ?? 'todo'] ?? '';
          return `<tr><td class="task">${esc(e.title)}${e.linkedTaskId ? ' <span class="link">EN TAREAS</span>' : ''}${estado ? `<div class="sub">${esc(estado)}</div>` : ''}</td><td>${esc(responsable)}</td><td class="due"><span class="due-pill${tarde ? ' late' : ''}">${esc(tarde ? `${dias}d tarde` : fechaCorta(e.dueDate))}</span></td></tr>`;
        }).join('')
      }</tbody></table>`,
    );
  } else if (entregables.length) {
    blocks.push(sh('Qué falta') + `<div class="note">Los ${entregables.length} entregables del periodo están completados.</div>`);
  }

  return blocks;
}

/** Bajada ejecutiva para el cuerpo del correo — contada, sin IA. */
function buildDeck(items: RopreItem[]): string {
  const entregables = items.filter((i) => i.type === 'deliverable');
  const cerrados = entregables.filter((e) => e.status === 'done').length;
  const altos = items.filter((i) => i.type === 'risk' && i.riskLevel === 'high').length;
  if (!items.length) return 'Este cliente aún no tiene ROPRE registrado.';
  const partes = [`${entregables.length} entregable${entregables.length === 1 ? '' : 's'} (${cerrados} completado${cerrados === 1 ? '' : 's'})`];
  const riesgos = items.filter((i) => i.type === 'risk').length;
  if (riesgos) partes.push(`${riesgos} riesgo${riesgos === 1 ? '' : 's'}${altos ? `, ${altos} de nivel alto` : ''}`);
  return partes.join(' · ');
}

function buildModel(client: Client, items: RopreItem[], meeting: Meeting | undefined, agency: string, periodo?: PeriodoInforme): ReportModel {
  const accent = client.primaryColor || BRAND_V;
  const hoy = new Date();
  const dateLabel = format(hoy, "EEEE d 'de' MMMM yyyy", { locale: es });
  return {
    styles: ropreStyles(accent),
    blocks: buildBlocks(client, items, meeting, periodo),
    accentClient: accent,
    client: client.name,
    agency,
    titleLines: ['Informe ROPRE'],
    subtitle: 'Riesgos, entregables abiertos y objetivos',
    runningLabel: 'Informe ROPRE',
    // Portada baja: en un informe de una página la banda de 50 mm se comía un
    // bloque entero. Ver `coverCompact` en htmlReport.
    coverCompact: true,
    meta: periodo
      ? [{ k: periodo.etiqueta, v: rotuloPeriodo(periodo) }]
      : [{ k: 'Fecha', v: format(hoy, 'd MMM yyyy', { locale: es }) }],
    footerLeft: `${client.name} · Informe ROPRE · ${periodo ? rotuloPeriodo(periodo) : dateLabel}`,
    fileName: `Informe_ROPRE_${client.name.replace(/\s+/g, '_')}_${format(hoy, 'yyyy-MM-dd')}.pdf`,
    // JPEG comprimido → el PDF pesa poco y no excede el límite del Edge
    // Function al enviarlo por correo (un ROPRE grande pesa más que una reunión).
    imageFormat: 'JPEG',
    imageQuality: 0.82,
  };
}

export interface BuildRopreReportResult {
  blob: Blob;
  base64: string;      // sin el prefijo data:
  fileName: string;
  deck: string;        // bajada para el cuerpo del correo
}

/**
 * Arma el PDF del ROPRE. Devuelve blob + base64 (para adjuntar al correo).
 *
 * Vuelve a filtrar por cliente aunque quien llama ya lo haya hecho: es la red
 * de seguridad para que no se cuele el ROPRE de otro cliente en un informe.
 */
export async function buildRopreReport(
  client: Client,
  items: RopreItem[],
  opts?: { meeting?: Meeting; periodo?: PeriodoInforme },
): Promise<BuildRopreReportResult> {
  const propios = items.filter((i) => i.clientId === client.id);
  const agency = ((client.onboardingData?.team ?? {}) as { agency?: string }).agency ?? BRAND.label;
  const model = buildModel(client, propios, opts?.meeting, agency, opts?.periodo);
  const doc = await composeReport(model);
  const blob = doc.output('blob') as Blob;
  const dataUri = doc.output('datauristring') as string;
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  return { blob, base64, fileName: model.fileName, deck: buildDeck(propios) };
}

/** Genera y DESCARGA el informe (botón manual). */
export async function downloadRopreReportPdf(client: Client, items: RopreItem[], meeting?: Meeting, periodo?: PeriodoInforme): Promise<void> {
  const { blob, fileName } = await buildRopreReport(client, items, { meeting, periodo });
  descargarArchivo(blob, fileName);
}
