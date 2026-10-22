import { useRef, useState } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useContentStore } from '@/store/useContentStore';
import { toast } from '@/store/useToastStore';
import { ContentRepo } from '@/services/repositories';
import { descargarArchivo } from '@/utils/descargarArchivo';
import {
  leerContenidoCSV, CSV_PLANTILLA_CONTENIDO,
  type FilaContenidoResultado, type ResultadoImportacionContenido,
} from '@/utils/csvContenido';
import type { ContentPiece } from '@/types/content';

interface Props {
  open: boolean;
  clientId: string;
  onClose: () => void;
}

/**
 * Importa piezas de contenido desde el CSV que entrega la terminal externa
 * de generación de contenido — a diferencia de `ImportarLeadsCSVModal`, NO
 * hay bandeja de revisión con checkboxes: todo lo que pasa la validación
 * entra directo al Kanban en "Sin empezar", en su fecha real de publicación
 * (decisión de la founder, 22-oct-2026). La vista previa sigue mostrando
 * fila por fila para que se vea qué se rechazó y por qué ANTES de confirmar.
 */
export function ImportarContenidoCSVModal({ open, clientId, onClose }: Props) {
  const addMany = useContentStore((s) => s.addMany);
  const pieces = useContentStore((s) => s.pieces);

  const [nombreArchivo, setNombreArchivo] = useState('');
  const [lectura, setLectura] = useState<ResultadoImportacionContenido | null>(null);
  const [importando, setImportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cerrar = () => {
    setNombreArchivo('');
    setLectura(null);
    if (inputRef.current) inputRef.current.value = '';
    onClose();
  };

  const leerArchivo = async (file: File | undefined) => {
    if (!file) return;
    setNombreArchivo(file.name);
    const texto = await file.text();
    setLectura(leerContenidoCSV(texto, clientId, pieces));
  };

  const descargarPlantilla = () => {
    descargarArchivo(new Blob(['﻿' + CSV_PLANTILLA_CONTENIDO], { type: 'text/csv;charset=utf-8' }), 'plantilla-contenido.csv');
  };

  const importar = async () => {
    if (!lectura || lectura.piezas.length === 0) return;
    setImportando(true);

    const creadas: ContentPiece[] = [];
    const fallos: Array<{ titulo: string; motivo: string }> = [];

    // Secuencial, igual que los demás importadores — lote pequeño, y así se
    // sabe exactamente cuál pieza entró y cuál no, sin dejarlo a medias.
    for (const pieza of lectura.piezas) {
      try {
        const guardada = await ContentRepo.create(pieza);
        creadas.push(guardada);
      } catch (e) {
        fallos.push({ titulo: pieza.title, motivo: (e as Error).message || 'error al guardar' });
      }
    }

    addMany(creadas);
    setImportando(false);

    if (fallos.length) {
      toast.error(
        `Entraron ${creadas.length}. NO entraron ${fallos.length}: ` +
          fallos.map((f) => `${f.titulo} (${f.motivo})`).join(' · '),
      );
      return;
    }

    toast.success(`${creadas.length} pieza${creadas.length === 1 ? '' : 's'} de contenido importada${creadas.length === 1 ? '' : 's'}, directo al Kanban.`);
    cerrar();
  };

  if (!open) return null;

  const total = lectura?.filas.length ?? 0;
  const nCreadas = lectura?.filas.filter((f) => f.estado === 'creada').length ?? 0;
  const nExistentes = lectura?.filas.filter((f) => f.estado === 'existente').length ?? 0;
  const nRechazadas = lectura?.filas.filter((f) => f.estado === 'rechazada').length ?? 0;

  return (
    <AnimatePresence>
      <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={cerrar} className="fixed inset-0 z-50 bg-bg-base/70 backdrop-blur-sm" />
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[14px] border border-border-default bg-bg-surface" onClick={(e) => e.stopPropagation()}>
          <header className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <h3 className="text-sm font-bold text-text-primary">Importar contenido desde un archivo</h3>
            <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-bg-hover focus-ring">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-text-secondary max-w-lg">
                Un CSV con una fila por pieza — título, formato, fecha de publicación, guion y caption son
                obligatorios. La plataforma siempre es Instagram. Lo que pase la validación entra{' '}
                <strong>directo al Kanban</strong>, en "Sin empezar".
              </p>
              <Button variant="ghost" onClick={descargarPlantilla}>
                <Download className="h-3.5 w-3.5" /> Descargar plantilla
              </Button>
            </div>

            <label className="surface p-6 flex flex-col items-center gap-2 cursor-pointer border-dashed hover:border-accent/50 transition-colors">
              <FileSpreadsheet className="h-6 w-6 text-text-muted" />
              <span className="text-sm text-text-primary">{nombreArchivo || 'Elegir archivo CSV'}</span>
              <span className="text-xs text-text-muted">Sirve el CSV que exporta la terminal externa de generación de contenido.</span>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void leerArchivo(e.target.files?.[0])} />
            </label>

            {lectura?.error && (
              <div className="rounded-[10px] border border-danger/40 bg-danger/10 p-3 text-sm text-text-primary flex gap-2">
                <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                <span>{lectura.error}</span>
              </div>
            )}

            {lectura && !lectura.error && lectura.columnasIgnoradas.length > 0 && (
              <div className="rounded-[10px] border border-warning/40 bg-warning/10 p-3 text-xs text-text-secondary">
                Columnas que no reconocemos y no se importan:{' '}
                <strong className="text-text-primary">{lectura.columnasIgnoradas.join(', ')}</strong>
              </div>
            )}

            {lectura && !lectura.error && total > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-status-success"><CheckCircle2 className="h-3.5 w-3.5" /> {nCreadas} entrarán</span>
                {nExistentes > 0 && <span className="inline-flex items-center gap-1 text-text-muted"><Clock className="h-3.5 w-3.5" /> {nExistentes} ya existían</span>}
                {nRechazadas > 0 && <span className="inline-flex items-center gap-1 text-status-danger"><XCircle className="h-3.5 w-3.5" /> {nRechazadas} rechazadas</span>}
              </div>
            )}

            {lectura && !lectura.error && lectura.filas.length > 0 && (
              <div className="rounded-[10px] border border-border-subtle divide-y divide-border-subtle max-h-[38vh] overflow-y-auto">
                {lectura.filas.map((f) => <FilaLeida key={f.linea} fila={f} />)}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border-subtle">
            <div className="text-xs text-text-muted">
              {nCreadas > 0 ? `${nCreadas} pieza${nCreadas === 1 ? '' : 's'} entrará${nCreadas === 1 ? '' : 'n'} al Kanban` : 'Nada para importar todavía'}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={cerrar} disabled={importando}>Cancelar</Button>
              <Button onClick={() => void importar()} disabled={importando || nCreadas === 0}>
                <Upload className="h-4 w-4" />
                {importando ? 'Importando…' : `Importar ${nCreadas || ''} pieza${nCreadas === 1 ? '' : 's'}`}
              </Button>
            </div>
          </footer>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function FilaLeida({ fila }: { fila: FilaContenidoResultado }) {
  const estilo = {
    creada: { icon: CheckCircle2, color: 'text-status-success' },
    existente: { icon: Clock, color: 'text-text-muted' },
    rechazada: { icon: XCircle, color: 'text-status-danger' },
  }[fila.estado];
  const Icon = estilo.icon;
  return (
    <div className="flex items-start gap-2 px-3 py-2 text-xs">
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${estilo.color}`} />
      <div className="min-w-0 flex-1">
        <span className="text-text-primary font-medium">{fila.tituloCrudo || `Línea ${fila.linea}`}</span>
        {fila.motivo && <span className="text-text-muted"> — {fila.motivo}</span>}
      </div>
    </div>
  );
}
