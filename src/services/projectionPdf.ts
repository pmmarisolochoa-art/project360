import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Client } from '@/types/client';
import type { ProjectionState } from '@/types/projection';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateFunnel } from '@/store/useProjectionStore';
import { getBenchmark } from '@/services/benchmarks';

/**
 * Exporta a PDF el módulo de Proyección con contenido textual real
 * (no captures de pantalla). Tablas via jspdf-autotable.
 */
export async function exportProjectionToPdf(args: {
  client: Client;
  state: ProjectionState;
}): Promise<void> {
  const { client, state } = args;
  const doc = newPdf();
  drawCover(doc, client, 'Proyección Estratégica');
  drawProjectionContent(doc, client, state);
  attachFooters(doc, client);
  const filename = `Proyeccion_${slug(client.name)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}

/**
 * Exporta sólo el Debriefing como documento textual.
 */
export async function exportDebriefingToPdf(args: {
  client: Client;
  state: ProjectionState;
}): Promise<void> {
  const { client, state } = args;
  const doc = newPdf();
  drawCover(doc, client, 'Debriefing del Proyecto');
  drawDebriefingContent(doc, client, state);
  attachFooters(doc, client);
  const filename = `Debriefing_${slug(client.name)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}

/* ─────────────── Helpers de layout ─────────────── */

interface PdfCtx {
  doc: jsPDF;
  margin: number;
  pageW: number;
  pageH: number;
  y: number;
  accent: [number, number, number];
}

function newPdf(): jsPDF {
  return new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
}

function ctxFor(doc: jsPDF, accent: string): PdfCtx {
  return {
    doc,
    margin: 18,
    pageW: doc.internal.pageSize.getWidth(),
    pageH: doc.internal.pageSize.getHeight(),
    y: 30,
    accent: hexToRgb(accent),
  };
}

function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y + needed > ctx.pageH - 22) {
    ctx.doc.addPage();
    ctx.y = 30;
  }
}

function h2(ctx: PdfCtx, text: string) {
  ensureSpace(ctx, 16);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(14);
  ctx.doc.setTextColor(...ctx.accent);
  ctx.doc.text(text, ctx.margin, ctx.y);
  // Subrayado acento
  ctx.doc.setDrawColor(...ctx.accent);
  ctx.doc.setLineWidth(0.6);
  ctx.doc.line(ctx.margin, ctx.y + 2, ctx.margin + 30, ctx.y + 2);
  ctx.y += 9;
}

function h3(ctx: PdfCtx, text: string) {
  ensureSpace(ctx, 12);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.setTextColor(40, 40, 50);
  ctx.doc.text(text, ctx.margin, ctx.y);
  ctx.y += 6;
}

function body(ctx: PdfCtx, text: string, opts: { mute?: boolean; italic?: boolean } = {}) {
  if (!text || !text.trim()) return;
  ctx.doc.setFont('helvetica', opts.italic ? 'italic' : 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(opts.mute ? 110 : 35, opts.mute ? 110 : 35, opts.mute ? 120 : 45);
  const lines = ctx.doc.splitTextToSize(text, ctx.pageW - ctx.margin * 2);
  for (const ln of lines) {
    ensureSpace(ctx, 5);
    ctx.doc.text(ln, ctx.margin, ctx.y);
    ctx.y += 4.8;
  }
  ctx.y += 1.5;
}

function bullet(ctx: PdfCtx, text: string) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(35, 35, 45);
  const wrapW = ctx.pageW - ctx.margin * 2 - 6;
  const lines = ctx.doc.splitTextToSize(text, wrapW);
  ensureSpace(ctx, lines.length * 5);
  ctx.doc.setTextColor(...ctx.accent);
  ctx.doc.text('•', ctx.margin, ctx.y);
  ctx.doc.setTextColor(35, 35, 45);
  for (let i = 0; i < lines.length; i++) {
    ctx.doc.text(lines[i], ctx.margin + 5, ctx.y);
    ctx.y += 4.8;
  }
  ctx.y += 0.5;
}

