import { estaVencida } from '@/utils/vencidas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Task, TaskStatus } from '@/types/task';
import type { Meeting } from '@/types/meeting';
import type { Funnel, FunnelPhase } from '@/types/funnel';
import type { RopreItem } from '@/types/ropre';
import { generateWeeklyReport, generateRopreWeekly } from '@/services/claudeApi';
import { BRAND } from '@/config/brand';
import { resolveRoleLabel } from '@/utils/roleResolver';

/**
 * Reportes PDF para clientes — 4 tipos.
 * Sigue el patrón de sopPdf.ts: jsPDF + autoTable, helvetica, A4 portrait.
 */

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  in_review: 'Revisión',
  completed: 'Completada',
  blocked: 'Bloqueada',
};

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m) return [99, 102, 241];
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

function header(doc: jsPDF, client: Client, kind: string, accentRgb: [number, number, number]) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...accentRgb);
  doc.rect(0, 0, 8, pageH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(120, 120, 140);
  doc.text(`${BRAND.name} — ${kind}`, 22, 28);
  doc.setFontSize(28); doc.setTextColor(20, 20, 30);
  doc.text(client.name, 22, 70);
  doc.setFontSize(10); doc.setTextColor(100, 100, 120);
  doc.text(`Generado: ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`, 22, 92);
}

function footer(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 160);
    doc.text(`Página ${i} de ${total}`, pageW - 18, pageH - 8, { align: 'right' });
    doc.text(BRAND.label, 18, pageH - 8);
  }
}

