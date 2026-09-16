import { format } from 'date-fns';
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
    .rep .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
    .rep .kpis.kpis-3{grid-template-columns:repeat(3,1fr)}
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

/**
 * Arma los bloques HTML. Todo contado desde los items; nada interpretado.
 *
 * FORMA: UNA PÁGINA, SOLO LO QUE REQUIERE ACCIÓN (founder, 16-sep-2026).
 *
 * La primera versión tenía 6 secciones y un tablero de 5 columnas, y el tablero
 * imprimía el título de CADA item — los mismos que volvían a salir abajo con su
 * detalle. Casi una página de duplicado exacto. También sacaba 5 KPIs, de los
 * que 3 no deciden nada (saber que hay 4 premisas no cambia ninguna acción), y
 * listaba los entregables ya completados, que convierten el informe en un
 * archivo histórico en vez de una foto de qué falta.
 *
 * La pregunta que responde ahora es "¿qué está en riesgo y qué falta?", no
 * "¿qué hay registrado?". Las premisas salen fuera: son supuestos de partida,
 * no cambian de una semana a otra. Siguen vivas en el módulo ROPRE.
 */
function buildBlocks(client: Client, items: RopreItem[], meeting?: Meeting): string[] {
  const hoy = new Date();
  let secN = 0;
  const sh = (title: string, tag?: string) =>
    `<div class="sec"><span class="no">${secN < 9 ? '0' : ''}${++secN}</span><h2>${esc(title)}</h2>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="ln"></span></div>`;

  const por = (t: RopreType) => items.filter((i) => i.type === t);
  const entregables = por('deliverable');
  const abiertos = entregables.filter((e) => e.status !== 'done');
  const cerrados = entregables.length - abiertos.length;
  const vencidos = abiertos.filter((e) => estaVencido(e.dueDate, hoy)).length;

  const riesgos = por('risk').slice().sort((a, b) => (RISK_ORDER[a.riskLevel ?? 'medium'] ?? 1) - (RISK_ORDER[b.riskLevel ?? 'medium'] ?? 1));
  // Los de nivel bajo se cuentan pero no se despliegan: ocupan lo mismo que un
  // riesgo alto y no piden nada a nadie.
  const riesgosVisibles = riesgos.filter((r) => r.riskLevel !== 'low');
  const riesgosBajos = riesgos.length - riesgosVisibles.length;
  const riesgosAltos = riesgos.filter((r) => r.riskLevel === 'high').length;

  const blocks: string[] = [];

  // ── Encabezado: tres cifras, y solo las que deciden algo ──
  const kpi = (l: string, n: string, sub: string, cls: string) =>
    `<div class="kpi ${cls}"><div class="l">${esc(l)}</div><div class="n">${esc(n)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;

  blocks.push(
    `<div class="lead">ROPRE de ${esc(client.name)}</div>` +
    `<div class="deck">Estado al ${esc(format(hoy, "d 'de' MMMM yyyy", { locale: es }))}. Todas las cifras están contadas desde los datos de la app.</div>` +
    `<div class="kpis kpis-3">${
      kpi('Entregables', `${cerrados}/${entregables.length}`, 'completados',
          entregables.length > 0 && cerrados === entregables.length ? 'g' : 'b') +
      kpi('Riesgos altos', String(riesgosAltos), riesgosBajos ? `${riesgos.length} en total` : '', riesgosAltos ? 'r' : 'g') +
      kpi('Vencidos', String(vencidos), 'entregables fuera de fecha', vencidos ? 'a' : 'g')
    }</div>`,
  );

  // ── Nada registrado: una página con la nota, nunca un PDF en blanco ──
  if (!items.length) {
    blocks.push(sh('Sin ROPRE registrado') + `<div class="note">Este cliente aún no tiene ningún item de ROPRE registrado. En cuanto se carguen resultados, objetivos, riesgos o entregables aparecerán en este informe.</div>`);
    return blocks;
  }

  // ── 01 · Riesgos ──
  if (riesgosVisibles.length) {
    const riskCard = (r: RopreItem) => {
      const lvl = r.riskLevel === 'high' ? 'hi' : 'md';
      const badge = r.riskLevel === 'high' ? 'ALTO' : 'MEDIO';
      return `<div class="risk ${lvl}"><div class="rh">${esc(r.title)}<span class="badge">${badge}</span></div><div class="rb">${esc(r.description ?? '')}${r.mitigation ? `<div class="mit"><b>&rarr;</b> ${esc(r.mitigation)}</div>` : ''}</div></div>`;
    };
    blocks.push(
      sh('Riesgos', riesgosBajos ? `+${riesgosBajos} de nivel bajo` : undefined) +
      `<div class="risks">${riesgosVisibles.map(riskCard).join('')}</div>`,
    );
  }

  // ── 02 · Qué falta — solo lo abierto. Lo cerrado es un número, no una lista ──
  if (abiertos.length) {
    const orden = abiertos.slice().sort((a, b) => {
      const va = estaVencido(a.dueDate, hoy) ? 0 : 1;
      const vb = estaVencido(b.dueDate, hoy) ? 0 : 1;
      if (va !== vb) return va - vb;
      return new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime();
    });
    blocks.push(
      sh('Qué falta', `${abiertos.length} abierto${abiertos.length === 1 ? '' : 's'} · ${cerrados} cerrado${cerrados === 1 ? '' : 's'}`) +
      `<table><thead><tr><th>Entregable</th><th>Responsable</th><th style="text-align:center">Entrega</th></tr></thead><tbody>${
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
    blocks.push(sh('Qué falta') + `<div class="note">Los ${entregables.length} entregables están completados.</div>`);
  }

  // ── 03 · Objetivos, con meta contra realidad ──
  const conMeta = [...por('result'), ...por('objective')];
  if (conMeta.length) {
    blocks.push(
      sh('Objetivos') +
      `<table><thead><tr><th>Objetivo</th><th style="text-align:center">Meta</th><th style="text-align:center">Hoy</th></tr></thead><tbody>${
        conMeta.map((i) => `<tr><td class="task">${esc(i.title)}</td><td class="due">${esc(i.targetValue || '—')}</td><td class="due">${esc(i.currentValue || '—')}</td></tr>`).join('')
      }</tbody></table>`,
    );
  }

  // ── Qué tocó ESTA reunión. Solo al mandarlo desde una, y en una línea ──
  if (meeting) {
    const tocados = items.filter((i) => i.lastEditedInMeetingId === meeting.id);
    if (tocados.length) {
      blocks.push(
        sh('Actualizado en esta reunión', `${tocados.length}`) +
        `<div class="note">${tocados.map((i) => esc(i.title)).join(' · ')}</div>`,
      );
    }
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

function buildModel(client: Client, items: RopreItem[], meeting: Meeting | undefined, agency: string): ReportModel {
  const accent = client.primaryColor || BRAND_V;
  const hoy = new Date();
  const dateLabel = format(hoy, "EEEE d 'de' MMMM yyyy", { locale: es });
  return {
    styles: ropreStyles(accent),
    blocks: buildBlocks(client, items, meeting),
    accentClient: accent,
    client: client.name,
    agency,
    titleLines: ['Informe', 'ROPRE'],
    subtitle: 'Riesgos, entregables abiertos y objetivos',
    runningLabel: 'Informe ROPRE',
    meta: [
      { k: 'Cliente', v: client.name.slice(0, 28) },
      { k: 'Items', v: String(items.length) },
      { k: 'Fecha', v: format(hoy, 'd MMM yyyy', { locale: es }) },
    ],
    footerLeft: `${client.name} · Informe ROPRE · ${dateLabel}`,
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
  opts?: { meeting?: Meeting },
): Promise<BuildRopreReportResult> {
  const propios = items.filter((i) => i.clientId === client.id);
  const agency = ((client.onboardingData?.team ?? {}) as { agency?: string }).agency ?? BRAND.label;
  const model = buildModel(client, propios, opts?.meeting, agency);
  const doc = await composeReport(model);
  const blob = doc.output('blob') as Blob;
  const dataUri = doc.output('datauristring') as string;
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  return { blob, base64, fileName: model.fileName, deck: buildDeck(propios) };
}

/** Genera y DESCARGA el informe (botón manual). */
export async function downloadRopreReportPdf(client: Client, items: RopreItem[], meeting?: Meeting): Promise<void> {
  const { blob, fileName } = await buildRopreReport(client, items, { meeting });
  descargarArchivo(blob, fileName);
}