function spacer(ctx: PdfCtx, mm = 4) { ctx.y += mm; }

function table(ctx: PdfCtx, head: string[][], bodyRows: (string | number)[][]) {
  autoTable(ctx.doc, {
    head,
    body: bodyRows,
    startY: ctx.y,
    margin: { left: ctx.margin, right: ctx.margin },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, textColor: [40, 40, 50] },
    headStyles: { fillColor: ctx.accent, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    theme: 'grid',
  });
  // @ts-expect-error — jsPDF guarda lastAutoTable
  ctx.y = (ctx.doc.lastAutoTable.finalY ?? ctx.y) + 6;
}

/* ─────────────── Portada y footer ─────────────── */

function drawCover(doc: jsPDF, client: Client, subtitle: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const [r, g, b] = hexToRgb(client.primaryColor);

  // Banda lateral del accent
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 8, pageH, 'F');

  // Marca SALES BRAIN OS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 140);
  doc.text('SALES BRAIN OS', 22, 28);

  // Nombre cliente (H1 grande)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(20, 20, 30);
  doc.text(client.name, 22, 80);

  // Subtítulo en accent
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(r, g, b);
  doc.text(subtitle, 22, 92);

  // Mes Año
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 120);
  const monthYear = format(new Date(), "MMMM yyyy", { locale: es });
  doc.text(monthYear.charAt(0).toUpperCase() + monthYear.slice(1), 22, 102);

  // Bloque info
  const infoY = 140;
  doc.setDrawColor(220, 222, 230);
  doc.setLineWidth(0.3);
  doc.line(22, infoY, pageW - 22, infoY);
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 100);
  doc.text(`Industria: ${client.industry}`, 22, infoY + 8);
  doc.text(`Tipo de proyecto: ${client.businessType}`, 22, infoY + 16);
  doc.text(`Estado: ${client.status}`, 22, infoY + 24);

  // Rectángulo decorativo del accent
  doc.setFillColor(r, g, b);
  doc.rect(22, pageH - 64, pageW - 44, 1.5, 'F');

  // Confidencial
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 160);
  doc.text('Confidencial — Solo para uso interno', 22, pageH - 18);
}

function attachFooters(doc: jsPDF, client: Client) {
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220, 222, 230);
    doc.setLineWidth(0.2);
    doc.line(18, pageH - 14, pageW - 18, pageH - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 145);
    doc.text(client.name, 18, pageH - 8);
    doc.text('Confidencial', pageW / 2, pageH - 8, { align: 'center' });
    doc.text(`p. ${i}`, pageW - 18, pageH - 8, { align: 'right' });
  }
}

/* ─────────────── Contenido Proyección ─────────────── */

