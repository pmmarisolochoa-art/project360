import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import { generateMeetingReport, type MeetingReportData } from '@/services/claudeApi';
import { resolveRoleLabel } from '@/utils/roleResolver';
import { composeReport, escapeReport as esc, type ReportModel } from '@/services/htmlReport';

/**
 * Reporte ejecutivo de reunión (PM experto) en PDF.
 *
 * Usa el MISMO motor paginado del reporte semanal (composeReport): cada bloque
 * se coloca sin cortarse, con cabecera y footer nativos en cada página A4 y
 * tamaño correcto para zoom 100%. Así el reporte de reunión y el semanal
 * comparten diseño (coherencia entre todos los reportes del cliente).
 *
 * El análisis (deck, KPIs, decisiones, riesgos, próximos pasos) lo redacta la
 * IA como PM experto; los compromisos vienen de las tareas ya extraídas.
 *
 * Dos entradas:
 *  - buildReportFromMeeting(): sintetiza + arma el doc → blob + base64 (correo).
 *  - downloadMeetingReportPdf(): lo genera y lo descarga (botón manual).
 */

export interface Commitment { title: string; responsible: string; dueInDays: number }

const BRAND_V = '#6366F1';

const TONE_CLASS: Record<string, string> = { g: 'g', r: 'r', a: 'a', b: 'b', '': '' };
const RISK_META: Record<string, { cls: 'hi' | 'md' | 'lo'; badge: string }> = {
  high: { cls: 'hi', badge: 'ALTO' },
  medium: { cls: 'md', badge: 'MEDIO' },
  low: { cls: 'lo', badge: 'BAJO' },
};

