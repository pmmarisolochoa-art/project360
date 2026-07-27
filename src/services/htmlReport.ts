import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, differenceInCalendarDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Task } from '@/types/task';
import type { Meeting } from '@/types/meeting';
import type { Funnel, FunnelPhase } from '@/types/funnel';
import type { RopreItem } from '@/types/ropre';
import { generateWeeklyReport } from '@/services/claudeApi';
import { resolveRoleLabel } from '@/utils/roleResolver';

/**
 * Reporte Ejecutivo Semanal — documento paginado A4 con header/footer nativos
 * en cada página y secciones acomodadas sin cortarse. Diseño Project360
 * (violeta + dark) con firma de color por cliente. (Sprint F)
 */

export interface WeeklyHtmlInput {
  client: Client;
  tasks: Task[];
  meetings: Meeting[];
  ropreItems?: RopreItem[];
  funnel?: Funnel | null;
  phases?: FunnelPhase[];
}

const BRAND = { v: '#6366F1', p: '#8B5CF6', c: '#06B6D4', ink: '#0a0a0f' };
const PALETTE = ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#14B8A6', '#A855F7'];

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export interface ReportModel {
  styles: string;
  blocks: string[];
  client: string;
  agency: string;
  titleLines: string[];
  subtitle: string;
  meta: Array<{ k: string; v: string }>;
  footerLeft: string;
  accentClient: string;
  runningLabel: string;
  fileName: string;
}

/** Helper de escape para HTML — reusable desde otros módulos de reporte. */
export function escapeReport(s: unknown): string {
  return esc(s);
}

export async function exportWeeklyReportHTML(input: WeeklyHtmlInput): Promise<void> {
  await renderReport(await buildReportModel(input));
}

/**
 * Pipeline compartido de render: captura cada bloque por separado con html2canvas,
 * los acomoda en páginas A4 sin cortarlos y dibuja header/footer nativos en cada una.
 * Lo usan tanto el reporte semanal como el de reunión, para que ambos se vean igual.
 */
async function renderReport(m: ReportModel): Promise<void> {
  const doc = await composeReport(m);
  doc.save(m.fileName);
}

/**
 * Igual que renderReport pero NO descarga: devuelve el documento jsPDF ya
 * paginado (con cabecera/footer por página). Sirve para obtener el blob/base64
 * y enviarlo por correo, o para descargarlo manualmente.
 */