function drawProjectionContent(doc: jsPDF, client: Client, state: ProjectionState) {
  doc.addPage();
  const ctx = ctxFor(doc, client.primaryColor);

  const goals = client.onboardingData.goals as { revenue3m?: number; revenue6m?: number; revenue12m?: number } | undefined;
  const outputs = calculateFunnel(state.funnel);
  const bench = getBenchmark(client.industry);

  // A — Resumen ejecutivo
  h2(ctx, 'A · Resumen ejecutivo');
  body(ctx, `Cliente: ${client.name}. Industria: ${client.industry}. Tipo de negocio: ${client.businessType}.`);
  body(ctx, `Duración del proyecto: ${state.durationMonths} meses.`);
  table(ctx, [['Plazo', 'Meta de facturación']],
    [
      ['3 meses', goals?.revenue3m ? `$${goals.revenue3m.toLocaleString()}` : '—'],
      ['6 meses', goals?.revenue6m ? `$${goals.revenue6m.toLocaleString()}` : '—'],
      ['12 meses', goals?.revenue12m ? `$${goals.revenue12m.toLocaleString()}` : '—'],
    ],
  );

  // B — Funnel financiero
  h2(ctx, 'B · Funnel financiero (proyección realista)');
  table(ctx, [['Variable', 'Valor']], [
    ['Inversión mensual en ADS', `$${state.funnel.monthlyAdsBudget.toLocaleString()}`],
    ['Alcance estimado', state.funnel.estimatedReach.toLocaleString()],
    ['CTR esperado', `${(state.funnel.ctr * 100).toFixed(2)}%`],
    ['Clics estimados', outputs.clicks.toLocaleString()],
    ['Conversión landing', `${(state.funnel.landingConversionRate * 100).toFixed(2)}%`],
    ['Leads estimados', `${outputs.leads.toLocaleString()} /mes`],
    ['Tasa SQL', `${(state.funnel.sqlRate * 100).toFixed(0)}%`],
    ['SQLs/mes', outputs.sqls.toLocaleString()],
    ['Tasa cierre', `${(state.funnel.closeRate * 100).toFixed(0)}%`],
    ['Ventas/mes', outputs.sales.toLocaleString()],
    ['Ticket promedio', `$${state.funnel.averageTicket.toLocaleString()}`],
    ['Facturación proyectada', `$${outputs.revenue.toLocaleString()}`],
    ['ROAS', `${outputs.roas}x`],
    ['CPL', `$${outputs.cpl}`],
    ['Costo por venta', `$${outputs.costPerSale}`],
  ]);

  // C — Fases
  h2(ctx, 'C · Tiempos de ejecución por fases');
  table(ctx,
    [['Fase', 'Sem inicio', 'Sem fin', 'Estado', '% Avance', 'Tareas']],
    state.phases.map((p) => [p.name, p.startWeek, p.endWeek, p.status, `${p.progress}%`, p.tasks.length]),
  );

  // D — Vs Mercado
  h2(ctx, 'D · Benchmarks vs proyección');
  table(ctx,
    [['Métrica', `Benchmark ${client.industry}`, 'Tu proyección', 'Estado']],
    [
      ['CTR Meta Ads', `${bench.ctrMeta}%`, `${(state.funnel.ctr * 100).toFixed(2)}%`, state.funnel.ctr * 100 >= bench.ctrMeta ? 'Sobre' : 'Bajo'],
      ['CTR Google Ads', `${bench.ctrGoogle}%`, `${(state.funnel.ctr * 100).toFixed(2)}%`, state.funnel.ctr * 100 >= bench.ctrGoogle ? 'Sobre' : 'Bajo'],
      ['Conversión landing', `${bench.landingConv}%`, `${(state.funnel.landingConversionRate * 100).toFixed(2)}%`, state.funnel.landingConversionRate * 100 >= bench.landingConv ? 'Sobre' : 'Bajo'],
      ['CPL', `$${bench.avgCpl}`, `$${outputs.cpl}`, outputs.cpl <= bench.avgCpl ? 'Sobre' : 'Bajo'],
      ['ROAS', `${bench.avgRoas}x`, `${outputs.roas}x`, outputs.roas >= bench.avgRoas ? 'Sobre' : 'Bajo'],
      ['Tasa cierre', `${bench.closeRate}%`, `${(state.funnel.closeRate * 100).toFixed(0)}%`, state.funnel.closeRate * 100 >= bench.closeRate ? 'Sobre' : 'Bajo'],
    ],
  );
  body(ctx, `Tamaño de mercado: TAM ${state.market.tam.toLocaleString()} · SAM ${state.market.sam.toLocaleString()} · SOM ${state.market.somPercent}% del SAM.`);

  // E — OKRs
  h2(ctx, 'E · Objetivos / OKRs');
  for (const okr of state.okrs) {
    h3(ctx, `O · ${okr.objective}`);
    body(ctx, `Deadline: ${okr.deadline} · Responsable: ${okr.responsible}`, { mute: true });
    table(ctx,
      [['Key Result', 'Inicial', 'Actual', 'Meta', 'Unidad']],
      okr.keyResults.map((k) => [k.description, k.initialValue, k.currentValue, k.targetValue, k.unit]),
    );
  }
  if (state.successIndicators.some(Boolean)) {
    h3(ctx, 'Indicadores de éxito');
    state.successIndicators.filter(Boolean).forEach((i) => bullet(ctx, i));
  }

  // F — Inversión
  h2(ctx, 'F · Inversión prevista');
  const totalMonthly = state.investment.reduce((s, l) => s + l.monthly, 0);
  const totalProject = state.investment.reduce((s, l) => s + l.monthly * (l.onlyMonths?.length ?? state.durationMonths), 0);
  const totalRevenue = outputs.revenue * state.durationMonths;
  const roi = totalProject > 0 ? totalRevenue / totalProject : 0;
  const profit = totalRevenue - totalProject;

  table(ctx,
    [['Categoría', 'Mensual', 'Meses activos', 'Total']],
    state.investment.map((l) => {
      const months = l.onlyMonths?.length ?? state.durationMonths;
      return [l.category, `$${l.monthly.toLocaleString()}`, months, `$${(l.monthly * months).toLocaleString()}`];
    }),
  );
  table(ctx, [['Indicador', 'Valor']], [
    ['Inversión total mensual', `$${totalMonthly.toLocaleString()}`],
    ['Inversión total proyecto', `$${totalProject.toLocaleString()}`],
    ['Facturación proyectada total', `$${totalRevenue.toLocaleString()}`],
    ['ROI proyectado', `${roi.toFixed(2)}x`],
    ['Ganancia estimada', `$${profit.toLocaleString()}`],
  ]);

  // G — Debriefing resumen (sólo si tiene contenido)
  if (hasAnyDebriefContent(state.debriefing)) {
    h2(ctx, 'G · Debriefing — resumen');
    drawDebriefingSections(ctx, state);
  }
}

