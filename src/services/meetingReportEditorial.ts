import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import { generateMeetingReport, type MeetingReportData } from '@/services/claudeApi';
import { resolveRoleLabel } from '@/utils/roleResolver';

/**
 * Reporte ejecutivo de reunión con estética EDITORIAL (referencia: reporte de
 * seguimiento tipo revista — papel, serif Playfair, KPIs, secciones con regla).
 *
 * A diferencia del reporte "estándar" (motor por bloques en htmlReport.ts),
 * este arma UN documento editorial completo, lo rasteriza con html2canvas y lo
 * corta en páginas A4 → PDF. Así conserva el look de revista (fondos de color,
 * tarjetas) que el motor por bloques no permite.
 *
 * Dos entradas:
 *  - buildMeetingReportPdf(): genera el PDF y devuelve blob + base64 (para
 *    adjuntarlo en un correo desde el backend).
 *  - downloadMeetingReportPdf(): lo genera y lo descarga (botón manual).
 *
 * El análisis (resumen, decisiones, riesgos, próximos pasos) lo redacta la IA
 * como PM experto; los compromisos vienen de las tareas ya extraídas.
 */

export interface Commitment { title: string; responsible: string; dueInDays: number }

const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Barlow+Condensed:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&family=Barlow:wght@300;400;500;600&display=swap';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Aclara/oscurece un hex mezclándolo con blanco (t=0..1 hacia blanco). */
function tint(hex: string, t: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

const TONE_COLORS: Record<string, { fg: string; bg: string; bd: string }> = {
  g: { fg: '#0a6b46', bg: '#e8f5ef', bd: '#90c9b0' },
  r: { fg: '#9b1a1a', bg: '#fdf0ee', bd: '#e8a0a0' },
  a: { fg: '#8b5e00', bg: '#fdf4e2', bd: '#e0bf70' },
  b: { fg: '#1a3f7a', bg: '#eef2fd', bd: '#90a8e0' },
  '': { fg: '#111318', bg: '#ede9e0', bd: '#c8c2b5' },
};

const RISK_LABEL: Record<string, { txt: string; tone: 'r' | 'a' | 'b' }> = {
  high: { txt: 'Alto', tone: 'r' },
  medium: { txt: 'Medio', tone: 'a' },
  low: { txt: 'Bajo', tone: 'b' },
};

/** Construye el HTML editorial completo del reporte. */
function buildEditorialHtml(args: {
  client: Client;
  meeting: Meeting;
  report: MeetingReportData;
  commitments: Commitment[];
  agency: string;
}): string {
  const { client, meeting, report, commitments, agency } = args;
  const accent = client.primaryColor || '#4a2080';
  const date = parseISO(meeting.scheduledAt);
  const dateLabel = format(date, "d 'de' MMMM yyyy", { locale: es }).toUpperCase();
  const initials = client.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const slabel = (t: string) =>
    `<div class="slabel"><span class="slabel-t">${esc(t)}</span><span class="slabel-l"></span></div>`;

  // ── KPIs ──
  const kpisHtml = report.kpis.length
    ? `<div class="kpis">${report.kpis.map((k) => {
        const c = TONE_COLORS[k.tone] ?? TONE_COLORS[''];
        return `<div class="kpi" style="border-left-color:${c.bd}">
          <div class="kpi-n" style="color:${c.fg}">${esc(k.value)}</div>
          <div class="kpi-l">${esc(k.label)}</div>
          ${k.sub ? `<div class="kpi-sub">${esc(k.sub)}</div>` : ''}
        </div>`;
      }).join('')}</div>`
    : '';

  // ── Decisiones ──
  const decisionsHtml = report.decisions.length
    ? slabel('Decisiones tomadas') +
      `<ul class="declist">${report.decisions.map((d) => `<li><span class="tick" style="color:${accent}">◆</span>${esc(d)}</li>`).join('')}</ul>`
    : '';

  // ── Compromisos / tareas ──
  const commitmentsHtml = commitments.length
    ? slabel(`Compromisos y responsables · ${commitments.length}`) +
      `<table class="tbl"><thead><tr><th>Tarea</th><th>Responsable</th><th class="c">Entrega</th></tr></thead><tbody>${
        commitments.map((c) => `<tr>
          <td class="t">${esc(c.title)}</td>
          <td class="who">${esc(c.responsible)}</td>
          <td class="c"><span class="due">en ${esc(c.dueInDays)}d</span></td>
        </tr>`).join('')
      }</tbody></table>`
    : '';

  // ── Riesgos ──
  const risksHtml = report.risks.length
    ? slabel('Riesgos y bloqueos') +
      `<div class="risks">${report.risks.map((r) => {
        const meta = RISK_LABEL[r.level] ?? RISK_LABEL.medium;
        const c = TONE_COLORS[meta.tone];
        return `<div class="risk" style="background:${c.bg};border-color:${c.bd}">
          <div class="risk-h"><span class="risk-t" style="color:${c.fg}">${esc(r.title)}</span><span class="risk-b" style="color:${c.fg};border-color:${c.bd}">${meta.txt}</span></div>
          ${r.detail ? `<div class="risk-d">${esc(r.detail)}</div>` : ''}
        </div>`;
      }).join('')}</div>`
    : '';

  // ── Próximos pasos ──
  const nextHtml = report.nextSteps.length
    ? slabel('Próximos pasos') +
      `<ol class="nextlist">${report.nextSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
    : '';

  // ── Próxima reunión ──
  const nextMeetingHtml = report.nextMeetingFocus
    ? `<div class="nextmeet"><div class="nextmeet-l">Foco de la próxima reunión</div><div class="nextmeet-t">${esc(report.nextMeetingFocus)}</div></div>`
    : '';

  return `<div class="rep-ed" style="--accent:${accent};--accent-soft:${tint(accent, 0.86)};--accent-line:${tint(accent, 0.55)}">
    <div class="topbar">
      <div class="tb-left">
        <span class="logo"><span class="logo-dot"></span>${esc(agency)}<span class="logo-sep">/</span>${esc(initials)}</span>
        <span class="logo-date">REPORTE DE REUNIÓN · ${esc(dateLabel)}</span>
      </div>
      <span class="tb-badge">${esc(meeting.completed ? 'REALIZADA' : 'BORRADOR')}</span>
    </div>

    <div class="hero">
      <div class="eyebrow">${esc(client.name)} · ${esc(client.industry || 'Proyecto')}</div>
      <h1 class="title">${esc(report.headline || meeting.title)}</h1>
      <div class="deck">${esc(report.deck)}</div>
      <div class="metarow">
        <span><b>Reunión:</b> ${esc(meeting.title)}</span>
        <span><b>Fecha:</b> ${esc(format(date, "EEEE d 'de' MMMM, HH:mm", { locale: es }))}</span>
        <span><b>Duración:</b> ${esc(meeting.durationMin)} min</span>
      </div>
    </div>

    ${kpisHtml}
    ${decisionsHtml}
    ${commitmentsHtml}
    ${risksHtml}
    ${nextHtml}
    ${nextMeetingHtml}

    <div class="foot">${esc(agency)} · Project360 — Reporte generado como PM experto · ${esc(dateLabel)}</div>
  </div>`;
}

const EDITORIAL_CSS = `
.rep-ed *{box-sizing:border-box;margin:0;padding:0;}
.rep-ed{
  width:794px;background:#f5f2ec;color:#111318;
  font-family:'Barlow',-apple-system,Segoe UI,sans-serif;
  font-size:13.5px;line-height:1.55;padding:0 0 44px;
}
.rep-ed .topbar{
  height:46px;background:#111318;display:flex;align-items:center;justify-content:space-between;
  padding:0 26px;border-bottom:3px solid var(--accent);
}
.rep-ed .logo{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#fff;display:flex;align-items:center;gap:9px;}
.rep-ed .logo-dot{width:7px;height:7px;border-radius:50%;background:var(--accent-line);}
.rep-ed .logo-sep{color:rgba(255,255,255,.25);}
.rep-ed .tb-left{display:flex;align-items:center;gap:16px;}
.rep-ed .logo-date{font-family:'DM Mono',monospace;font-size:9.5px;color:rgba(255,255,255,.5);letter-spacing:.05em;}
.rep-ed .tb-badge{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:3px;padding:3px 9px;}

.rep-ed .hero{padding:34px 40px 26px;}
.rep-ed .eyebrow{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:12px;}
.rep-ed .title{font-family:'Playfair Display',serif;font-weight:900;font-size:40px;line-height:1.05;letter-spacing:-.01em;color:#111318;margin-bottom:14px;}
.rep-ed .deck{font-size:16px;line-height:1.55;color:#3a3630;max-width:640px;font-weight:400;}
.rep-ed .metarow{display:flex;flex-wrap:wrap;gap:20px;margin-top:18px;padding-top:14px;border-top:1px solid #c8c2b5;font-family:'DM Mono',monospace;font-size:10.5px;color:#5a5650;}
.rep-ed .metarow b{color:#111318;font-weight:500;}

.rep-ed .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:0 40px 8px;}
.rep-ed .kpi{background:#fff;border:1px solid #e3dfd4;border-left:4px solid;border-radius:4px;padding:14px 16px;}
.rep-ed .kpi-n{font-family:'Playfair Display',serif;font-weight:900;font-size:28px;line-height:1;margin-bottom:6px;}
.rep-ed .kpi-l{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5a5650;}
.rep-ed .kpi-sub{font-size:11.5px;color:#9a9590;margin-top:4px;line-height:1.4;}

.rep-ed .slabel{display:flex;align-items:center;gap:14px;padding:26px 40px 12px;}
.rep-ed .slabel-t{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#111318;white-space:nowrap;}
.rep-ed .slabel-l{flex:1;height:1px;background:var(--accent-line);}

.rep-ed .declist{list-style:none;padding:0 40px;}
.rep-ed .declist li{display:flex;gap:11px;align-items:flex-start;padding:9px 0;border-bottom:1px solid #e3dfd4;font-size:14px;color:#2a2620;line-height:1.5;}
.rep-ed .declist li:last-child{border-bottom:none;}
.rep-ed .tick{font-size:11px;margin-top:3px;}

.rep-ed .tbl{width:calc(100% - 80px);margin:0 40px;border-collapse:collapse;background:#fff;border:1px solid #e3dfd4;border-radius:4px;overflow:hidden;}
.rep-ed .tbl thead th{background:#ede9e0;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5a5650;text-align:left;padding:9px 14px;border-bottom:1px solid #c8c2b5;}
.rep-ed .tbl th.c,.rep-ed .tbl td.c{text-align:center;}
.rep-ed .tbl td{padding:10px 14px;border-bottom:1px solid #ede9e0;font-size:13.5px;vertical-align:top;}
.rep-ed .tbl tr:last-child td{border-bottom:none;}
.rep-ed .tbl td.t{color:#111318;font-weight:500;}
.rep-ed .tbl td.who{color:#5a5650;white-space:nowrap;}
.rep-ed .due{font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);background:var(--accent-soft);padding:2px 8px;border-radius:3px;white-space:nowrap;}

.rep-ed .risks{display:flex;flex-direction:column;gap:10px;padding:0 40px;}
.rep-ed .risk{border:1px solid;border-radius:4px;padding:12px 15px;}
.rep-ed .risk-h{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.rep-ed .risk-t{font-weight:700;font-size:14px;}
.rep-ed .risk-b{font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid;border-radius:3px;padding:2px 8px;white-space:nowrap;}
.rep-ed .risk-d{font-size:12.5px;color:#5a5650;margin-top:6px;line-height:1.45;}

.rep-ed .nextlist{padding:0 40px 0 62px;}
.rep-ed .nextlist li{padding:7px 0;font-size:14px;color:#2a2620;line-height:1.5;}
.rep-ed .nextlist li::marker{font-family:'DM Mono',monospace;color:var(--accent);font-weight:500;}

.rep-ed .nextmeet{margin:24px 40px 0;background:#111318;border-radius:6px;padding:18px 22px;}
.rep-ed .nextmeet-l{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-line);margin-bottom:6px;}
.rep-ed .nextmeet-t{font-family:'Playfair Display',serif;font-style:italic;font-size:18px;color:#f5f2ec;line-height:1.4;}

.rep-ed .foot{margin-top:30px;padding:14px 40px 0;border-top:1px solid #c8c2b5;font-family:'DM Mono',monospace;font-size:9.5px;color:#9a9590;letter-spacing:.04em;}
`;

/** Asegura que las fuentes de Google estén cargadas antes de rasterizar. */
async function ensureFonts(): Promise<void> {
  if (!document.querySelector(`link[href="${FONT_LINK}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_LINK;
    document.head.appendChild(link);
  }
  try {
    // Espera a que el navegador reporte las fuentes listas (con tope de 3s).
    await Promise.race([
      (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch { /* seguimos con fallback de fuentes del sistema */ }
}

export interface BuildReportResult {
  blob: Blob;
  base64: string;      // sin el prefijo data:
  fileName: string;
}

/** Genera el PDF editorial y lo devuelve como blob + base64 (para adjuntar). */
export async function buildMeetingReportPdf(args: {
  client: Client;
  meeting: Meeting;
  report: MeetingReportData;
  commitments: Commitment[];
  agency: string;
}): Promise<BuildReportResult> {
  await ensureFonts();

  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#f5f2ec;';
  holder.innerHTML = `<style>${EDITORIAL_CSS}</style>${buildEditorialHtml(args)}`;
  document.body.appendChild(holder);

  try {
    const node = holder.querySelector('.rep-ed') as HTMLElement;
    const SCALE = 2;
    const canvas = await html2canvas(node, {
      scale: SCALE,
      backgroundColor: '#f5f2ec',
      useCORS: true,
      logging: false,
      windowWidth: 794,
    });

    // A4 en px @96dpi = 794 × 1123. Cortamos el canvas alto en páginas.
    const PAGE_W = 794, PAGE_H = 1123;
    const pageCanvasH = PAGE_H * SCALE;
    const pdf = new jsPDF({ unit: 'px', format: [PAGE_W, PAGE_H], orientation: 'portrait' });

    let rendered = 0;
    let pageIdx = 0;
    while (rendered < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - rendered);
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = sliceH;
      const ctx = tmp.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f5f2ec';
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      }
      const data = tmp.toDataURL('image/jpeg', 0.92);
      if (pageIdx > 0) pdf.addPage([PAGE_W, PAGE_H], 'portrait');
      pdf.addImage(data, 'JPEG', 0, 0, PAGE_W, sliceH / SCALE);
      rendered += sliceH;
      pageIdx++;
    }

    const blob = pdf.output('blob');
    const dataUri = pdf.output('datauristring');
    const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
    const fileName = `Reporte_Reunion_${args.client.name.replace(/\s+/g, '_')}_${format(parseISO(args.meeting.scheduledAt), 'yyyy-MM-dd')}.pdf`;
    return { blob, base64, fileName };
  } finally {
    document.body.removeChild(holder);
  }
}

/** Helper de conveniencia: sintetiza con IA + arma commitments desde extractedTasks. */
export async function buildReportFromMeeting(client: Client, meeting: Meeting, commitmentsOverride?: Commitment[]): Promise<BuildReportResult> {
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

  return buildMeetingReportPdf({ client, meeting, report, commitments, agency });
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
