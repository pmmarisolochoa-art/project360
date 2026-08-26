import { useMemo, useRef, useState } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useClientStore } from '@/store/useClientStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { ClientsRepo } from '@/services/repositories';
import { descargarArchivo } from '@/utils/descargarArchivo';
import type { Client } from '@/types/client';
import {
  leerClientesCSV,
  construirClienteDesdeFila,
  CSV_PLANTILLA,
  type FilaRevision,
  type LecturaCSV,
} from '@/utils/csvClientes';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Bandeja de revisión para importar clientes desde un CSV.
 *
 * NO es un botón de "sincronizar": el archivo se lee, se muestra lo que trae y
 * solo entra lo que la persona marca (R-23). Lo que ya existe sale en gris en
 * vez de esconderse (R-24) y lo rechazado sale con su motivo y su número de
 * línea (R-33), para poder arreglar el archivo y volver a subirlo.
 */
export function ImportarClientesCSVModal({ open, onClose }: Props) {
  const registrar = useClientStore((s) => s.registrarClientesGuardados);
  const agencyId = useAuthStore((s) => s.agencyId);

  const [nombreArchivo, setNombreArchivo] = useState('');
  const [lectura, setLectura] = useState<LecturaCSV | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [importando, setImportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const nuevas = useMemo(
    () => (lectura?.filas ?? []).filter((f) => f.estado === 'nueva'),
    [lectura],
  );

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
    // `clients` sale del store, así que al releer tras una importación parcial
    // lo ya creado aparece como "ya existe" en vez de ofrecerse otra vez.
    const res = leerClientesCSV(texto, useClientStore.getState().clients);
    setLectura(res);
    // Lo importable viene marcado por defecto: es lo que se quiere casi
    // siempre, y se puede desmarcar. Lo rechazado y lo existente no se pueden
    // marcar, así que no hay forma de meterlos sin querer.
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
    // El BOM hace que Excel abra los acentos bien.
    descargarArchivo(
      new Blob(['﻿' + CSV_PLANTILLA], { type: 'text/csv;charset=utf-8' }),
      'plantilla-clientes.csv',
    );
  };

  const importar = async () => {
    const aImportar = nuevas.filter((f) => marcadas.has(f.linea));
    if (aImportar.length === 0) return;
    setImportando(true);

    const creados: Client[] = [];
    const fallos: Array<{ nombre: string; motivo: string }> = [];

    // Secuencial y esperando cada escritura: es un lote pequeño (decenas de
    // filas) y así sabemos exactamente cuál entró y cuál no. Una escritura
    // optimista dejaría el lote a medias sin manera de contarlo (R-33).
    for (const fila of aImportar) {
      const cliente = construirClienteDesdeFila(fila.datos!, agencyId ?? 'a_1');
      try {
        creados.push(await ClientsRepo.create(cliente));
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
      // El modal se queda abierto: quien mira necesita ver qué falta. Se
      // relee el archivo para que lo creado pase a "ya existe" y no se
      // reintente encima.
      const file = inputRef.current?.files?.[0];
      if (creados.length && file) await leerArchivo(file);
      return;
    }

    toast.success(
      `${creados.length} cliente${creados.length === 1 ? '' : 's'} importado${creados.length === 1 ? '' : 's'}.`,
    );
    cerrar();
  };

  const marcadasCount = nuevas.filter((f) => marcadas.has(f.linea)).length;

  return (
    <Modal
      open={open}
      onClose={cerrar}
      size="lg"
      title="Importar clientes desde un archivo"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-xs text-text-muted">
            {marcadasCount > 0
              ? `${marcadasCount} cliente${marcadasCount === 1 ? '' : 's'} ${marcadasCount === 1 ? 'entrará' : 'entrarán'}`
              : 'Nada seleccionado'}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={cerrar} disabled={importando}>
              Cancelar
            </Button>
            <Button onClick={() => void importar()} disabled={importando || marcadasCount === 0}>
              <Upload className="h-4 w-4" />
              {importando ? 'Importando…' : 'Importar seleccionados'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-text-secondary max-w-lg">
            Un archivo CSV con una fila por cliente. Solo <strong>nombre</strong> es obligatorio;
            lo que no venga se queda vacío y se completa después. Entra solo lo que marques.
          </p>
          <Button variant="ghost" onClick={descargarPlantilla}>
            <Download className="h-3.5 w-3.5" /> Descargar plantilla
          </Button>
        </div>

        <label className="surface p-6 flex flex-col items-center gap-2 cursor-pointer border-dashed hover:border-accent/50 transition-colors">
          <FileSpreadsheet className="h-6 w-6 text-text-muted" />
          <span className="text-sm text-text-primary">{nombreArchivo || 'Elegir archivo CSV'}</span>
          <span className="text-xs text-text-muted">
            Sirve el CSV que exportan Excel o Google Sheets.
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void leerArchivo(e.target.files?.[0])}
          />
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
              <FilaLeida
                key={f.linea}
                fila={f}
                marcada={marcadas.has(f.linea)}
                onToggle={() => alternar(f.linea)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ResumenLectura({ filas }: { filas: FilaRevision[] }) {
  const n = (e: FilaRevision['estado']) => filas.filter((f) => f.estado === e).length;
  return (
    <div className="flex gap-2 flex-wrap">
      <Badge tone="success">{n('nueva')} nuevos</Badge>
      {n('existente') > 0 && <Badge tone="neutral">{n('existente')} ya existen</Badge>}
      {n('rechazada') > 0 && <Badge tone="danger">{n('rechazada')} con problemas</Badge>}
    </div>
  );
}

function FilaLeida({
  fila,
  marcada,
  onToggle,
}: {
  fila: FilaRevision;
  marcada: boolean;
  onToggle: () => void;
}) {
  const importable = fila.estado === 'nueva';
  const d = fila.datos;
  return (
    <label
      className={`flex items-start gap-3 p-3 ${importable ? 'cursor-pointer hover:bg-bg-elevated/50' : 'opacity-55'}`}
    >
      <input
        type="checkbox"
        checked={marcada}
        onChange={onToggle}
        disabled={!importable}
        className="mt-1 accent-[var(--accent)]"
      />
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
            {[d.industria, d.ciudad, d.email, d.presupuestoAds ? `$${d.presupuestoAds}/mes` : '']
              .filter(Boolean)
              .join(' · ') || 'Sin datos extra — se completan después.'}
          </div>
        )}
      </div>
    </label>
  );
}