/* ─────────────── Contenido Debriefing ─────────────── */

function drawDebriefingContent(doc: jsPDF, client: Client, state: ProjectionState) {
  doc.addPage();
  const ctx = ctxFor(doc, client.primaryColor);
  drawDebriefingSections(ctx, state);
}

function drawDebriefingSections(ctx: PdfCtx, state: ProjectionState) {
  const d = state.debriefing;

  if (d.executiveSummary?.text) {
    h2(ctx, '01 · Resumen ejecutivo');
    body(ctx, d.executiveSummary.text);
    spacer(ctx);
  }

  if (d.context) {
    h2(ctx, '02 · Contexto y situación actual');
    if (d.context.situation) { h3(ctx, 'Situación actual'); body(ctx, d.context.situation); }
    if (d.context.challenges) { h3(ctx, 'Desafíos'); body(ctx, d.context.challenges); }
    if (d.context.opportunities) { h3(ctx, 'Oportunidades'); body(ctx, d.context.opportunities); }
    if (d.context.swot) {
      h3(ctx, 'FODA');
      table(ctx, [['Fortalezas', 'Debilidades'], ['Oportunidades', 'Amenazas']], [
        [d.context.swot.s ?? '—', d.context.swot.w ?? '—'],
        [d.context.swot.o ?? '—', d.context.swot.t ?? '—'],
      ]);
    }
    spacer(ctx);
  }

  if (d.idealClient?.text) {
    h2(ctx, '03 · El cliente ideal'); body(ctx, d.idealClient.text); spacer(ctx);
  }

  if (d.valueProp) {
    h2(ctx, '04 · Propuesta de valor y oferta');
    if (d.valueProp.text) { h3(ctx, 'Oferta irresistible'); body(ctx, d.valueProp.text); }
    if (d.valueProp.bigIdea) { h3(ctx, 'The Big Idea'); body(ctx, d.valueProp.bigIdea); }
    if (d.valueProp.guarantees) { h3(ctx, 'Garantías'); body(ctx, d.valueProp.guarantees); }
    spacer(ctx);
  }

  if (d.communication) {
    h2(ctx, '05 · Estrategia de comunicación');
    if (d.communication.text) body(ctx, d.communication.text);
    if (d.communication.tone) body(ctx, `Tono y voz: ${d.communication.tone}`, { mute: true });
    if (d.communication.angles?.length) {
      h3(ctx, 'Ángulos de comunicación');
      d.communication.angles.forEach((a) => bullet(ctx, a));
    }
    spacer(ctx);
  }

  if (d.salesSystem) {
    h2(ctx, '06 · Sistema de ventas');
    if (d.salesSystem.text) body(ctx, d.salesSystem.text);
    if (d.salesSystem.funnel) { h3(ctx, 'Funnel'); body(ctx, d.salesSystem.funnel); }
    if (d.salesSystem.stack) { h3(ctx, 'Stack'); body(ctx, d.salesSystem.stack); }
    spacer(ctx);
  }

  if (d.successMetrics?.kpis?.length) {
    h2(ctx, '07 · Métricas de éxito');
    table(ctx, [['KPI', 'Frecuencia', 'Responsable', 'Umbral alerta']],
      d.successMetrics.kpis.map((k) => [k.name, k.frequency, k.owner, k.alertThreshold]),
    );
    spacer(ctx);
  }

  if (d.team) {
    h2(ctx, '08 · Equipo y responsabilidades');
    if (d.team.text) body(ctx, d.team.text);
    if (d.team.raci?.length) {
      h3(ctx, 'Matriz RACI');
      table(ctx, [['Tarea / Decisión', 'Responsable', 'Aprobador', 'Consultado', 'Informado']],
        d.team.raci.map((r) => [r.task, r.responsible, r.accountable, r.consulted, r.informed]),
      );
    }
    spacer(ctx);
  }

  if (d.timeline) {
    h2(ctx, '09 · Timeline y próximos pasos');
    if (d.timeline.text) body(ctx, d.timeline.text);
    if (d.timeline.nextMilestones?.length) {
      h3(ctx, 'Próximos hitos');
      table(ctx, [['Hito', 'Fecha']], d.timeline.nextMilestones.map((m) => [m.title, m.date]));
    }
    spacer(ctx);
  }

  if (d.agreements) {
    h2(ctx, '10 · Acuerdos y compromisos');
    if (d.agreements.agencyDelivers) { h3(ctx, 'La agencia entrega'); body(ctx, d.agreements.agencyDelivers); }
    if (d.agreements.clientProvides) { h3(ctx, 'El cliente provee'); body(ctx, d.agreements.clientProvides); }
    if (d.agreements.approvalTimes) body(ctx, `Tiempos de aprobación: ${d.agreements.approvalTimes}`, { mute: true });
    if (d.agreements.conditions) body(ctx, d.agreements.conditions);
    spacer(ctx);
  }

  if (d.appendices) {
    h2(ctx, '11 · Apéndices');
    if (d.appendices.competitorAnalysis) { h3(ctx, 'Análisis de competencia'); body(ctx, d.appendices.competitorAnalysis); }
    if (d.appendices.references) { h3(ctx, 'Referencias visuales'); body(ctx, d.appendices.references); }
    if (d.appendices.techStack) { h3(ctx, 'Stack tecnológico'); body(ctx, d.appendices.techStack); }
    if (d.appendices.budget) { h3(ctx, 'Presupuesto'); body(ctx, d.appendices.budget); }
  }
}

function hasAnyDebriefContent(d: ProjectionState['debriefing']): boolean {
  return Object.values(d).some((v) => {
    if (!v) return false;
    if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some((x) => (typeof x === 'string' && x.trim().length > 0) || (Array.isArray(x) && x.length > 0));
    return false;
  });
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return [99, 102, 241];
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}
