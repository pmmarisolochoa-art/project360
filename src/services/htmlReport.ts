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
 * Reporte Ejecutivo Semanal en HTML → PDF (diseño aprobado, Sprint F).
 * Colores: identidad Project360 (violeta + dark) con firma de color por cliente.
 * Render: html2canvas + jsPDF, paginado A4. No bloquea por fallo de IA.
 */

export interface WeeklyHtmlInput {
  client: Client;
  tasks: Task[];
  meetings: Meeting[];
  ropreItems?: RopreItem[];
  funnel?: Funnel | null;
  phases?: FunnelPhase[];
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PLATFORM = { brand: '#6366F1', brand2: '#8B5CF6', brand3: '#06B6D4', ink: '#0a0a0f' };

export async function exportWeeklyReportHTML(input: WeeklyHtmlInput): Promise<void> {
  const html = await buildWeeklyReportHTML(input);

  // Contenedor off-screen con ancho ~A4 (794px ≈ 210mm @96dpi).
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
  holder.innerHTML = html;
  document.body.appendChild(holder);

  try {
    const target = holder.firstElementChild as HTMLElement;
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210;
    const pageH = 297;
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const data = canvas.toDataURL('image/png');

    let heightLeft = imgH;
    let position = 0;
    doc.addImage(data, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      doc.addPage();
      doc.addImage(data, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    const safe = input.client.name.replace(/\s+/g, '_');
    doc.save(`Reporte_Ejecutivo_${safe}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } finally {
    document.body.removeChild(holder);
  }
}

export async function buildWeeklyReportHTML(input: WeeklyHtmlInput): Promise<string> {
  const { client, tasks, meetings, funnel } = input;
  const ropre = input.ropreItems ?? [];
  const phases = input.phases ?? [];
  const accentClient = client.primaryColor || PLATFORM.brand;
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
  const fmtMoney = (n: number) => `$${new Intl.NumberFormat('en-US').format(Math.round(n))}`;

  // IA: resumen ejecutivo (no bloqueante).
  const ai = await generateWeeklyReport({
    clientName: client.name,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    tasksCompleted: completed.length,
    tasksPending: pending.length,
    compliancePct,
    daysToNextEvent: daysToEvent,
    pendingTasksSample: pending.slice(0, 10).map((t) => ({
      title: t.title, priority: t.priority,
      role: resolveRoleLabel(t.assignedTo, client.id) ?? t.assignedTo,
      dueInDays: differenceInCalendarDays(parseISO(t.dueDate), today),
    })),
  });

  const byType = (t: RopreItem['type']) => ropre.filter((i) => i.type === t);
  const risks = byType('risk');
  const deliverablesPending = byType('deliverable').filter((d) => d.status !== 'done').length;

  // ----- Chips -----
  const chips: Array<{ cls: string; txt: string }> = [];
  if (daysToEvent != null && eventDate) chips.push({ cls: 'b', txt: `Evento ${format(parseISO(eventDate), 'd MMM', { locale: es })} · ${daysToEvent} días` });
  chips.push({ cls: compliancePct >= 80 ? 'g' : compliancePct >= 50 ? 'a' : 'r', txt: `Cumplimiento: ${compliancePct}%` });
  if (goals.revenue3m) chips.push({ cls: 'b', txt: `Meta ventas: ${fmtMoney(goals.revenue3m)}` });
  chips.push({ cls: 'a', txt: `Tareas: ${completed.length} ✓ / ${totalActive}` });
  if (deliverablesPending) chips.push({ cls: 'b', txt: `${deliverablesPending} entregables pendientes` });
  if (risks.length) chips.push({ cls: 'r', txt: `${risks.length} riesgo${risks.length === 1 ? '' : 's'} activo${risks.length === 1 ? '' : 's'}` });

  // ----- KPI cards -----
  const kpis: Array<{ cls: string; l: string; n: string; s: string }> = [
    { cls: 'b', l: 'Días al evento', n: daysToEvent != null ? String(daysToEvent) : '—', s: eventDate ? format(parseISO(eventDate), 'd MMM yyyy', { locale: es }) : 'sin evento' },
    { cls: 'g', l: 'Tareas', n: `${completed.length}/${totalActive}`, s: `${inProgress} en curso` },
    { cls: compliancePct >= 80 ? 'g' : 'a', l: 'Cumplimiento', n: `${compliancePct}%`, s: 'a tiempo' },
    { cls: '', l: 'Ticket', n: biz.averageTicket ? fmtMoney(biz.averageTicket) : '—', s: biz.currency ?? 'USD' },
    { cls: risks.length ? 'r' : 'g', l: 'Riesgos', n: String(risks.length), s: 'a vigilar' },
  ];

  // ----- Decisiones (de reuniones recientes; si no hay, se omite) -----
  const recentMeetings = meetings
    .filter((m) => (m.summary && m.summary.trim()) || (m.extractedTasks && m.extractedTasks.length))
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
    .slice(0, 6);
  const decisiones: Array<{ t: string; b: string }> = recentMeetings.map((m) => ({
    t: m.title,
    b: (m.summary && m.summary.trim()) ? m.summary.trim().slice(0, 220) : `${m.extractedTasks?.length ?? 0} compromisos definidos`,
  }));

  // ----- Hitos (fases del embudo + evento) -----
  const start = funnel?.startDate ? parseISO(funnel.startDate) : today;
  const hitos: Array<{ d: string; t: string }> = [
    { d: 'HOY', t: format(today, "d MMM", { locale: es }) },
    ...phases.slice(0, 4).map((p) => ({
      d: format(addDays(start, p.dayStart), 'd MMM', { locale: es }),
      t: p.name.replace(/^FASE\s*\d+\s*[—-]\s*/i, ''),
    })),
  ];
  if (eventDate) hitos.push({ d: format(parseISO(eventDate), 'd MMM', { locale: es }), t: 'Evento principal' });

  const palette = [PLATFORM.brand, PLATFORM.brand2, PLATFORM.brand3, '#10b981', '#f59e0b', accentClient];

  // ===== HTML =====
  const styles = `
    *{box-sizing:border-box;margin:0;padding:0}
    .rep{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;line-height:1.5;background:#fff;width:794px}
    .rep .head{background:linear-gradient(105deg,#0a0a0f 0%,#141021 100%);color:#fff;padding:30px 38px 26px;display:flex;justify-content:space-between;gap:24px}
    .rep .eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#9aa3b2;font-weight:600}
    .rep .head h1{font-size:30px;font-weight:800;line-height:1.05;margin:6px 0 4px}
    .rep .head .sub{font-size:12px;color:#aeb6c4}
    .rep .head .meta{text-align:right;font-size:11px;min-width:150px}
    .rep .head .meta div{margin-bottom:8px}
    .rep .head .meta .k{color:#7e879a;letter-spacing:.16em;text-transform:uppercase;font-size:9px}
    .rep .head .meta .v{color:#fff;font-weight:600;font-size:12px}
    .rep .rule{height:4px;background:linear-gradient(90deg,${PLATFORM.brand},${PLATFORM.brand2},${PLATFORM.brand3})}
    .rep .body{padding:26px 38px 8px}
    .rep .chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
    .rep .chip{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:7px 12px;border-radius:7px;border-left:4px solid #6b7280;background:#f7f8fa;color:#334}
    .rep .chip.g{border-color:#10b981}.rep .chip.a{border-color:#f59e0b}.rep .chip.r{border-color:#ef4444}.rep .chip.b{border-color:${PLATFORM.brand}}
    .rep .summary{font-size:13.5px;color:#3a4150;line-height:1.7;margin-bottom:22px}
    .rep .featured{display:flex;border:1px solid ${accentClient};border-radius:12px;overflow:hidden;margin-bottom:14px}
    .rep .featured .big{background:linear-gradient(135deg,${accentClient},#0369a1);color:#fff;padding:18px 22px;min-width:190px}
    .rep .featured .big .n{font-size:30px;font-weight:800;line-height:1}
    .rep .featured .big .l{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.85;margin-top:6px}
    .rep .featured .ctx{padding:16px 20px;font-size:12px;color:#46505f}
    .rep .featured .ctx .t{font-weight:700;color:#1f2430;font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px}
    .rep .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:28px}
    .rep .kpi{border:1px solid #e6e8ee;border-top:3px solid ${PLATFORM.brand};border-radius:9px;padding:12px;background:#fff}
    .rep .kpi.g{border-top-color:#10b981}.rep .kpi.a{border-top-color:#f59e0b}.rep .kpi.r{border-top-color:#ef4444}.rep .kpi.b{border-top-color:${PLATFORM.brand}}
    .rep .kpi .l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;font-weight:700}
    .rep .kpi .n{font-size:22px;font-weight:800;margin-top:6px}
    .rep .kpi .s{font-size:10px;color:#6b7280;margin-top:3px}
    .rep .sec{display:flex;align-items:center;gap:12px;margin:26px 0 14px}
    .rep .sec .no{font-size:11px;font-weight:800;color:${PLATFORM.brand}}
    .rep .sec h2{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    .rep .sec .tag{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${PLATFORM.brand};border:1px solid ${PLATFORM.brand};border-radius:20px;padding:3px 9px}
    .rep .sec .ln{flex:1;height:1px;background:#e6e8ee}
    .rep .decs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rep .dec{border:1px solid #e6e8ee;border-top:3px solid ${PLATFORM.brand};border-radius:10px;padding:12px 14px;display:flex;gap:11px}
    .rep .dec .num{flex:none;width:24px;height:24px;border-radius:50%;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center}
    .rep .dec .dt{font-size:12px;font-weight:700;margin-bottom:3px;line-height:1.3}
    .rep .dec .db{font-size:10.5px;color:#56606f;line-height:1.5}
    .rep .ropre{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .rep .col .ch{display:flex;align-items:center;gap:7px;color:#fff;padding:9px 10px;border-radius:8px 8px 0 0;font-weight:800}
    .rep .col .ch .big{font-size:16px}.rep .col .ch .lab{font-size:9px;letter-spacing:.1em;text-transform:uppercase}
    .rep .col .items{border:1px solid #e6e8ee;border-top:none;border-radius:0 0 8px 8px;padding:8px 9px;min-height:150px}
    .rep .col .it{font-size:10.5px;color:#3a4150;line-height:1.4;padding:7px 0;border-bottom:1px solid #f0f1f5}
    .rep .col .it:last-child{border-bottom:none}
    .rep .c1 .ch{background:${PLATFORM.brand}}.rep .c2 .ch{background:#7c8aa0}.rep .c3 .ch{background:#b08948}.rep .c4 .ch{background:#ef4444}.rep .c5 .ch{background:#10b981}
    .rep .risks{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rep .risk{border:1px solid #e6e8ee;border-radius:10px;overflow:hidden}
    .rep .risk .rh{padding:9px 12px;color:#fff;font-size:11.5px;font-weight:700;display:flex;justify-content:space-between;gap:8px;align-items:center}
    .rep .risk.hi .rh{background:#9a2a2a}.rep .risk.md .rh{background:#9a6a2a}.rep .risk.lo .rh{background:#5a6a3a}
    .rep .risk .badge{font-size:8.5px;font-weight:800;background:rgba(255,255,255,.22);padding:2px 7px;border-radius:5px}
    .rep .risk .rb{padding:10px 12px;font-size:11px;color:#46505f;line-height:1.55}
    .rep .risk .mit{margin-top:6px;font-size:10.5px;color:#1f2430}.rep .risk .mit b{color:${PLATFORM.brand}}
    .rep table{width:100%;border-collapse:collapse;font-size:11.5px}
    .rep thead th{text-align:left;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;padding:9px 10px;border-bottom:2px solid #e6e8ee;font-weight:700}
    .rep tbody td{padding:9px 10px;border-bottom:1px solid #f0f1f5;color:#3a4150}
    .rep tbody tr:nth-child(even){background:#fafbfc}
    .rep td.task{color:#1f2430;font-weight:600}
    .rep .dot{display:inline-block;width:9px;height:9px;border-radius:50%}
    .rep .dot.g{background:#10b981}.rep .dot.a{background:#f59e0b}.rep .dot.x{background:#c7ccd6}
    .rep .hitos{display:grid;grid-template-columns:repeat(${hitos.length},1fr);gap:8px}
    .rep .hito{border:1px solid #e6e8ee;border-top:3px solid ${PLATFORM.brand};border-radius:9px;padding:11px 9px;text-align:center}
    .rep .hito .hd{font-size:11px;font-weight:800;color:${PLATFORM.brand}}
    .rep .hito .ht{font-size:9.5px;color:#6b7280;margin-top:5px;line-height:1.4}
    .rep .foot{background:${PLATFORM.ink};color:#8a93a4;font-size:10px;padding:13px 38px;display:flex;justify-content:space-between;margin-top:24px}
    .rep .foot .p360{background:linear-gradient(135deg,${PLATFORM.brand},${PLATFORM.brand3});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:800}
  `;

  const ropreCol = (cls: string, letter: string, lab: string, items: RopreItem[]) =>
    `<div class="col ${cls}"><div class="ch"><span class="big">${letter}</span><span class="lab">${lab}</span></div><div class="items">${
      items.length ? items.map((i) => `<div class="it">${esc(i.title)}</div>`).join('') : '<div class="it" style="color:#9aa3b2">—</div>'
    }</div></div>`;

  const riskCard = (r: RopreItem) => {
    const lvl = r.riskLevel === 'high' ? 'hi' : r.riskLevel === 'low' ? 'lo' : 'md';
    const badge = r.riskLevel === 'high' ? 'ALTO' : r.riskLevel === 'low' ? 'BAJO' : 'MEDIO';
    return `<div class="risk ${lvl}"><div class="rh">${esc(r.title)}<span class="badge">${badge}</span></div><div class="rb">${esc(r.description ?? '')}${
      r.mitigation ? `<div class="mit"><b>→</b> ${esc(r.mitigation)}</div>` : ''
    }</div></div>`;
  };

  let sec = 0;
  const secHeader = (title: string, tag?: string) =>
    `<div class="sec"><span class="no">0${++sec}</span><h2>${esc(title)}</h2>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="ln"></span></div>`;

  return `<div class="rep"><style>${styles}</style>
    <div class="head">
      <div>
        <div class="eyebrow">${esc(client.name)} · ${esc(agency)}</div>
        <h1>Reporte Ejecutivo Semanal</h1>
        <div class="sub">${funnel ? esc(funnel.name) + ' · ' : ''}Semana del ${format(weekStart, 'd', { locale: es })}–${format(weekEnd, "d MMM yyyy", { locale: es })}</div>
      </div>
      <div class="meta">
        <div><div class="k">Para</div><div class="v">CEO · Confidencial</div></div>
        <div><div class="k">Fecha corte</div><div class="v">${format(today, 'd MMM yyyy', { locale: es })}</div></div>
        ${eventDate ? `<div><div class="k">Evento</div><div class="v">${format(parseISO(eventDate), 'd MMM', { locale: es })} · ${daysToEvent}d</div></div>` : ''}
      </div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <div class="chips">${chips.map((c) => `<span class="chip ${c.cls}">${esc(c.txt)}</span>`).join('')}</div>
      <p class="summary">${esc(ai.summary)}</p>
      ${goals.revenue3m ? `<div class="featured"><div class="big"><div class="n">${fmtMoney(goals.revenue3m)}</div><div class="l">Meta de ventas</div></div><div class="ctx"><div class="t">Objetivo del proyecto</div>${esc(goals.launchGoal ?? `Ticket ${biz.averageTicket ? fmtMoney(biz.averageTicket) : ''} · ${eventDate ? 'evento ' + format(parseISO(eventDate), 'd MMM', { locale: es }) : ''}`)}</div></div>` : ''}
      <div class="kpis">${kpis.map((k) => `<div class="kpi ${k.cls}"><div class="l">${esc(k.l)}</div><div class="n">${esc(k.n)}</div><div class="s">${esc(k.s)}</div></div>`).join('')}</div>

      ${decisiones.length ? secHeader('Decisiones clave de la semana', `${decisiones.length} decisiones`) + `<div class="decs">${decisiones.map((d, i) => `<div class="dec" style="border-top-color:${palette[i % palette.length]}"><div class="num" style="background:${palette[i % palette.length]}">${i + 1}</div><div><div class="dt">${esc(d.t)}</div><div class="db">${esc(d.b)}</div></div></div>`).join('')}</div>` : ''}

      ${ropre.length ? secHeader('ROPRE de la semana', 'R·O·P·R·E') + `<div class="ropre">${
        ropreCol('c1', 'R', 'Resultado', byType('result')) +
        ropreCol('c2', 'O', 'Objetivos', byType('objective')) +
        ropreCol('c3', 'P', 'Premisas', byType('premise')) +
        ropreCol('c4', 'R', 'Riesgos', risks) +
        ropreCol('c5', 'E', 'Entregables', byType('deliverable'))
      }</div>` : ''}

      ${risks.length ? secHeader('Riesgos activos', `${risks.length} a vigilar`) + `<div class="risks">${risks.slice(0, 4).map(riskCard).join('')}</div>` : ''}

      ${secHeader('Plan de acción · esta semana', `${pending.length} tareas`)}
      <table><thead><tr><th>Tarea</th><th>Responsable</th><th>Prioridad</th><th style="text-align:center">Estado</th></tr></thead><tbody>${
        pending.slice(0, 12).map((t) => {
          const dot = t.status === 'in_progress' ? 'a' : 'x';
          return `<tr><td class="task">${esc(t.title)}</td><td>${esc(resolveRoleLabel(t.assignedTo, client.id) ?? t.assignedTo)}</td><td>${esc(t.priority)}</td><td style="text-align:center"><span class="dot ${dot}"></span></td></tr>`;
        }).join('')
      }</tbody></table>

      ${hitos.length ? secHeader('Hitos clave') + `<div class="hitos">${hitos.map((h, i) => `<div class="hito" style="border-top-color:${palette[i % palette.length]}"><div class="hd">${esc(h.d)}</div><div class="ht">${esc(h.t)}</div></div>`).join('')}</div>` : ''}

      <div style="margin-bottom:4px"></div>
    </div>
    <div class="foot"><span>${esc(client.name)} · Reporte Ejecutivo · Semana del ${format(weekStart, 'd', { locale: es })}–${format(weekEnd, 'd MMM', { locale: es })}</span><span><b class="p360">Project360</b> · Confidencial · No distribuir</span></div>
  </div>`;
}
