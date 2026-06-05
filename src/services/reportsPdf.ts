import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Task, TaskStatus } from '@/types/task';
import type { Meeting } from '@/types/meeting';
import type { Funnel, FunnelPhase } from '@/types/funnel';

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
  doc.text(`SALES BRAIN OS — ${kind}`, 22, 28);
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
    doc.text('Sales Brain OS', 18, pageH - 8);
  }
}

function fileName(client: Client, kind: string) {
  return `${kind}_${client.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
}

/* ───────────────────────── 1) REPORTE SEMANAL ───────────────────────── */

export function exportWeeklyReport({ client, tasks, meetings }: {
  client: Client;
  tasks: Task[];
  meetings: Meeting[];
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const accent = hexToRgb(client.primaryColor);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const inWeek = (iso?: string) => !!iso && isWithinInterval(parseISO(iso), { start: weekStart, end: weekEnd });

  header(doc, client, 'Reporte semanal', accent);
  doc.setFontSize(14); doc.setTextColor(...accent);
  doc.text(
    `Semana del ${format(weekStart, "d 'de' MMM", { locale: es })} al ${format(weekEnd, "d 'de' MMM yyyy", { locale: es })}`,
    22, 82,
  );

  const completed = tasks.filter((t) => t.status === 'completed' && inWeek(t.completedAt));
  const inProgress = tasks.filter((t) => t.status === 'in_progress' || t.status === 'in_review');
  const overdue = tasks.filter((t) => t.isDelayed && t.status !== 'completed');
  const weekMeetings = meetings.filter((m) => inWeek(m.scheduledAt));

  // KPIs
  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 30);
  doc.text('Resumen', 18, 22);
  autoTable(doc, {
    head: [['Indicador', 'Valor']],
    body: [
      ['Tareas completadas esta semana', String(completed.length)],
      ['Tareas en curso', String(inProgress.length)],
      ['Tareas vencidas', String(overdue.length)],
      ['Reuniones esta semana', String(weekMeetings.length)],
      ['ROAS actual', client.metrics.roas !== null ? `${client.metrics.roas.toFixed(2)}x` : '—'],
      ['Avance del proyecto', `${client.metrics.progressPercent}%`],
    ],
    startY: 28,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
  });

  // Completadas
  // @ts-expect-error lastAutoTable
  let y = (doc.lastAutoTable.finalY ?? 60) + 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 30);
  doc.text(`Completadas (${completed.length})`, 18, y);
  autoTable(doc, {
    head: [['Tarea', 'Prioridad', 'Cerrada']],
    body: completed.length > 0
      ? completed.map((t) => [t.title, t.priority, t.completedAt ? format(parseISO(t.completedAt), 'dd/MM', { locale: es }) : '—'])
      : [['Sin tareas completadas esta semana', '—', '—']],
    startY: y + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
    theme: 'grid',
  });

  // Vencidas
  // @ts-expect-error lastAutoTable
  y = (doc.lastAutoTable.finalY ?? 60) + 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(`Vencidas (${overdue.length})`, 18, y);
  autoTable(doc, {
    head: [['Tarea', 'Prioridad', 'Días retraso', 'Responsable']],
    body: overdue.length > 0
      ? overdue.map((t) => [t.title, t.priority, String(t.delayDays), t.assignedTo || '—'])
      : [['Sin tareas vencidas', '—', '—', '—']],
    startY: y + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] },
    theme: 'grid',
  });

  // Reuniones
  // @ts-expect-error lastAutoTable
  y = (doc.lastAutoTable.finalY ?? 60) + 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(`Reuniones (${weekMeetings.length})`, 18, y);
  autoTable(doc, {
    head: [['Reunión', 'Tipo', 'Fecha', 'Duración']],
    body: weekMeetings.length > 0
      ? weekMeetings.map((m) => [
          m.title,
          m.type,
          format(parseISO(m.scheduledAt), 'dd/MM HH:mm', { locale: es }),
          `${m.durationMin}min`,
        ])
      : [['Sin reuniones esta semana', '—', '—', '—']],
    startY: y + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: accent, textColor: [255, 255, 255] },
    theme: 'grid',
  });

  footer(doc);
  doc.save(fileName(client, 'Reporte_Semanal'));
}

/* ───────────────────────── 2) REPORTE MENSUAL ───────────────────────── */

export function exportMonthlyReport({ client, tasks, meetings }: {
  client: Client;
  tasks: Task[];
  meetings: Meeting[];
}) {
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
      ['ROAS', client.metrics.roas !== null ? `${client.metrics.roas.toFixed(2)}x` : '—'],
      ['Invertido este mes', client.metrics.invertedThisMonth ? `$${client.metrics.invertedThisMonth.toLocaleString('es')}` : '—'],
      ['Ventas', client.metrics.salesCount ? `${client.metrics.salesCount}` : '—'],
      ['Facturado acumulado', client.metrics.revenueAccumulated ? `$${client.metrics.revenueAccumulated.toLocaleString('es')}` : '—'],
      ['Meta mensual', client.metrics.monthlyRevenueTarget ? `$${client.metrics.monthlyRevenueTarget.toLocaleString('es')}` : '—'],
      ['Avance del proyecto', `${client.metrics.progressPercent}%`],
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
    let y = (doc.lastAutoTable.finalY ?? 60) + 10;
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
  let y = (doc.lastAutoTable.finalY ?? 60) + 10;
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
