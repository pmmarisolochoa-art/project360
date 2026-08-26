import { useState } from 'react';
import { Download, FileSpreadsheet, Lock, Database, Eye } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useClientStore } from '@/store/useClientStore';
import { useLinksStore } from '@/store/useLinksStore';
import { useRopreStore } from '@/store/useRopreStore';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { useTeamStore } from '@/store/useTeamStore';
import { useProgramsStore } from '@/store/useProgramsStore';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { useContentStore } from '@/store/useContentStore';
import { useProjectionStore } from '@/store/useProjectionStore';
import { construirPaquete, diccionarioDeDatos, nombreTraspaso, TABLAS_TRASPASO, avisosDeSeleccion } from '@/utils/traspasoDatos';
import { toast } from '@/store/useToastStore';
import { resolveAssignee } from '@/utils/roleResolver';
import { descargarArchivo } from '@/utils/descargarArchivo';
import { crearZip } from '@/utils/crearZip';
import {
  tablaClientes, tablaTareas, tablaReuniones, tablaEntregables,
  tablaACSV, nombreArchivo, TABLAS_LABEL,
  type ClaveTabla, type Tabla,
} from '@/utils/exportarPortafolio';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Formato = 'excel' | 'csv';
/**
 * Para qué se exporta. Son dos encargos distintos y no un mismo archivo con
 * otro botón: uno lo lee una persona, el otro lo carga un sistema. Mezclarlos
 * da un archivo que no sirve del todo para ninguna de las dos cosas.
 */
type Proposito = 'leer' | 'traspaso';

/**
 * Exportar el portafolio para enviarlo fuera (a Ikigai, a un cliente, a quien sea).
 *
 * Dos formatos porque resuelven cosas distintas:
 *   - Excel: UN archivo con una hoja por tabla. Es lo que se adjunta a un correo.
 *   - CSV: un archivo por tabla. Es lo que se sube a otra herramienta.
 * Las cuatro tablas son las mismas en los dos casos — se arman una sola vez
 * (`exportarPortafolio.ts`) y el formato solo cambia cómo se escriben.
 *
 * Lo privado y las transcripciones no salen por ninguno de los dos. Eso se
 * decide en el módulo de arriba, no aquí, y está cubierto por pruebas.
 */
