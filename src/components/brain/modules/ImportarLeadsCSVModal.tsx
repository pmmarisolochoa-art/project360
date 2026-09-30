import { useMemo, useRef, useState } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLeadsStore } from '@/store/useLeadsStore';
import { toast } from '@/store/useToastStore';
import { LeadsRepo, LeadEventsRepo } from '@/services/repositories';
import { descargarArchivo } from '@/utils/descargarArchivo';
import type { Lead, LeadEvent } from '@/types/lead';
import {
  leerLeadsCSV,
  construirLeadDesdeFila,
  CSV_PLANTILLA_LEADS,
  type FilaLeadRevision,
  type LecturaLeadsCSV,
} from '@/utils/csvLeads';

interface Props {
  open: boolean;
  clientId: string;
  onClose: () => void;
}

/**
 * Bandeja de revisión para importar leads desde el Excel/CSV que alimenta el
 * formulario de la landing (mismo patrón que `ImportarClientesCSVModal`).
 * No sincroniza: entra solo lo que se marca; lo ya existente sale en gris.
 */
export function ImportarLeadsCSVModal({ open, clientId, onClose }: Props) {
  const registrar = useLeadsStore((s) => s.registrarImportados);

  const [nombreArchivo, setNombreArchivo] = useState('');
  const [lectura, setLectura] = useState<LecturaLeadsCSV | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [importando, setImportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const nuevas = useMemo(() => (lectura?.filas ?? []).filter((f) => f.estado === 'nueva'), [lectura]);

  const cerrar = () => {
    setNombreArchivo('');
    setLectura(null);
    setMarcadas(new Set());
    if (inputRef.current) inputRef.current.value = '';
    onClose();
  };

  const leerArchivo = async (file: File | undefined) => {
    if (!file) return;
    setNombreArchivo(file.name);
    const texto = await file.text();
    const res = leerLeadsCSV(texto, clientId, useLeadsStore.getState().leads);
    setLectura(res);
    setMarcadas(new Set(res.filas.filter((f) => f.estado === 'nueva').map((f) => f.linea)));
  };

  const alternar = (linea: number) =>
    setMarcadas((prev) => {
      const s = new Set(prev);
      if (s.has(linea)) s.delete(linea);
      else s.add(linea);
      return s;
    });

  const descargarPlantilla = () => {
    descargarArchivo(new Blob(['﻿' + CSV_PLANTILLA_LEADS], { type: 'text/csv;charset=utf-8' }), 'plantilla-leads.csv');
  };

  const importar = async () => {
    const aImportar = nuevas.filter((f) => marcadas.has(f.linea));
    if (aImportar.length === 0) return;
    setImportando(true);

    const creados: Lead[] = [];
    const fallos: Array<{ nombre: string; motivo: string }> = [];

    // Secuencial, igual que la importación de clientes: es un lote pequeño y
    // así se sabe exactamente cuál entró y cuál no (R-33), sin dejar el lote
    // a medias como haría una escritura optimista.
    for (const fila of aImportar) {
      const lead = construirLeadDesdeFila(fila.datos!, clientId);
      try {
        const guardado = await LeadsRepo.create(lead);
        creados.push(guardado);
        const evento: LeadEvent = {
          id: crypto.randomUUID(),
          leadId: guardado.id,
          etapaNueva: 'nuevo',
          nota: 'Importado desde CSV',
          createdAt: guardado.createdAt,
        };
        await LeadEventsRepo.add(evento).catch(() => undefined);
      } catch (e) {
        fallos.push({ nombre: fila.nombreCrudo, motivo: (e as Error).message || 'error al guardar' });
      }
    }

    registrar(creados);
    setImportando(false);

    if (fallos.length) {
      toast.error(
        `Entraron ${creados.length}. NO entraron ${fallos.length}: ` +
          fallos.map((f) => `${f.nombre} (${f.motivo})`).join(' · '),
      );
      const file = inputRef.current?.files?.[0];
      if (creados.length && file) await leerArchivo(file);
      return;
    }

    toast.success(`${creados.length} lead${creados.length === 1 ? '' : 's'} importado${creados.length === 1 ? '' : 's'}.`);
    cerrar();
  };

  const marcadasCount = nuevas.filter((f) => marcadas.has(f.linea)).length;

  if (!open) return null;

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
            <h3 className="text-sm font-bold text-text-primary">Importar leads desde un archivo</h3>
            <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-bg-hover focus-ring">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-text-secondary max-w-lg">
                Un CSV con una fila por lead — el que exporta el Excel/Sheet de tu formulario. Solo{' '}
                <strong>nombre</strong> es obligatorio. Entra solo lo que marques.
              </p>
              <Button variant="ghost" onClick={descargarPlantilla}>
                <Download className="h-3.5 w-3.5" /> Descargar plantilla
              </Button>
            </div>

            <label className="surface p-6 flex flex-col items-center gap-2 cursor-pointer border-dashed hover:border-accent/50 transition-colors">
              <FileSpreadsheet className="h-6 w-6 text-text-muted" />
              <span className="text-sm text-text-primary">{nombreArchivo || 'Elegir archivo CSV'}</span>
              <span className="text-xs text-text-muted">Sirve el CSV que exportan Excel o Google Sheets.</span>
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

            {lectura && !lectura.error && <ResumenLectura filas={lectura.filas} />}

            {lectura && !lectura.error && lectura.filas.length > 0 && (
              <div className="rounded-[10px] border border-border-subtle divide-y divide-border-subtle max-h-[38vh] overflow-y-auto">
                {lectura.filas.map((f) => (
                  <FilaLeida key={f.linea} fila={f} marcada={marcadas.has(f.linea)} onToggle={() => alternar(f.linea)} />
                ))}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border-subtle">
            <div className="text-xs text-text-muted">
              {marcadasCount > 0
                ? `${marcadasCount} lead${marcadasCount === 1 ? '' : 's'} ${marcadasCount === 1 ? 'entrará' : 'entrarán'}`
                : 'Nada seleccionado'}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={cerrar} disabled={importando}>Cancelar</Button>
              <Button onClick={() => void importar()} disabled={importando || marcadasCount === 0}>
                <Upload className="h-4 w-4" />
                {importando ? 'Importando…' : 'Importar seleccionados'}
              </Button>
            </div>
          </footer>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ResumenLectura({ filas }: { filas: FilaLeadRevision[] }) {
  const n = (e: FilaLeadRevision['estado']) => filas.filter((f) => f.estado === e).length;
  return (
    <div className="flex gap-2 flex-wrap">
      <Badge tone="success">{n('nueva')} nuevos</Badge>
      {n('existente') > 0 && <Badge tone="neutral">{n('existente')} ya existen</Badge>}
      {n('rechazada') > 0 && <Badge tone="danger">{n('rechazada')} con problemas</Badge>}
    </div>
  );
}

function FilaLeida({ fila, marcada, onToggle }: { fila: FilaLeadRevision; marcada: boolean; onToggle: () => void }) {
  const importable = fila.estado === 'nueva';
  const d = fila.datos;
  return (
    <label className={`flex items-start gap-3 p-3 ${importable ? 'cursor-pointer hover:bg-bg-elevated/50' : 'opacity-55'}`}>
      <input type="checkbox" checked={marcada} onChange={onToggle} disabled={!importable} className="mt-1 accent-[var(--accent)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-primary font-medium truncate">
            {fila.nombreCrudo || <em className="text-text-muted">(sin nombre)</em>}
          </span>
          <span className="text-[11px] text-text-muted">línea {fila.linea}</span>
          {fila.estado === 'existente' && <Badge tone="neutral">Ya existe</Badge>}
          {fila.estado === 'rechazada' && <Badge tone="danger">No entra</Badge>}
        </div>
        {fila.motivo && <div className="text-xs text-text-secondary mt-0.5">{fila.motivo}</div>}
        {importable && d && (
          <div className="text-xs text-text-muted mt-0.5 truncate">
            {[d.telefono, d.email, d.perfilRol].filter(Boolean).join(' · ') || 'Sin datos extra.'}
          </div>
        )}
      </div>
    </label>
  );
}