function fileName(client: Client, kind: string) {
  return `${kind}_${client.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
}

/* ───────────────────────── 1) REPORTE SEMANAL (IA + 4 páginas) ───────────────────────── */

/**
 * Reporte semanal del cliente — 4 páginas + portada con IA.
 * - Portada con fondo accent + título + período.
 * - P1: resumen ejecutivo (Claude haiku) + 3 indicadores semáforo.
 * - P2: tabla de tareas completadas en los últimos 7 días.
 * - P3: tabla de tareas pendientes/en curso con días restantes coloreados.
 * - P4: top-3 prioridades para la próxima semana (IA) + reuniones + entregables
 *       + bloque libre opcional "Lo que necesitamos de ti esta semana".
 *
 * Es async porque llama a Claude. Si Claude falla, usa fallback heurístico
 * y el PDF se genera igual (nunca bloquea la descarga).
 */
export async function exportWeeklyReport({ client, tasks: tasksIn, meetings: meetingsIn, funnel, needFromClient, ropreItems }: {
  client: Client;
  tasks: Task[];
  meetings: Meeting[];
  funnel?: Funnel | null;
  needFromClient?: string;
  ropreItems?: RopreItem[];
}): Promise<void> {
  // Regla 5D: lo privado nunca sale en un reporte.
  const tasks = tasksIn.filter((t) => !t.esPrivada);
  const meetings = meetingsIn.filter((m) => !m.esPrivada);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const accent = hexToRgb(client.primaryColor);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const today = new Date();
  const inWeek = (iso?: string) => !!iso && isWithinInterval(parseISO(iso), { start: weekStart, end: weekEnd });

  const completed = tasks
    .filter((t) => t.status === 'completed' && inWeek(t.completedAt))
    .sort((a, b) => +new Date(b.completedAt ?? 0) - +new Date(a.completedAt ?? 0));
  const pending = tasks
    .filter((t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'in_review')
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const totalThisWeek = completed.length + pending.filter((t) => inWeek(t.dueDate)).length;
  const compliancePct = totalThisWeek === 0 ? 100 : Math.round((completed.length / totalThisWeek) * 100);
  const daysToNextEvent = funnel?.eventDate
    ? differenceInDays(parseISO(funnel.eventDate), today)
    : funnel?.endDate
    ? differenceInDays(parseISO(funnel.endDate), today)
    : null;

  // ─── Llamada a IA (no bloqueante: si falla, fallback interno) ───
  const ai = await generateWeeklyReport({
    clientName: client.name,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    tasksCompleted: completed.length,
    tasksPending: pending.length,
    compliancePct,
    daysToNextEvent,
    pendingTasksSample: pending.slice(0, 10).map((t) => ({
      title: t.title,
      priority: t.priority,
      role: resolveRoleLabel(t.assignedTo, client.id) ?? t.assignedTo,
      dueInDays: differenceInDays(parseISO(t.dueDate), today),
    })),
  });

  // ─── Análisis ROPRE de la semana (Sección 1) ───
  const ropre = ropreItems ?? [];
  const byType = (t: RopreItem['type']) => ropre.filter((i) => i.type === t);
  const overdueTasks = pending.filter((t) => estaVencida(t));
  const ropreAi = await generateRopreWeekly({
    clientName: client.name,
    resultadoEsperado: byType('result')[0]?.title ?? '',
    objetivos: byType('objective').map((i) => i.title),
    premisas: byType('premise').map((i) => i.title),
    riesgos: byType('risk').map((i) => i.title),
    entregablesPendientes: byType('deliverable').filter((i) => i.status !== 'done').length,
    tareasCompletadas: completed.map((t) => t.title),
    tareasVencidas: overdueTasks.map((t) => t.title),
    cumplimientoPct: compliancePct,
  });
  const SEMAFORO_RGB: Record<string, [number, number, number]> = {
    verde: [16, 185, 129], amarillo: [245, 158, 11], rojo: [239, 68, 68],
  };
  const semRgb = SEMAFORO_RGB[ropreAi.semaforo] ?? SEMAFORO_RGB.amarillo;

  /* ═══ PORTADA ═══ */
  doc.setFillColor(...accent);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('REPORTE DE AVANCE SEMANAL', pageW / 2, 70, { align: 'center' });
  doc.setFontSize(28);
  doc.text(client.name, pageW / 2, 110, { align: 'center', maxWidth: pageW - 40 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(
    `Semana del ${format(weekStart, "d 'de' MMM", { locale: es })} al ${format(weekEnd, "d 'de' MMM yyyy", { locale: es })}`,
    pageW / 2, 135, { align: 'center' },
  );
  doc.setFontSize(10);
  doc.text(`Preparado por: Marisol Ochoa  |  ${BRAND.label}`, pageW / 2, pageH - 30, { align: 'center' });

  /* ═══ P1: RESUMEN EJECUTIVO ═══ */
  doc.addPage();
  doc.setTextColor(20, 20, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Resumen ejecutivo', 18, 22);

  // Línea accent decorativa
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(18, 25, 60, 25);

  // Párrafo IA
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 75);
  const summaryLines = doc.splitTextToSize(ai.summary, pageW - 36);
  doc.text(summaryLines, 18, 38);

  // Indicadores semáforo
  const indicatorsY = 38 + summaryLines.length * 6 + 12;
  const semaphore = (
    val: number, good: number, mid: number
  ): [number, number, number] =>
    val >= good ? [16, 185, 129] : val >= mid ? [245, 158, 11] : [239, 68, 68];
  const eventColor: [number, number, number] = daysToNextEvent === null
    ? [120, 120, 140]
    : daysToNextEvent >= 14 ? [16, 185, 129]
    : daysToNextEvent >= 7 ? [245, 158, 11]
    : [239, 68, 68];

  const indicators: Array<{ label: string; value: string; color: [number, number, number] }> = [
    { label: 'Tareas completadas', value: `${completed.length} de ${totalThisWeek}`, color: semaphore(compliancePct, 80, 50) },
    { label: 'Cumplimiento a tiempo', value: `${compliancePct}%`, color: semaphore(compliancePct, 80, 50) },
    {
      label: 'Próximo hito',
      value: daysToNextEvent === null ? '—' : daysToNextEvent < 0 ? `Pasó hace ${Math.abs(daysToNextEvent)}d` : `${daysToNextEvent} días`,
      color: eventColor,
    },
  ];
  const colW = (pageW - 36 - 12) / 3;
  indicators.forEach((ind, i) => {
    const x = 18 + i * (colW + 6);
    doc.setFillColor(...ind.color);
    doc.circle(x + 5, indicatorsY + 3, 2.5, 'F');
    doc.setTextColor(80, 80, 95);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(ind.label.toUpperCase(), x + 11, indicatorsY + 2);
    doc.setTextColor(20, 20, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(ind.value, x + 11, indicatorsY + 9);
  });

  /* ═══ P2: COMPLETADAS ═══ */
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 30);
  doc.text('Tareas completadas esta semana', 18, 22);
  doc.setLineWidth(0.8);
  doc.setDrawColor(...accent);
  doc.line(18, 25, 110, 25);

  autoTable(doc, {
    head: [['Tarea', 'Responsable', 'Entregado', 'Resultado']],
    body: completed.length > 0
      ? completed.map((t) => [
          t.title,
          resolveRoleLabel(t.assignedTo, client.id) ?? t.assignedTo,
          t.completedAt ? format(parseISO(t.completedAt), 'd MMM', { locale: es }) : '—',
          t.kpiNombre
            ? (t.kpiResultado ? `${t.kpiResultado}${t.kpiMeta ? ` / meta ${t.kpiMeta}` : ''}` : 'Sin registrar')
            : 'Completada',
        ])
      : [['Sin tareas completadas esta semana', '—', '—', '—']],
    startY: 32,
    styles: { fontSize: 9, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 38 }, 2: { cellWidth: 20 }, 3: { cellWidth: 34 } },
  });

  /* ═══ P3: PENDIENTES ═══ */
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 30);
  doc.text('Tareas en progreso y pendientes', 18, 22);
  doc.setLineWidth(0.8);
  doc.setDrawColor(...accent);
  doc.line(18, 25, 115, 25);

  autoTable(doc, {
    head: [['Tarea', 'Responsable', 'Fecha límite', 'Prioridad', 'Días']],
    body: pending.length > 0
      ? pending.map((t) => {
          const days = differenceInDays(parseISO(t.dueDate), today);
          return [
            t.title,
            resolveRoleLabel(t.assignedTo, client.id) ?? t.assignedTo,
            format(parseISO(t.dueDate), 'd MMM', { locale: es }),
            t.priority,
            days < 0 ? `Vencida (${Math.abs(days)}d)` : days === 0 ? 'Hoy' : `${days}d`,
          ];
        })
      : [['Sin tareas pendientes', '—', '—', '—', '—']],
    startY: 32,
    styles: { fontSize: 8.5, cellPadding: 2.5, valign: 'top' },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 34 }, 2: { cellWidth: 22 }, 3: { cellWidth: 16 }, 4: { cellWidth: 26 } },
    // Colorea la columna "Días" según urgencia.
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 4) return;
      const row = pending[data.row.index];
      if (!row) return;
      const days = differenceInDays(parseISO(row.dueDate), today);
      if (days < 0) {
        data.cell.styles.textColor = [239, 68, 68];
        data.cell.styles.fontStyle = 'bold';
      } else if (days < 3) {
        data.cell.styles.textColor = [245, 158, 11];
        data.cell.styles.fontStyle = 'bold';
      } else {
        data.cell.styles.textColor = [16, 185, 129];
      }
    },
  });

  /* ═══ P3B: ROPRE DE LA SEMANA ═══ */
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 30);
  doc.text('ROPRE — Estado de la semana', 18, 22);
  doc.setLineWidth(0.8);
  doc.setDrawColor(...accent);
  doc.line(18, 25, 120, 25);

  // Semáforo visual + estado
  doc.setFillColor(...semRgb);
  doc.roundedRect(18, 31, 7, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...semRgb);
  doc.text(`${ropreAi.estado_resultado} · ${ropreAi.avance_resultado}% del resultado`, 29, 36.5);

  // Resumen de la semana
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 70);
  const ropreResumen = doc.splitTextToSize(ropreAi.resumen_semana, pageW - 36);
  doc.text(ropreResumen, 18, 48);

  autoTable(doc, {
    startY: 48 + ropreResumen.length * 5 + 4,
    head: [['ROPRE', 'Estado']],
    body: [
      ['R — Resultado', `${ropreAi.estado_resultado} — ${ropreAi.avance_resultado}%`],
      ['O — Objetivos', byType('objective').slice(0, 3).map((i) => i.title).join('; ') || 'Sin objetivos activos'],
      ['P — Premisas', ropreAi.cambios_esta_semana || 'Sin cambios'],
      ['R — Riesgos', ropreAi.alertas_ropre.join('; ') || 'Sin riesgos nuevos'],
      ['E — Entregables', `${byType('deliverable').filter((i) => i.status !== 'done').length} pendientes esta semana`],
    ],
    styles: { fontSize: 9, cellPadding: 3, valign: 'top' },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
  });

  // Recomendación del PM — box con borde izquierdo del color del semáforo
  const afterRopre = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  const recLines = doc.splitTextToSize(ropreAi.recomendacion_pm, pageW - 48);
  const boxH = 10 + recLines.length * 4.5;
  const ry = afterRopre + 8;
  doc.setFillColor(247, 247, 250);
  doc.rect(18, ry, pageW - 36, boxH, 'F');
  doc.setFillColor(...semRgb);
  doc.rect(18, ry, 1.6, boxH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 50);
  doc.text('Recomendación del PM', 23, ry + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 70);
  doc.text(recLines, 23, ry + 11);

  /* ═══ P4: FOCO PRÓXIMA SEMANA ═══ */
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 30);
  doc.text('Foco de la próxima semana', 18, 22);
  doc.setLineWidth(0.8);
  doc.setDrawColor(...accent);
  doc.line(18, 25, 105, 25);

  // 3 prioridades IA
  let yp = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 75);
  doc.text('PRIORIDADES', 18, yp);
  yp += 6;
  ai.priorities.slice(0, 3).forEach((pri, i) => {
    doc.setFillColor(...accent);
    doc.circle(20, yp + 1, 1.6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), 20, yp + 1.6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(35, 35, 50);
    const lines = doc.splitTextToSize(pri, pageW - 40);
    doc.text(lines, 28, yp + 2);
    yp += Math.max(8, lines.length * 5 + 4);
  });
  yp += 6;

  // Próximas reuniones (próximos 7 días)
  const nextWeekEnd = new Date(today.getTime() + 7 * 86400000);
  const upcomingMeetings = meetings
    .filter((m) => {
      const d = parseISO(m.scheduledAt);
      return d >= today && d <= nextWeekEnd;
    })
    .sort((a, b) => +parseISO(a.scheduledAt) - +parseISO(b.scheduledAt));

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(60, 60, 75);
  doc.text('PRÓXIMAS REUNIONES', 18, yp);
  yp += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 65);
  if (upcomingMeetings.length === 0) {
    doc.text('Sin reuniones agendadas para la próxima semana.', 18, yp + 4);
    yp += 10;
  } else {
    upcomingMeetings.slice(0, 5).forEach((m) => {
      doc.text(`• ${format(parseISO(m.scheduledAt), "EEE d MMM, HH:mm", { locale: es })} — ${m.title}`, 18, yp + 4);
      yp += 6;
    });
    yp += 4;
  }

  // Entregables que vencen próxima semana
  const upcomingDeliverables = pending.filter((t) => {
    const d = parseISO(t.dueDate);
    return d >= today && d <= nextWeekEnd && t.tag === 'deliverable';
  });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(60, 60, 75);
  doc.text('ENTREGABLES QUE VENCEN', 18, yp);
  yp += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 65);
  if (upcomingDeliverables.length === 0) {
    doc.text('Sin entregables vencidos en los próximos 7 días.', 18, yp + 4);
    yp += 10;
  } else {
    upcomingDeliverables.slice(0, 6).forEach((t) => {
      doc.text(`• ${format(parseISO(t.dueDate), 'EEE d MMM', { locale: es })} — ${t.title}`, 18, yp + 4);
      yp += 6;
    });
    yp += 4;
  }

  // Bloque libre del usuario (opcional)
  if (needFromClient && needFromClient.trim().length > 0) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...accent);
    doc.text('LO QUE NECESITAMOS DE TI ESTA SEMANA', 18, yp);
    yp += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 65);
    const need = doc.splitTextToSize(needFromClient.trim(), pageW - 36);
    doc.text(need, 18, yp + 4);
  }

  /* ═══ FOOTER en todas las páginas (excepto portada) ═══ */
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 160);
    doc.text(
      `Preparado por ${BRAND.label} para ${client.name}  |  Semana del ${format(weekStart, 'd MMM', { locale: es })}  |  Confidencial`,
      pageW / 2, pageH - 8, { align: 'center' },
    );
    doc.text(`${i - 1} de ${total - 1}`, pageW - 18, pageH - 8, { align: 'right' });
  }

  const safeName = client.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  doc.save(`Reporte_Semanal_${safeName}_${format(weekStart, 'yyyy-MM-dd')}.pdf`);
}

/* ───────────────────────── 2) REPORTE MENSUAL ───────────────────────── */

export function exportMonthlyReport({ client, tasks: tasksIn, meetings: meetingsIn }: {
  client: Client;
  tasks: Task[];
  meetings: Meeting[];
}) {
  // Regla 5D: lo privado nunca sale en un reporte.
  const tasks = tasksIn.filter((t) => !t.esPrivada);
  const meetings = meetingsIn.filter((m) => !m.esPrivada);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const accent = hexToRgb(client.primaryColor);
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const inMonth = (iso?: string) => !!iso && isWithinInterval(parseISO(iso), { start: monthStart, end: monthEnd });

  header(doc, client, 'Reporte mensual', accent);
  doc.setFontSize(14); doc.setTextColor(...accent);
  doc.text(format(monthStart, "MMMM yyyy", { locale: es }).toUpperCase(), 22, 82);

  const completed = tasks.filter((t) => t.status === 'completed' && inMonth(t.completedAt));
  const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'in_review');
  const monthMeetings = meetings.filter((m) => inMonth(m.scheduledAt));
  const byStatus: Record<TaskStatus, number> = {
    pending: 0, in_progress: 0, in_review: 0, completed: 0, blocked: 0,
  };
  for (const t of tasks) byStatus[t.status]++;

  // KPIs
  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 30);
  doc.text('KPIs del mes', 18, 22);
  autoTable(doc, {
    head: [['Indicador', 'Valor']],
    body: [
      ['ROAS', client.metrics.roas != null ? `${client.metrics.roas.toFixed(2)}x` : '—'],
      ['Invertido este mes', client.metrics.invertedThisMonth ? `$${client.metrics.invertedThisMonth.toLocaleString('es')}` : '—'],
      ['Ventas', client.metrics.salesCount ? `${client.metrics.salesCount}` : '—'],
      ['Facturado acumulado', client.metrics.revenueAccumulated ? `$${client.metrics.revenueAccumulated.toLocaleString('es')}` : '—'],
      ['Meta mensual', client.metrics.monthlyRevenueTarget ? `$${client.metrics.monthlyRevenueTarget.toLocaleString('es')}` : '—'],
      ['Avance del proyecto', `${tasks.length ? Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100) : 0}%`],
      ['Tareas completadas este mes', String(completed.length)],
      ['Reuniones este mes', String(monthMeetings.length)],
    ],
    startY: 28,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
  });

  // Distribución de tareas
  // @ts-expect-error lastAutoTable
  let y = (doc.lastAutoTable.finalY ?? 60) + 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Distribución de tareas', 18, y);
  autoTable(doc, {
    head: [['Estado', 'Cantidad']],
    body: (Object.keys(byStatus) as TaskStatus[]).map((s) => [STATUS_LABEL[s], String(byStatus[s])]),
    startY: y + 4,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
  });

  // Próximas pendientes
  // @ts-expect-error lastAutoTable
  y = (doc.lastAutoTable.finalY ?? 60) + 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(`Pendientes próximos (${Math.min(pending.length, 15)})`, 18, y);
  autoTable(doc, {
    head: [['Tarea', 'Prioridad', 'Vencimiento', 'Responsable']],
    body: pending
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
      .slice(0, 15)
      .map((t) => [
        t.title,
        t.priority,
        format(parseISO(t.dueDate), 'dd/MM', { locale: es }),
        t.assignedTo || '—',
      ]),
    startY: y + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
  });

  footer(doc);
  doc.save(fileName(client, 'Reporte_Mensual'));
}

/* ───────────────────────── 3) REPORTE DE REUNIÓN ───────────────────────── */

export function exportMeetingReport({ client, meeting }: { client: Client; meeting: Meeting }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const accent = hexToRgb(client.primaryColor);

  header(doc, client, 'Reporte de reunión', accent);
  doc.setFontSize(14); doc.setTextColor(...accent);
  doc.text(meeting.title, 22, 82, { maxWidth: 170 });
  doc.setFontSize(10); doc.setTextColor(100, 100, 120);
  doc.text(format(parseISO(meeting.scheduledAt), "EEEE d 'de' MMMM yyyy · HH:mm", { locale: es }), 22, 100);

  // Detalles
  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 30);
  doc.text('Detalles', 18, 22);
  autoTable(doc, {
    head: [['Campo', 'Valor']],
    body: [
      ['Tipo', meeting.type],
      ['Duración', `${meeting.durationMin} min`],
      ['Participantes', meeting.participants.map((p) => p.name).join(', ') || '—'],
      ['Link videollamada', meeting.videoCallLink || '—'],
      ['Estado', meeting.completed ? 'Realizada' : 'Pendiente'],
    ],
    startY: 28,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
  });

  // Agenda
  if (meeting.agenda) {
    // @ts-expect-error lastAutoTable
    const y = (doc.lastAutoTable.finalY ?? 60) + 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Agenda', 18, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 60);
    const lines = doc.splitTextToSize(meeting.agenda, 174);
    doc.text(lines, 18, y + 6);
  }

  // Notas
  if (meeting.notes) {
    doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 30);
    doc.text('Notas', 18, 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 60);
    const lines = doc.splitTextToSize(meeting.notes, 174);
    doc.text(lines, 18, 30);
  }

  // Tareas extraídas
  if (meeting.extractedTasks && meeting.extractedTasks.length > 0) {
    doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 30);
    doc.text('Tareas extraídas', 18, 22);
    autoTable(doc, {
      head: [['Tarea', 'Responsable', 'Días']],
      body: meeting.extractedTasks.map((t) => [t.title, t.responsibleRole, String(t.dueInDays)]),
      startY: 28,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: accent, textColor: [255, 255, 255] },
      theme: 'grid',
    });
  }

  footer(doc);
  doc.save(fileName(client, `Reunion_${meeting.title.slice(0, 30).replace(/\s+/g, '_')}`));
}

/* ───────────────────────── 4) REPORTE DE LANZAMIENTO ───────────────────────── */

export function exportLaunchReport({ client, funnel, phases, tasks }: {
  client: Client;
  funnel: Funnel;
  phases: FunnelPhase[];
  tasks: Task[];
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const accent = hexToRgb(client.primaryColor);
  const funnelTasks = tasks.filter((t) => t.funnelId === funnel.id);

  header(doc, client, 'Reporte de lanzamiento', accent);
  doc.setFontSize(14); doc.setTextColor(...accent);
  doc.text(funnel.name, 22, 82, { maxWidth: 170 });
  doc.setFontSize(10); doc.setTextColor(100, 100, 120);
  doc.text(
    `Inicio: ${format(parseISO(funnel.startDate), "d MMM yyyy", { locale: es })}` +
      (funnel.endDate ? `  ·  Cierre: ${format(parseISO(funnel.endDate), "d MMM yyyy", { locale: es })}` : ''),
    22, 100,
  );
  doc.text(`Estado: ${funnel.status}`, 22, 108);

  // Resumen
  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 30);
  doc.text('Resumen del embudo', 18, 22);
  const totalTasks = funnelTasks.length;
  const doneTasks = funnelTasks.filter((t) => t.status === 'completed').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  autoTable(doc, {
    head: [['Indicador', 'Valor']],
    body: [
      ['Fases', String(phases.length)],
      ['Tareas totales', String(totalTasks)],
      ['Tareas completadas', String(doneTasks)],
      ['Avance', `${progress}%`],
      ['Estado', funnel.status],
    ],
    startY: 28,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
  });

  // Fases con % avance
  // @ts-expect-error lastAutoTable
  const y = (doc.lastAutoTable.finalY ?? 60) + 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Avance por fase', 18, y);
  autoTable(doc, {
    head: [['Fase', 'Días', 'Tareas', 'Completadas', '%']],
    body: phases
      .sort((a, b) => a.order - b.order)
      .map((p) => {
        const phaseTasks = funnelTasks.filter((t) => t.phaseId === p.id);
        const done = phaseTasks.filter((t) => t.status === 'completed').length;
        const pct = phaseTasks.length > 0 ? Math.round((done / phaseTasks.length) * 100) : 0;
        return [p.name, `${p.dayStart}-${p.dayEnd}`, String(phaseTasks.length), String(done), `${pct}%`];
      }),
    startY: y + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
  });

  // Tareas por fase
  for (const phase of phases.sort((a, b) => a.order - b.order)) {
    const phaseTasks = funnelTasks.filter((t) => t.phaseId === phase.id);
    if (phaseTasks.length === 0) continue;
    doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 30);
    doc.text(phase.name, 18, 22, { maxWidth: 174 });
    autoTable(doc, {
      head: [['Tarea', 'Estado', 'Prioridad', 'Vencimiento']],
      body: phaseTasks.map((t) => [
        t.title,
        STATUS_LABEL[t.status],
        t.priority,
        format(parseISO(t.dueDate), 'dd/MM', { locale: es }),
      ]),
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: hexToRgb(phase.color), textColor: [255, 255, 255] },
      theme: 'grid',
    });
  }

  footer(doc);
  doc.save(fileName(client, `Lanzamiento_${funnel.name.slice(0, 30).replace(/\s+/g, '_')}`));
}
