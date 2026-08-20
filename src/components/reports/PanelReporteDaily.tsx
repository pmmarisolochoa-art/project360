/**
 * El reporte de la Daily dentro del drawer de la reunión.
 *
 * No se genera solo al abrir: cuesta una llamada de IA y una daily se abre
 * muchas veces para mirar las notas. Se genera cuando alguien lo pide, y
 * después queda a la vista mientras el drawer siga abierto.
 */

import { useState } from 'react';
import { FileText, RefreshCw, FileDown, Send } from 'lucide-react';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/useToastStore';
import { construirReporteDaily, reporteGuardado, type ReporteDaily } from '@/services/reports/dailyReport';
import { DailyReportView } from './DailyReportView';
import { sendMeetingReport } from '@/services/sendMeetingReport';
import { pdfDaily } from '@/services/reports/dailyPdf';

export function PanelReporteDaily({ client, meeting }: { client: Client; meeting: Meeting }) {
  // Arranca con el guardado, si lo hay: así sobrevive a la recarga y todo el
  // equipo ve el MISMO reporte, no uno distinto por persona.
  const [reporte, setReporte] = useState<ReporteDaily | null>(() => reporteGuardado(meeting));
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const generar = async () => {
    setCargando(true);
    try {
      setReporte(await construirReporteDaily(client, meeting));
    } catch (e) {
      // Las secciones de hechos no dependen de la IA, así que un fallo aquí es
      // de verdad un fallo: se dice, no se deja la pantalla en blanco.
      console.warn('[reporteDaily]', e);
      toast.error(`No se pudo armar el reporte: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}`);
    } finally {
      setCargando(false);
    }
  };

  if (!reporte) {
    return (
      <div className="surface p-5 text-center">
        <div className="text-sm text-text-secondary mb-1">Reporte de la Daily</div>
        <p className="text-xs text-text-muted mb-3">
          Estado del equipo, prioridades, seguimiento de tareas y pulso. Las tareas salen de
          Project360; el resto, de lo que se dijo en la reunión.
        </p>
        <Button onClick={generar} disabled={cargando} leftIcon={<FileText className="h-4 w-4" />}>
          {cargando ? 'Armando el reporte…' : 'Generar reporte'}
        </Button>
      </div>
    );
  }

  const descargar = async () => {
    try {
      const { blob, fileName } = await pdfDaily(client, meeting, reporte);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`No se pudo generar el PDF: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}`);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await sendMeetingReport(client, meeting);
      if (r.sent > 0) {
        toast.success(`Reporte enviado a ${r.people} persona${r.people === 1 ? '' : 's'} ✓`);
      } else {
        // Que nadie tenga correo NO es un éxito silencioso: si no se dice, se
        // cree que el equipo lo recibió.
        toast.error(r.note || 'Nadie del equipo tiene correo registrado: el reporte no salió.');
      }
    } catch (e) {
      toast.error(`No se pudo enviar: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="surface p-5">
      <DailyReportView r={reporte} />
      <div className="mt-4 pt-3 border-t border-border-subtle flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={generar} disabled={cargando}>
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? 'animate-spin' : ''}`} /> Regenerar
        </Button>
        <Button variant="secondary" onClick={descargar} leftIcon={<FileDown className="h-3.5 w-3.5" />}>
          PDF
        </Button>
        <Button onClick={enviar} disabled={enviando} leftIcon={<Send className="h-3.5 w-3.5" />}>
          {enviando ? 'Enviando…' : 'Enviar al equipo'}
        </Button>
      </div>
    </div>
  );
}