export async function composeReport(m: ReportModel): Promise<jsPDF> {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;';
  holder.innerHTML = `<div class="rep"><style>${m.styles}</style><div class="body">${
    m.blocks.map((b) => `<div class="block">${b}</div>`).join('')
  }</div></div>`;
  document.body.appendChild(holder);

  try {
    const SCALE = 2;
    const blockEls = Array.from(holder.querySelectorAll('.block')) as HTMLElement[];
    const imgs: Array<{ data: string; wmm: number; hmm: number }> = [];
    const CONTENT_W = 182; // 210 - 2*14
    for (const el of blockEls) {
      const cv = await html2canvas(el, { scale: SCALE, backgroundColor: '#ffffff', useCORS: true, logging: false });
      imgs.push({ data: cv.toDataURL('image/png'), wmm: CONTENT_W, hmm: (cv.height / cv.width) * CONTENT_W });
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const PH = 297, MX = 14, GAP = 5;
    const P1_TOP = 56, PN_TOP = 19, BOTTOM = PH - 15;

    // --- Layout: asigna bloques a páginas sin cortarlos ---
    const pages: Array<Array<{ img: typeof imgs[number]; y: number }>> = [[]];
    let pi = 0, cy = P1_TOP;
    for (const img of imgs) {
      if (cy + img.hmm > BOTTOM && pages[pi].length > 0) {
        pi++; pages[pi] = []; cy = PN_TOP;
      }
      pages[pi].push({ img, y: cy });
      cy += img.hmm + GAP;
    }
    const total = pages.length;

    pages.forEach((blocks, i) => {
      if (i > 0) doc.addPage();
      if (i === 0) drawCoverHeader(doc, m); else drawRunningHeader(doc, m, i + 1, total);
      drawFooter(doc, m);
      blocks.forEach(({ img, y }) => doc.addImage(img.data, 'PNG', MX, y, img.wmm, img.hmm));
    });

    return doc;
  } finally {
    document.body.removeChild(holder);
  }
}

/* ───────────────────────── Header / Footer nativos ───────────────────────── */

function drawCoverHeader(doc: jsPDF, m: ReportModel) {
  const PW = 210;
  doc.setFillColor(...hexRgb(BRAND.ink));
  doc.rect(0, 0, PW, 50, 'F');
  // eyebrow
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(154, 163, 178);
  doc.text(`${m.client.toUpperCase()} · ${m.agency.toUpperCase()}`, 14, 13);
  // título (1-2 líneas)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255, 255, 255);
  m.titleLines.forEach((ln, i) => doc.text(ln, 14, 25 + i * 9));
  // subtítulo
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(174, 182, 196);
  doc.text(m.subtitle, 14, 25 + m.titleLines.length * 9 + 3, { maxWidth: 120 });
  // meta derecha
  let my = 12;
  m.meta.forEach((row) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(126, 135, 154);
    doc.text(row.k.toUpperCase(), 196, my, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    doc.text(row.v, 196, my + 4.5, { align: 'right' });
    my += 12;
  });
  // regla de marca (3 segmentos = gradiente)
  doc.setFillColor(...hexRgb(BRAND.v)); doc.rect(0, 50, 70, 2, 'F');
  doc.setFillColor(...hexRgb(BRAND.p)); doc.rect(70, 50, 70, 2, 'F');
  doc.setFillColor(...hexRgb(BRAND.c)); doc.rect(140, 50, 70, 2, 'F');
}

function drawRunningHeader(doc: jsPDF, m: ReportModel, page: number, total: number) {
  const PW = 210;
  doc.setFillColor(...hexRgb(BRAND.ink));
  doc.rect(0, 0, PW, 13, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(154, 163, 178);
  doc.text(m.client.toUpperCase(), 14, 8.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(154, 163, 178);
  doc.text(`${m.runningLabel} · Pág. ${page} de ${total} · Confidencial`, 196, 8.5, { align: 'right' });
  doc.setFillColor(...hexRgb(BRAND.v)); doc.rect(0, 13, 70, 1.2, 'F');
  doc.setFillColor(...hexRgb(BRAND.p)); doc.rect(70, 13, 70, 1.2, 'F');
  doc.setFillColor(...hexRgb(BRAND.c)); doc.rect(140, 13, 70, 1.2, 'F');
}

function drawFooter(doc: jsPDF, m: ReportModel) {
  const PW = 210, PH = 297;
  doc.setDrawColor(225, 228, 234); doc.setLineWidth(0.3);
  doc.line(14, PH - 12, PW - 14, PH - 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(140, 147, 164);
  doc.text(m.footerLeft, 14, PH - 7);
  doc.text('Project360 · Confidencial · No distribuir', PW - 14, PH - 7, { align: 'right' });
}

/* ───────────────────────── Modelo + bloques HTML ───────────────────────── */

async function buildReportModel(input: WeeklyHtmlInput): Promise<ReportModel> {
  const { client, tasks, meetings, funnel } = input;
  const ropre = input.ropreItems ?? [];
  const phases = input.phases ?? [];
  const accentClient = client.primaryColor || BRAND.v;
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const inWeek = (iso?: string) => !!iso && isWithinInterval(parseISO(iso), { start: weekStart, end: weekEnd });

  const completed = tasks.filter((t) => t.status === 'completed' && inWeek(t.completedAt));
  const pending = tasks
    .filter((t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'in_review')
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const totalActive = completed.length + pending.length;
  const compliancePct = totalActive === 0 ? 100 : Math.round((completed.length / totalActive) * 100);

  const eventDate = funnel?.eventDate ?? funnel?.endDate;
  const daysToEvent = eventDate ? differenceInCalendarDays(parseISO(eventDate), today) : null;

  const goals = (client.onboardingData.goals ?? {}) as { revenue3m?: number; launchGoal?: string };
  const biz = (client.onboardingData.business ?? {}) as { averageTicket?: number; currency?: string };
  const agency = ((client.onboardingData.team ?? {}) as { agency?: string }).agency ?? 'Project360';
  const money = (n: number) => `$${new Intl.NumberFormat('en-US').format(Math.round(n))}`;

  const ai = await generateWeeklyReport({
    clientName: client.name, weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(),
    tasksCompleted: completed.length, tasksPending: pending.length, compliancePct, daysToNextEvent: daysToEvent,
    pendingTasksSample: pending.slice(0, 10).map((t) => ({
      title: t.title, priority: t.priority, role: resolveRoleLabel(t.assignedTo, client.id) ?? t.assignedTo,
      dueInDays: differenceInCalendarDays(parseISO(t.dueDate), today),
    })),
  });

  const byType = (t: RopreItem['type']) => ropre.filter((i) => i.type === t);
  const risks = byType('risk');
  const deliverablesPending = byType('deliverable').filter((d) => d.status !== 'done').length;

  // ── Chips ──
  const chips: Array<{ cls: string; txt: string }> = [];
  if (daysToEvent != null && eventDate) chips.push({ cls: 'b', txt: `Evento ${format(parseISO(eventDate), 'd MMM', { locale: es })} · ${daysToEvent} días` });
  chips.push({ cls: compliancePct >= 80 ? 'g' : compliancePct >= 50 ? 'a' : 'r', txt: `Cumplimiento: ${compliancePct}%` });
  if (goals.revenue3m) chips.push({ cls: 'b', txt: `Meta ventas: ${money(goals.revenue3m)}` });
  chips.push({ cls: 'a', txt: `Tareas: ${completed.length} ✓ / ${totalActive}` });
  if (deliverablesPending) chips.push({ cls: 'b', txt: `${deliverablesPending} entregables pendientes` });
  if (risks.length) chips.push({ cls: 'r', txt: `${risks.length} riesgo${risks.length === 1 ? '' : 's'} activo${risks.length === 1 ? '' : 's'}` });

  // ── KPIs ──
  const kpis = [
    { cls: 'b', l: 'Días al evento', n: daysToEvent != null ? String(daysToEvent) : '—', s: eventDate ? format(parseISO(eventDate), 'd MMM yyyy', { locale: es }) : 'sin evento' },
    { cls: 'g', l: 'Tareas', n: `${completed.length}/${totalActive}`, s: `${inProgress} en curso` },
    { cls: compliancePct >= 80 ? 'g' : 'a', l: 'Cumplimiento', n: `${compliancePct}%`, s: 'a tiempo' },
    { cls: '', l: 'Ticket', n: biz.averageTicket ? money(biz.averageTicket) : '—', s: biz.currency ?? 'USD' },
    { cls: risks.length ? 'r' : 'g', l: 'Riesgos', n: String(risks.length), s: 'a vigilar' },
  ];

  // ── Decisiones (reuniones) ──
  const decisiones = meetings
    .filter((mt) => (mt.summary && mt.summary.trim()) || (mt.extractedTasks && mt.extractedTasks.length))
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt)).slice(0, 6)
    .map((mt) => ({ t: mt.title, b: (mt.summary && mt.summary.trim()) ? mt.summary.trim().slice(0, 220) : `${mt.extractedTasks?.length ?? 0} compromisos definidos` }));

  // ── Hitos ──
  const start = funnel?.startDate ? parseISO(funnel.startDate) : today;
  const hitos: Array<{ d: string; t: string }> = [
    { d: 'HOY', t: format(today, 'd MMM', { locale: es }) },
    ...phases.slice(0, 4).map((p) => ({ d: format(addDays(start, p.dayStart), 'd MMM', { locale: es }), t: p.name.replace(/^FASE\s*\d+\s*[—-]\s*/i, '') })),
  ];
  if (eventDate) hitos.push({ d: format(parseISO(eventDate), 'd MMM', { locale: es }), t: 'Evento principal' });

  // ── Estilos (sin head/footer: son nativos) ──
  const styles = `
    *{box-sizing:border-box;margin:0;padding:0}
    .rep{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;line-height:1.5;background:#fff;width:760px}
    .rep .body{width:760px}
    .rep .block{width:760px;padding-bottom:2px}
    .rep .chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
    .rep .chip{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:7px 12px;border-radius:7px;border-left:4px solid #6b7280;background:#f7f8fa;color:#334}
    .rep .chip.g{border-color:#10b981}.rep .chip.a{border-color:#f59e0b}.rep .chip.r{border-color:#ef4444}.rep .chip.b{border-color:${BRAND.v}}
    .rep .summary{font-size:13.5px;color:#3a4150;line-height:1.7;margin-bottom:18px}
    .rep .featured{display:flex;border:1px solid ${accentClient};border-radius:12px;overflow:hidden;margin-bottom:14px}
    .rep .featured .big{background:linear-gradient(135deg,${accentClient},#0369a1);color:#fff;padding:18px 22px;min-width:190px}
    .rep .featured .big .n{font-size:30px;font-weight:800;line-height:1}
    .rep .featured .big .l{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.85;margin-top:6px}
    .rep .featured .ctx{padding:16px 20px;font-size:12px;color:#46505f}
    .rep .featured .ctx .t{font-weight:700;color:#1f2430;font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px}
    .rep .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
    .rep .kpi{border:1px solid #e6e8ee;border-top:3px solid ${BRAND.v};border-radius:9px;padding:12px;background:#fff}
    .rep .kpi.g{border-top-color:#10b981}.rep .kpi.a{border-top-color:#f59e0b}.rep .kpi.r{border-top-color:#ef4444}.rep .kpi.b{border-top-color:${BRAND.v}}
    .rep .kpi .l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;font-weight:700}
    .rep .kpi .n{font-size:22px;font-weight:800;margin-top:6px}
    .rep .kpi .s{font-size:10px;color:#6b7280;margin-top:3px}
    .rep .sec{display:flex;align-items:center;gap:12px;margin:6px 0 14px}
    .rep .sec .no{font-size:11px;font-weight:800;color:${BRAND.v}}
    .rep .sec h2{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    .rep .sec .tag{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${BRAND.v};border:1px solid ${BRAND.v};border-radius:20px;padding:0 10px;height:18px;display:inline-flex;align-items:center;line-height:1}
    .rep .sec .ln{flex:1;height:1px;background:#e6e8ee}
    .rep .decs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rep .dec{border:1px solid #e6e8ee;border-top:3px solid ${BRAND.v};border-radius:10px;padding:12px 14px;display:flex;gap:11px}
    .rep .dec .num{flex:none;width:24px;height:24px;border-radius:50%;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center}
    .rep .dec .dt{font-size:12px;font-weight:700;margin-bottom:3px;line-height:1.3}
    .rep .dec .db{font-size:10.5px;color:#56606f;line-height:1.5}
    .rep .ropre{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .rep .col .ch{display:flex;align-items:center;gap:7px;color:#fff;padding:9px 10px;border-radius:8px 8px 0 0;font-weight:800}
    .rep .col .ch .big{font-size:16px}.rep .col .ch .lab{font-size:9px;letter-spacing:.1em;text-transform:uppercase}
    .rep .col .items{border:1px solid #e6e8ee;border-top:none;border-radius:0 0 8px 8px;padding:8px 9px;min-height:150px}
    .rep .col .it{font-size:10.5px;color:#3a4150;line-height:1.4;padding:7px 0;border-bottom:1px solid #f0f1f5}
    .rep .col .it:last-child{border-bottom:none}
    .rep .c1 .ch{background:${BRAND.v}}.rep .c2 .ch{background:#7c8aa0}.rep .c3 .ch{background:#b08948}.rep .c4 .ch{background:#ef4444}.rep .c5 .ch{background:#10b981}
    .rep .risks{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rep .risk{border:1px solid #e6e8ee;border-radius:10px;overflow:hidden}
    .rep .risk .rh{padding:9px 12px;color:#fff;font-size:11.5px;font-weight:700;display:flex;justify-content:space-between;gap:8px;align-items:center}
    .rep .risk.hi .rh{background:#9a2a2a}.rep .risk.md .rh{background:#9a6a2a}.rep .risk.lo .rh{background:#5a6a3a}
    .rep .risk .badge{font-size:8.5px;font-weight:800;background:rgba(255,255,255,.22);padding:2px 7px;border-radius:5px}
    .rep .risk .rb{padding:10px 12px;font-size:11px;color:#46505f;line-height:1.55}
    .rep .risk .mit{margin-top:6px;font-size:10.5px;color:#1f2430}.rep .risk .mit b{color:${BRAND.v}}
    .rep table{width:100%;border-collapse:collapse;font-size:11.5px}
    .rep thead th{text-align:left;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;padding:9px 10px;border-bottom:2px solid #e6e8ee;font-weight:700}
    .rep tbody td{padding:9px 10px;border-bottom:1px solid #f0f1f5;color:#3a4150}
    .rep tbody tr:nth-child(even){background:#fafbfc}
    .rep td.task{color:#1f2430;font-weight:600}
    .rep .dot{display:inline-block;width:9px;height:9px;border-radius:50%}
    .rep .dot.g{background:#10b981}.rep .dot.a{background:#f59e0b}.rep .dot.x{background:#c7ccd6}
    .rep .hitos{display:grid;grid-template-columns:repeat(${hitos.length},1fr);gap:8px}
    .rep .hito{border:1px solid #e6e8ee;border-top:3px solid ${BRAND.v};border-radius:9px;padding:11px 9px;text-align:center}
    .rep .hito .hd{font-size:11px;font-weight:800;color:${BRAND.v}}
    .rep .hito .ht{font-size:9.5px;color:#6b7280;margin-top:5px;line-height:1.4}
  `;

  const ropreCol = (cls: string, letter: string, lab: string, items: RopreItem[]) =>
    `<div class="col ${cls}"><div class="ch"><span class="big">${letter}</span><span class="lab">${lab}</span></div><div class="items">${
      items.length ? items.map((i) => `<div class="it">${esc(i.title)}</div>`).join('') : '<div class="it" style="color:#9aa3b2">—</div>'
    }</div></div>`;
  const riskCard = (r: RopreItem) => {
    const lvl = r.riskLevel === 'high' ? 'hi' : r.riskLevel === 'low' ? 'lo' : 'md';
    const badge = r.riskLevel === 'high' ? 'ALTO' : r.riskLevel === 'low' ? 'BAJO' : 'MEDIO';
    return `<div class="risk ${lvl}"><div class="rh">${esc(r.title)}<span class="badge">${badge}</span></div><div class="rb">${esc(r.description ?? '')}${r.mitigation ? `<div class="mit"><b>→</b> ${esc(r.mitigation)}</div>` : ''}</div></div>`;
  };
  let secN = 0;
  const sh = (title: string, tag?: string) =>
    `<div class="sec"><span class="no">0${++secN}</span><h2>${esc(title)}</h2>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="ln"></span></div>`;

  // ── Bloques (cada uno será capturado por separado) ──
  const blocks: string[] = [];

  // Bloque 0 — intro: chips + resumen + KPI destacado + cards
  blocks.push(
    `<div class="chips">${chips.map((c) => `<span class="chip ${c.cls}">${esc(c.txt)}</span>`).join('')}</div>` +
    `<p class="summary">${esc(ai.summary)}</p>` +
    (goals.revenue3m ? `<div class="featured"><div class="big"><div class="n">${money(goals.revenue3m)}</div><div class="l">Meta de ventas</div></div><div class="ctx"><div class="t">Objetivo del proyecto</div>${esc(goals.launchGoal ?? '')}</div></div>` : '') +
    `<div class="kpis">${kpis.map((k) => `<div class="kpi ${k.cls}"><div class="l">${esc(k.l)}</div><div class="n">${esc(k.n)}</div><div class="s">${esc(k.s)}</div></div>`).join('')}</div>`,
  );

  if (decisiones.length) {
    blocks.push(sh('Decisiones clave de la semana', `${decisiones.length} decisiones`) +
      `<div class="decs">${decisiones.map((d, i) => `<div class="dec" style="border-top-color:${PALETTE[i % PALETTE.length]}"><div class="num" style="background:${PALETTE[i % PALETTE.length]}">${i + 1}</div><div><div class="dt">${esc(d.t)}</div><div class="db">${esc(d.b)}</div></div></div>`).join('')}</div>`);
  }
  if (ropre.length) {
    blocks.push(sh('ROPRE de la semana', 'R·O·P·R·E') + `<div class="ropre">${
      ropreCol('c1', 'R', 'Resultado', byType('result')) + ropreCol('c2', 'O', 'Objetivos', byType('objective')) +
      ropreCol('c3', 'P', 'Premisas', byType('premise')) + ropreCol('c4', 'R', 'Riesgos', risks) +
      ropreCol('c5', 'E', 'Entregables', byType('deliverable'))
    }</div>`);
  }
  if (risks.length) {
    blocks.push(sh('Riesgos activos', `${risks.length} a vigilar`) + `<div class="risks">${risks.slice(0, 4).map(riskCard).join('')}</div>`);
  }
  blocks.push(sh('Plan de acción · esta semana', `${pending.length} tareas`) +
    `<table><thead><tr><th>Tarea</th><th>Responsable</th><th>Prioridad</th><th style="text-align:center">Estado</th></tr></thead><tbody>${
      pending.slice(0, 14).map((t) => `<tr><td class="task">${esc(t.title)}</td><td>${esc(resolveRoleLabel(t.assignedTo, client.id) ?? t.assignedTo)}</td><td>${esc(t.priority)}</td><td style="text-align:center"><span class="dot ${t.status === 'in_progress' ? 'a' : 'x'}"></span></td></tr>`).join('')
    }</tbody></table>`);
  if (hitos.length) {
    blocks.push(sh('Hitos clave') + `<div class="hitos">${hitos.map((h, i) => `<div class="hito" style="border-top-color:${PALETTE[i % PALETTE.length]}"><div class="hd">${esc(h.d)}</div><div class="ht">${esc(h.t)}</div></div>`).join('')}</div>`);
  }

  const weekLbl = `Semana del ${format(weekStart, 'd', { locale: es })}–${format(weekEnd, 'd MMM yyyy', { locale: es })}`;
  return {
    styles, blocks, accentClient,
    client: client.name, agency,
    titleLines: ['Reporte Ejecutivo', 'Semanal'],
    subtitle: `${funnel ? funnel.name + ' · ' : ''}${weekLbl}`,
    runningLabel: 'Reporte Ejecutivo',
    meta: [
      { k: 'Para', v: 'CEO · Confidencial' },
      { k: 'Fecha corte', v: format(today, 'd MMM yyyy', { locale: es }) },
      ...(eventDate ? [{ k: 'Evento', v: `${format(parseISO(eventDate), 'd MMM', { locale: es })} · ${daysToEvent}d` }] : []),
    ],
    footerLeft: `${client.name} · Reporte Ejecutivo · ${weekLbl}`,
    fileName: `Reporte_Ejecutivo_${client.name.replace(/\s+/g, '_')}_${format(today, 'yyyy-MM-dd')}.pdf`,
  };
}

/* ───────────────────────── REPORTE DE REUNIÓN ─────────────────────────
   Mismo diseño que el reporte semanal (header/footer/cover compartidos),
   con bloques específicos de la reunión: agenda, minuta, compromisos. */

export interface MeetingHtmlInput {
  client: Client;
  meeting: Meeting;
}

const MEETING_TYPE_LABEL: Record<string, string> = {
  kickoff: 'Kickoff',
  weekly_metrics: 'Revisión semanal',
  content_strategy: 'Estrategia de contenido',
  ads_review: 'Revisión de ADS',
  monthly_closing: 'Cierre mensual',
  crisis: 'Crisis',
  weekly_planning: 'Planeación semanal',
  ropre_strategy: 'Estrategia ROPRE',
  weekly_closing: 'Sprint de cierre de semana',
  general: 'Reunión general',
  management: 'Reunión de gerencia',
};

/** Estilos del informe de reunión — clases idénticas a las del semanal + .note. */
function meetingStyles(accentClient: string): string {
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    .rep{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;line-height:1.5;background:#fff;width:760px}
    .rep .body{width:760px}
    .rep .block{width:760px;padding-bottom:2px}
    .rep .chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
    .rep .chip{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:7px 12px;border-radius:7px;border-left:4px solid #6b7280;background:#f7f8fa;color:#334}
    .rep .chip.g{border-color:#10b981}.rep .chip.a{border-color:#f59e0b}.rep .chip.r{border-color:#ef4444}.rep .chip.b{border-color:${BRAND.v}}
    .rep .summary{font-size:13.5px;color:#3a4150;line-height:1.7;margin-bottom:18px}
    .rep .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
    .rep .kpi{border:1px solid #e6e8ee;border-top:3px solid ${BRAND.v};border-radius:9px;padding:12px;background:#fff}
    .rep .kpi.g{border-top-color:#10b981}.rep .kpi.a{border-top-color:#f59e0b}.rep .kpi.r{border-top-color:#ef4444}.rep .kpi.b{border-top-color:${BRAND.v}}
    .rep .kpi .l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;font-weight:700}
    .rep .kpi .n{font-size:20px;font-weight:800;margin-top:6px}
    .rep .kpi .s{font-size:10px;color:#6b7280;margin-top:3px}
    .rep .sec{display:flex;align-items:center;gap:12px;margin:6px 0 14px}
    .rep .sec .no{font-size:11px;font-weight:800;color:${BRAND.v}}
    .rep .sec h2{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    .rep .sec .tag{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${BRAND.v};border:1px solid ${BRAND.v};border-radius:20px;padding:0 10px;height:18px;display:inline-flex;align-items:center;line-height:1}
    .rep .sec .ln{flex:1;height:1px;background:#e6e8ee}
    .rep .note{border:1px solid #e6e8ee;border-left:4px solid ${accentClient};border-radius:10px;padding:14px 16px;font-size:12.5px;color:#3a4150;line-height:1.7;white-space:pre-wrap}
    .rep table{width:100%;border-collapse:collapse;font-size:11.5px}
    .rep thead th{text-align:left;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;padding:9px 10px;border-bottom:2px solid #e6e8ee;font-weight:700}
    .rep tbody td{padding:9px 10px;border-bottom:1px solid #f0f1f5;color:#3a4150}
    .rep tbody tr:nth-child(even){background:#fafbfc}
    .rep td.task{color:#1f2430;font-weight:600}
  `;
}

export async function exportMeetingReportHTML(input: MeetingHtmlInput): Promise<void> {
  const { client, meeting } = input;
  const accentClient = client.primaryColor || BRAND.v;
  const date = parseISO(meeting.scheduledAt);
  const typeLabel = MEETING_TYPE_LABEL[meeting.type] ?? meeting.type;
  const participants = meeting.participants.map((p) => p.name).filter(Boolean);
  const tasks = meeting.extractedTasks ?? [];
  const agency = ((client.onboardingData.team ?? {}) as { agency?: string }).agency ?? 'Project360';

  let secN = 0;
  const sh = (title: string, tag?: string) =>
    `<div class="sec"><span class="no">${secN < 9 ? '0' : ''}${++secN}</span><h2>${esc(title)}</h2>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="ln"></span></div>`;

  // ── Chips ──
  const chips: Array<{ cls: string; txt: string }> = [
    { cls: 'b', txt: typeLabel },
    { cls: meeting.completed ? 'g' : 'a', txt: meeting.completed ? 'Realizada' : 'Pendiente' },
    { cls: '', txt: `${meeting.durationMin} min` },
  ];
  if (participants.length) chips.push({ cls: '', txt: `${participants.length} participantes` });
  if (tasks.length) chips.push({ cls: 'b', txt: `${tasks.length} compromisos` });

  // ── KPIs ──
  const kpis = [
    { cls: 'b', l: 'Fecha', n: format(date, 'd MMM', { locale: es }), s: format(date, 'yyyy', { locale: es }) },
    { cls: '', l: 'Hora', n: format(date, 'HH:mm', { locale: es }), s: 'inicio' },
    { cls: '', l: 'Duración', n: `${meeting.durationMin}'`, s: 'minutos' },
    { cls: 'g', l: 'Participantes', n: String(participants.length || '—'), s: 'asistentes' },
    { cls: tasks.length ? 'b' : '', l: 'Compromisos', n: String(tasks.length), s: 'tareas' },
  ];

  // ── Bloques ──
  const blocks: string[] = [];

  blocks.push(
    `<div class="chips">${chips.map((c) => `<span class="chip ${c.cls}">${esc(c.txt)}</span>`).join('')}</div>` +
    (meeting.summary && meeting.summary.trim() ? `<p class="summary">${esc(meeting.summary.trim())}</p>` : '') +
    `<div class="kpis">${kpis.map((k) => `<div class="kpi ${k.cls}"><div class="l">${esc(k.l)}</div><div class="n">${esc(k.n)}</div><div class="s">${esc(k.s)}</div></div>`).join('')}</div>`,
  );

  if (meeting.agenda && meeting.agenda.trim()) {
    blocks.push(sh('Agenda') + `<div class="note">${esc(meeting.agenda.trim())}</div>`);
  }
  if (meeting.notes && meeting.notes.trim()) {
    blocks.push(sh('Minuta / Notas') + `<div class="note">${esc(meeting.notes.trim())}</div>`);
  }
  if (tasks.length) {
    blocks.push(sh('Compromisos y tareas', `${tasks.length} tareas`) +
      `<table><thead><tr><th>Tarea</th><th>Responsable</th><th style="text-align:center">Vence</th></tr></thead><tbody>${
        tasks.map((t) => `<tr><td class="task">${esc(t.title)}</td><td>${esc(resolveRoleLabel(t.responsibleRole, client.id) ?? t.responsibleRole)}</td><td style="text-align:center">${t.dueInDays != null ? `en ${esc(t.dueInDays)}d` : '—'}</td></tr>`).join('')
      }</tbody></table>`);
  }
  if (participants.length) {
    blocks.push(sh('Participantes') +
      `<div class="chips">${participants.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div>`);
  }
  // Si la reunión no tiene contenido aún, mostrar una nota en vez de páginas en blanco.
  if (!meeting.agenda?.trim() && !meeting.notes?.trim() && !tasks.length && !(meeting.summary && meeting.summary.trim())) {
    blocks.push(sh('Notas') + `<div class="note">Esta reunión aún no tiene agenda, minuta ni compromisos registrados.</div>`);
  }

  const dateLabel = format(date, "EEEE d 'de' MMMM yyyy", { locale: es });
  await renderReport({
    styles: meetingStyles(accentClient),
    blocks,
    accentClient,
    client: client.name,
    agency,
    titleLines: ['Reporte de', 'Reunión'],
    subtitle: meeting.title,
    runningLabel: 'Reporte de Reunión',
    meta: [
      { k: 'Tipo', v: typeLabel },
      { k: 'Fecha', v: format(date, 'd MMM yyyy', { locale: es }) },
      { k: 'Hora', v: format(date, 'HH:mm', { locale: es }) },
    ],
    footerLeft: `${client.name} · Reporte de Reunión · ${dateLabel}`,
    fileName: `Reporte_Reunion_${client.name.replace(/\s+/g, '_')}_${format(date, 'yyyy-MM-dd')}.pdf`,
  });
}