export function ExportarPortafolioModal({ open, onClose }: Props) {
  const clients = useClientStore((s) => s.clients);
  const tasks = useClientStore((s) => s.tasks);
  const meetings = useClientStore((s) => s.meetings);

  const [marcadas, setMarcadas] = useState<Set<ClaveTabla>>(
    new Set<ClaveTabla>(['clientes', 'tareas', 'reuniones', 'entregables']),
  );
  const [formato, setFormato] = useState<Formato>('excel');
  const [proposito, setProposito] = useState<Proposito>('leer');
  const [incluirContenidoReuniones, setIncluirContenidoReuniones] = useState(false);
  /**
   * Qué tablas van en el paquete. El valor inicial es lo acordado con Ikigai
   * el 26-ago: fuera `programas`, `embudos`, `contenido` y `proyecciones`,
   * que su servidor base ya gestiona. Es un punto de partida, no una regla —
   * el siguiente envío puede ser a otro sitio con otras necesidades.
   */
  const [tablasTraspaso, setTablasTraspaso] = useState<Set<string>>(
    new Set(['clientes', 'tareas', 'reuniones', 'entregables', 'equipo', 'asignaciones', 'ropre', 'fasesEmbudo']),
  );
  /**
   * Los entregables salen del store que hidrata el bootstrap, NO de una
   * consulta propia.
   *
   * La primera versión pedía `TaskLinksRepo.listByClientIds` por su cuenta y
   * pretendía avisar si fallaba — pero ese método se traga el error y devuelve
   * una lista vacía, así que el aviso no podía saltar NUNCA y un fallo se
   * habría leído como "este cliente no tiene entregables". Además abría una
   * segunda fuente de verdad para algo que la app ya tiene cargado. Una sola
   * fuente: la misma que ven las otras tres pantallas de entregables.
   */
  const entregables = useLinksStore((s) => s.links);
  const [exportando, setExportando] = useState(false);

  const alternar = (k: ClaveTabla) =>
    setMarcadas((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });

  const construir = (): Tabla[] => {
    const out: Tabla[] = [];
    if (marcadas.has('clientes')) out.push(tablaClientes(clients, tasks));
    if (marcadas.has('tareas')) out.push(tablaTareas(tasks, clients, resolveAssignee));
    if (marcadas.has('reuniones')) out.push(tablaReuniones(meetings, clients));
    if (marcadas.has('entregables')) out.push(tablaEntregables(entregables, clients));
    return out;
  };

  const cuantas = (k: ClaveTabla): number => {
    if (k === 'clientes') return clients.length;
    if (k === 'tareas') return tasks.filter((t) => !t.esPrivada).length;
    if (k === 'reuniones') return meetings.filter((m) => !m.esPrivada).length;
    return entregables.length;
  };

  /** Los datos de apoyo salen de los mismos stores que hidrata el bootstrap. */
  const ropre = useRopreStore((s) => s.items);
  const equipo = useTeamMembersStore((s) => s.members);
  const asignaciones = useTeamStore((s) => s.assignments);
  const programas = useProgramsStore((s) => s.programs);
  const embudos = useFunnelLaunchStore((s) => s.funnels);
  const fasesEmbudo = useFunnelLaunchStore((s) => s.phases);
  const contenido = useContentStore((s) => s.pieces);
  const proyecciones = useProjectionStore((s) => s.states);

  const exportarTraspaso = async () => {
    setExportando(true);
    const hoy = new Date().toISOString();
    const paquete = construirPaquete(
      {
        clientes: clients, tareas: tasks, reuniones: meetings, entregables,
        equipo, asignaciones, ropre, programas, embudos, fasesEmbudo, contenido,
        proyecciones: proyecciones as Record<string, unknown>,
      },
      { incluirContenidoReuniones, tablas: [...tablasTraspaso] },
      hoy,
    );
    const nombreJSON = nombreTraspaso(hoy, 'json');
    /**
     * Van los datos Y el documento que los explica. Un JSON sin diccionario
     * obliga a quien lo recibe a deducir qué es cada campo, y deducir es
     * exactamente donde se meten los errores de importación.
     *
     * Van dentro de UN zip porque Chrome bloquea la segunda descarga
     * automática: al bajarlos sueltos llegaba solo el JSON, y el LEEME —que
     * es la mitad del entregable— se perdía en silencio.
     */
    try {
      const zip = await crearZip({
        [nombreJSON]: JSON.stringify(paquete, null, 2),
        'LEEME.md': diccionarioDeDatos(paquete, nombreJSON),
      });
      descargarArchivo(zip, nombreTraspaso(hoy, 'zip'));
      const total = Object.values((paquete._meta as { conteos: Record<string, number> }).conteos)
        .reduce((a, b) => a + b, 0);
      toast.success(`Paquete listo: ${total} registros + el documento que los explica.`);
      onClose();
    } catch (e) {
      toast.error(`No se pudo generar el paquete: ${(e as Error).message}`);
    } finally {
      setExportando(false);
    }
  };

  /** Lo que va a llevar el paquete, para poder mirarlo ANTES de generarlo. */
  const filasPorTabla: Record<string, number> = {
    clientes: clients.length,
    tareas: tasks.filter((t) => !t.esPrivada).length,
    reuniones: meetings.filter((m) => !m.esPrivada).length,
    entregables: entregables.length,
    equipo: equipo.length,
    asignaciones: asignaciones.length,
    ropre: ropre.length,
    programas: programas.length,
    embudos: embudos.length,
    fasesEmbudo: fasesEmbudo.length,
    contenido: contenido.length,
    proyecciones: Object.keys(proyecciones).length,
  };
  const totalRegistros = [...tablasTraspaso].reduce((a, t) => a + (filasPorTabla[t] ?? 0), 0);
  const avisos = avisosDeSeleccion([...tablasTraspaso]);

  const alternarTabla = (t: string) =>
    setTablasTraspaso((prev) => {
      const s = new Set(prev);
      if (s.has(t)) s.delete(t);
      else s.add(t);
      return s;
    });

  const exportar = async () => {
    const tablas = construir();
    if (tablas.length === 0) return;
    setExportando(true);
    const hoy = new Date().toISOString();

    try {
      if (formato === 'csv') {
        // El BOM hace que Excel abra los acentos bien. Sin él, "Bogotá" llega
        // como "BogotÃ¡" y parece que los datos están corruptos.
        const conBom = (t: Tabla) => '﻿' + tablaACSV(t);
        if (tablas.length === 1) {
          descargarArchivo(
            new Blob([conBom(tablas[0])], { type: 'text/csv;charset=utf-8' }),
            nombreArchivo(tablas[0].nombre, hoy, 'csv'),
          );
          toast.success('1 archivo descargado.');
        } else {
          // Varias tablas = varios CSV, y Chrome solo deja bajar el primero.
          // Un zip y ya. (Ver `crearZip`.)
          const zip = await crearZip(
            Object.fromEntries(tablas.map((t) => [nombreArchivo(t.nombre, hoy, 'csv'), conBom(t)])),
          );
          descargarArchivo(zip, nombreArchivo('CSV', hoy, 'zip'));
          toast.success(`${tablas.length} tablas en un zip.`);
        }
      } else {
        // xlsx pesa ~400 KB: se baja solo cuando alguien exporta, no en el
        // arranque de la app. Mismo criterio que el resto de las librerías
        // pesadas desde el code-splitting del 3-ago.
        const XLSX = await import('xlsx');
        const libro = XLSX.utils.book_new();
        tablas.forEach((t) => {
          const hoja = XLSX.utils.aoa_to_sheet([t.columnas, ...t.filas]);
          XLSX.utils.book_append_sheet(libro, hoja, t.nombre.slice(0, 31));
        });
        const buffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });
        descargarArchivo(
          new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          nombreArchivo('Portafolio', hoy, 'xlsx'),
        );
        toast.success(`Archivo descargado con ${tablas.length} hoja${tablas.length === 1 ? '' : 's'}.`);
      }
      onClose();
    } catch (e) {
      // Si la descarga falla, se dice. Un botón que no hace nada y no explica
      // por qué es exactamente el fallo que se retiró de Planeación (R-48).
      toast.error(`No se pudo generar el archivo: ${(e as Error).message}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Exportar el portafolio"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-xs text-text-muted">
            {proposito === 'traspaso'
              ? tablasTraspaso.size === 0
                ? 'Ninguna tabla seleccionada'
                : `${tablasTraspaso.size} tablas · 2 archivos`
              : marcadas.size === 0
                ? 'Nada seleccionado'
                : formato === 'excel'
                  ? `1 archivo · ${marcadas.size} hoja${marcadas.size === 1 ? '' : 's'}`
                  : `${marcadas.size} archivo${marcadas.size === 1 ? '' : 's'} CSV`}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={exportando}>
              Cancelar
            </Button>
            <Button
              onClick={() => void (proposito === 'traspaso' ? exportarTraspaso() : exportar())}
              disabled={
                exportando ||
                (proposito === 'leer' ? marcadas.size === 0 : tablasTraspaso.size === 0)
              }
            >
              <Download className="h-4 w-4" />
              {exportando ? 'Generando…' : 'Descargar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <OpcionGrande
            activo={proposito === 'leer'}
            onClick={() => setProposito('leer')}
            icono={<Eye className="h-4 w-4" />}
            titulo="Para leer"
            detalle="Tablas en español, sin tecnicismos. Para revisar, filtrar o adjuntar a un correo."
          />
          <OpcionGrande
            activo={proposito === 'traspaso'}
            onClick={() => setProposito('traspaso')}
            icono={<Database className="h-4 w-4" />}
            titulo="Para cargar en otro sistema"
            detalle="Los datos completos con sus identificadores, más el documento que explica cada campo."
          />
        </div>

        {proposito === 'leer' && (
        <div className="space-y-1.5">
          {(Object.keys(TABLAS_LABEL) as ClaveTabla[]).map((k) => {
            const n = cuantas(k);
            return (
              <label
                key={k}
                className="flex items-center gap-3 p-2.5 rounded-[10px] border border-border-subtle cursor-pointer hover:bg-bg-elevated/50"
              >
                <input
                  type="checkbox"
                  checked={marcadas.has(k)}
                  onChange={() => alternar(k)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm text-text-primary flex-1">{TABLAS_LABEL[k]}</span>
                <span className="text-xs text-text-muted">
                  {n} fila{n === 1 ? '' : 's'}
                </span>
              </label>
            );
          })}
        </div>
        )}

        {proposito === 'leer' && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted mb-1.5">Formato</div>
          <div className="grid grid-cols-2 gap-2">
            <OpcionFormato
              activo={formato === 'excel'}
              onClick={() => setFormato('excel')}
              titulo="Excel (.xlsx)"
              detalle="Un solo archivo, una hoja por tabla. Es lo que se adjunta a un correo."
            />
            <OpcionFormato
              activo={formato === 'csv'}
              onClick={() => setFormato('csv')}
              titulo="CSV"
              detalle="Un archivo por tabla. Para subirlo a otra herramienta."
            />
          </div>
        </div>
        )}

        {proposito === 'traspaso' && (
          <div className="space-y-3">
            <div className="rounded-[10px] border border-border-subtle p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted mb-2">
                Tablas que se envían · {totalRegistros} registros
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {TABLAS_TRASPASO.map((t) => (
                  <label key={t} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tablasTraspaso.has(t)}
                      onChange={() => alternarTabla(t)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-xs text-text-secondary flex-1">{t}</span>
                    <span className="text-xs text-text-muted tabular-nums">{filasPorTabla[t] ?? 0}</span>
                  </label>
                ))}
              </div>
            </div>

            {avisos.length > 0 && (
              <div className="rounded-[10px] border border-warning/40 bg-warning/10 p-3 text-xs text-text-secondary space-y-1">
                {avisos.map((a) => (
                  <div key={a}>{a.replace(/`/g, '')}</div>
                ))}
              </div>
            )}

            <label className="flex items-start gap-3 p-3 rounded-[10px] border border-border-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={incluirContenidoReuniones}
                onChange={(e) => setIncluirContenidoReuniones(e.target.checked)}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span className="text-xs text-text-secondary">
                <strong className="text-text-primary">Incluir el contenido de las reuniones</strong> —
                transcripciones, notas y resúmenes. Apagado por defecto: la agenda dice que hubo
                una reunión; lo que se dijo dentro solo sale si lo pides.
              </span>
            </label>

            <div className="text-xs text-text-secondary">
              Bajan <strong className="text-text-primary">dos archivos</strong>: el <code>.json</code> con
              los datos y un <code>.md</code> que explica cada tabla, cada campo y las relaciones entre
              ellas. Ese segundo archivo es el que necesita quien vaya a importarlos.
            </div>
          </div>
        )}

        <div className="rounded-[10px] border border-border-subtle p-3 text-xs text-text-secondary flex gap-2">
          <Lock className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
          <span>
            <strong className="text-text-primary">No sale nada privado.</strong> Las tareas y reuniones
            marcadas como privadas se quedan fuera, y de las reuniones sale la agenda —
            nunca la transcripción, las notas ni el resumen.
          </span>
        </div>
      </div>
    </Modal>
  );
}

function OpcionGrande({
  activo, onClick, icono, titulo, detalle,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-[10px] border transition-colors ${
        activo ? 'border-accent bg-accent/10' : 'border-border-subtle hover:bg-bg-elevated/50'
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm text-text-primary font-medium">
        {icono} {titulo}
      </div>
      <div className="text-[11px] text-text-muted mt-1 leading-snug">{detalle}</div>
    </button>
  );
}

function OpcionFormato({
  activo, onClick, titulo, detalle,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-[10px] border transition-colors ${
        activo ? 'border-accent bg-accent/10' : 'border-border-subtle hover:bg-bg-elevated/50'
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm text-text-primary font-medium">
        <FileSpreadsheet className="h-3.5 w-3.5" /> {titulo}
      </div>
      <div className="text-[11px] text-text-muted mt-1 leading-snug">{detalle}</div>
    </button>
  );
}