function meetingReportStyles(accent: string): string {
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
    .rep .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
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
    .rep .decs{display:flex;flex-direction:column;gap:8px}
    .rep .dec{border:1px solid #e6e8ee;border-left:3px solid ${accent};border-radius:10px;padding:11px 14px;display:flex;gap:11px;align-items:flex-start}
    .rep .dec .num{flex:none;width:22px;height:22px;border-radius:50%;background:${accent};color:#fff;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;margin-top:1px}
    .rep .dec .dt{font-size:12.5px;color:#26303f;line-height:1.5}
    .rep table{width:100%;border-collapse:collapse;font-size:11.5px}
    .rep thead th{text-align:left;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;padding:9px 10px;border-bottom:2px solid #e6e8ee;font-weight:700}
    .rep tbody td{padding:9px 10px;border-bottom:1px solid #f0f1f5;color:#3a4150;vertical-align:top}
    .rep tbody tr:nth-child(even){background:#fafbfc}
    .rep td.task{color:#1f2430;font-weight:600}
    .rep td.due{white-space:nowrap;text-align:center}
    .rep .due-pill{font-size:10px;font-weight:700;color:${accent};background:${accent}14;padding:3px 9px;border-radius:6px;white-space:nowrap}
    .rep .risks{display:flex;flex-direction:column;gap:10px}
    .rep .risk{border:1px solid #e6e8ee;border-radius:10px;overflow:hidden}
    .rep .risk .rh{padding:9px 12px;color:#fff;font-size:11.5px;font-weight:700;display:flex;justify-content:space-between;gap:8px;align-items:center}
    .rep .risk.hi .rh{background:#9a2a2a}.rep .risk.md .rh{background:#9a6a2a}.rep .risk.lo .rh{background:#5a6a3a}
    .rep .risk .badge{font-size:8.5px;font-weight:800;background:rgba(255,255,255,.22);padding:2px 7px;border-radius:5px}
    .rep .risk .rb{padding:10px 12px;font-size:11px;color:#46505f;line-height:1.55}
    .rep .nextlist{display:flex;flex-direction:column;gap:7px}
    .rep .nextitem{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:#26303f;line-height:1.5}
    .rep .nextitem .b{flex:none;width:18px;height:18px;border-radius:6px;background:${accent}14;color:${accent};font-weight:800;font-size:10px;display:flex;align-items:center;justify-content:center;margin-top:1px}
    .rep .focus{border:1px solid ${accent};border-radius:12px;overflow:hidden}
    .rep .focus .fh{background:${accent};color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:8px 14px}
    .rep .focus .fb{padding:13px 16px;font-size:13px;color:#26303f;line-height:1.6}
  `;
}

/** Arma los bloques HTML del reporte a partir del análisis de la IA. */
function buildBlocks(args: {
  meeting: Meeting;
  report: MeetingReportData;
  commitments: Commitment[];
  date: Date;
}): string[] {
  const { meeting, report, commitments, date } = args;
  let secN = 0;
  const sh = (title: string, tag?: string) =>
    `<div class="sec"><span class="no">${secN < 9 ? '0' : ''}${++secN}</span><h2>${esc(title)}</h2>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="ln"></span></div>`;

  const blocks: string[] = [];

  // ── Bloque 1: encabezado editorial (headline + deck + chips + KPIs) ──
  const chips: Array<{ cls: string; txt: string }> = [
    { cls: meeting.completed ? 'g' : 'a', txt: meeting.completed ? 'Realizada' : 'Pendiente' },
    { cls: '', txt: `${meeting.durationMin} min` },
  ];
  if (commitments.length) chips.push({ cls: 'b', txt: `${commitments.length} compromisos` });
  if (report.risks.length) chips.push({ cls: 'r', txt: `${report.risks.length} riesgo${report.risks.length === 1 ? '' : 's'}` });

  const kpisHtml = report.kpis.length
    ? `<div class="kpis">${report.kpis.map((k) => `<div class="kpi ${TONE_CLASS[k.tone] ?? ''}"><div class="l">${esc(k.label)}</div><div class="n">${esc(k.value)}</div>${k.sub ? `<div class="s">${esc(k.sub)}</div>` : ''}</div>`).join('')}</div>`
    : '';

  blocks.push(
    (report.headline ? `<div class="lead">${esc(report.headline)}</div>` : '') +
    (report.deck ? `<div class="deck">${esc(report.deck)}</div>` : '') +
    `<div class="chips">${chips.map((c) => `<span class="chip ${c.cls}">${esc(c.txt)}</span>`).join('')}</div>` +
    kpisHtml,
  );

  // ── Decisiones ──
  if (report.decisions.length) {
    blocks.push(
      sh('Decisiones tomadas') +
      `<div class="decs">${report.decisions.map((d, i) => `<div class="dec"><span class="num">${i + 1}</span><span class="dt">${esc(d)}</span></div>`).join('')}</div>`,
    );
  }

  // ── Compromisos y responsables ──
  if (commitments.length) {
    blocks.push(
      sh('Compromisos y responsables', `${commitments.length} tareas`) +
      `<table><thead><tr><th>Tarea</th><th>Responsable</th><th style="text-align:center">Entrega</th></tr></thead><tbody>${
        commitments.map((c) => `<tr><td class="task">${esc(c.title)}</td><td>${esc(c.responsible)}</td><td class="due"><span class="due-pill">en ${esc(c.dueInDays)}d</span></td></tr>`).join('')
      }</tbody></table>`,
    );
  }

  // ── Riesgos y bloqueos ──
  if (report.risks.length) {
    blocks.push(
      sh('Riesgos y bloqueos') +
      `<div class="risks">${report.risks.map((r) => {
        const meta = RISK_META[r.level] ?? RISK_META.medium;
        return `<div class="risk ${meta.cls}"><div class="rh">${esc(r.title)}<span class="badge">${meta.badge}</span></div>${r.detail ? `<div class="rb">${esc(r.detail)}</div>` : ''}</div>`;
      }).join('')}</div>`,
    );
  }

  // ── Próximos pasos ──
  if (report.nextSteps.length) {
    blocks.push(
      sh('Próximos pasos') +
      `<div class="nextlist">${report.nextSteps.map((s, i) => `<div class="nextitem"><span class="b">${i + 1}</span><span>${esc(s)}</span></div>`).join('')}</div>`,
    );
  }

  // ── Foco de la próxima reunión ──
  if (report.nextMeetingFocus) {
    blocks.push(
      `<div class="focus"><div class="fh">Foco de la próxima reunión</div><div class="fb">${esc(report.nextMeetingFocus)}</div></div>`,
    );
  }

  // Fallback: reunión sin contenido.
  if (blocks.length === 1 && !report.headline && !report.deck && !report.kpis.length) {
    blocks.push(sh('Notas') + `<div class="deck">Esta reunión aún no tiene análisis, compromisos ni notas registradas.</div>`);
  }

  void date;
  return blocks;
}

/** Construye el ReportModel para el motor paginado. */
function buildModel(client: Client, meeting: Meeting, report: MeetingReportData, commitments: Commitment[], agency: string): ReportModel {
  const accent = client.primaryColor || BRAND_V;
  const date = parseISO(meeting.scheduledAt);
  const dateLabel = format(date, "EEEE d 'de' MMMM yyyy", { locale: es });
  return {
    styles: meetingReportStyles(accent),
    blocks: buildBlocks({ meeting, report, commitments, date }),
    accentClient: accent,
    client: client.name,
    agency,
    titleLines: ['Reporte de', 'Reunión'],
    subtitle: report.headline || meeting.title,
    runningLabel: 'Reporte de Reunión',
    meta: [
      { k: 'Reunión', v: meeting.title.slice(0, 28) },
      { k: 'Fecha', v: format(date, 'd MMM yyyy', { locale: es }) },
      { k: 'Hora', v: format(date, 'HH:mm', { locale: es }) },
    ],
    footerLeft: `${client.name} · Reporte de Reunión · ${dateLabel}`,
    fileName: `Reporte_Reunion_${client.name.replace(/\s+/g, '_')}_${format(date, 'yyyy-MM-dd')}.pdf`,
  };
}

export interface BuildReportResult {
  blob: Blob;
  base64: string;      // sin el prefijo data:
  fileName: string;
  deck: string;        // bajada ejecutiva (para el cuerpo del correo)
}

/** Sintetiza con IA + arma el PDF paginado. Devuelve blob + base64 (para adjuntar). */
export async function buildReportFromMeeting(
  client: Client,
  meeting: Meeting,
  commitmentsOverride?: Commitment[],
): Promise<BuildReportResult> {
  const agency = ((client.onboardingData?.team ?? {}) as { agency?: string }).agency ?? 'Project360';
  const commitments: Commitment[] = commitmentsOverride ?? (meeting.extractedTasks ?? []).map((t) => ({
    title: t.title,
    responsible: resolveRoleLabel(t.responsibleRole, client.id) ?? t.responsibleRole,
    dueInDays: t.dueInDays,
  }));

  const report = await generateMeetingReport({
    clientName: client.name,
    industry: client.industry,
    meetingType: meeting.type,
    meetingTitle: meeting.title,
    date: format(parseISO(meeting.scheduledAt), "d 'de' MMMM yyyy", { locale: es }),
    agenda: meeting.agenda,
    notes: meeting.notes,
    summary: meeting.summary,
    commitments,
  });

  const model = buildModel(client, meeting, report, commitments, agency);
  const doc = await composeReport(model);
  const blob = doc.output('blob') as Blob;
  const dataUri = doc.output('datauristring') as string;
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  return { blob, base64, fileName: model.fileName, deck: report.deck };
}

/** Genera y DESCARGA el reporte (botón manual). */
export async function downloadMeetingReportPdf(client: Client, meeting: Meeting): Promise<void> {
  const { blob, fileName } = await buildReportFromMeeting(client, meeting);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
