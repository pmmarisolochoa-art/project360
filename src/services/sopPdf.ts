import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SOP_BLOCKS, SOP_QUESTIONS, type SopAssessment } from '@/types/viability';

const VERDICT_LABEL: Record<SopAssessment['verdict'], { label: string; color: [number, number, number] }> = {
  ideal:   { label: 'CLIENTE IDEAL', color: [16, 185, 129] },
  viable:  { label: 'VIABLE CON CONDICIONES', color: [245, 158, 11] },
  risky:   { label: 'CLIENTE DE RIESGO', color: [249, 115, 22] },
  reject:  { label: 'NO RECOMENDADO', color: [239, 68, 68] },
};

export function exportSopReport(a: SopAssessment) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageH = doc.internal.pageSize.getHeight();
  const v = VERDICT_LABEL[a.verdict];

  // Portada
  doc.setFillColor(...v.color);
  doc.rect(0, 0, 8, pageH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(120, 120, 140);
  doc.text('SALES BRAIN OS — SOP de viabilidad', 22, 28);
  doc.setFontSize(28); doc.setTextColor(20, 20, 30);
  doc.text(a.prospectName, 22, 70);
  doc.setFontSize(16); doc.setTextColor(...v.color);
  doc.text(v.label, 22, 82);
  doc.setFontSize(10); doc.setTextColor(100, 100, 120);
  doc.text(`Puntaje total: ${a.score}/100`, 22, 92);
  doc.text(`Fecha: ${new Date(a.createdAt).toLocaleString('es')}`, 22, 100);

  // Tabla de puntajes por bloque
  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 30);
  doc.text('Resumen por bloque', 18, 22);

  autoTable(doc, {
    head: [['Bloque', 'Descripción', 'Puntaje', '/20']],
    body: (['A','B','C','D','E'] as const).map((b) => [b, SOP_BLOCKS[b], a.blockScores[b], 20]),
    startY: 28,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: v.color, textColor: [255,255,255] },
    theme: 'grid',
  });

  // Detalle de respuestas
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  // @ts-expect-error lastAutoTable
  const startY = (doc.lastAutoTable.finalY ?? 60) + 10;
  doc.text('Detalle de respuestas', 18, startY);
  autoTable(doc, {
    head: [['#', 'Pregunta', 'Valor']],
    body: a.answers.map((ans) => {
      const q = SOP_QUESTIONS.find((x) => x.id === ans.questionId);
      const opt = q?.options.find((o) => o.value === ans.value);
      return [q?.id ?? '', q?.text ?? '', `${opt?.label ?? '—'} (${ans.value})`];
    }),
    startY: startY + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: v.color, textColor: [255,255,255] },
    theme: 'grid',
    margin: { left: 18, right: 18 },
  });

  doc.save(`Viabilidad_${a.prospectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
}
