/**
 * Bandeja de importación de Paralelo.
 *
 * Se abre desde la Agenda del cliente y muestra lo que Paralelo tiene para él:
 * qué reuniones hay, qué tareas trae cada una y a quién quedarían asignadas.
 *
 * Es una bandeja de REVISIÓN, no un botón de sincronizar. Nada entra sin que
 * alguien lo marque: los responsables salen de una transcripción y no siempre
 * aciertan, y una importación automática metería tareas mal asignadas en la
 * semana del equipo sin que nadie las hubiera visto.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/useToastStore';
import {
  traerReunionesParalelo,
  importarReunionesParalelo,
  type ReunionParaleloConEstado,
  type DiagnosticoParalelo,
} from '@/services/paralelo';

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clienteNombre: string;
  projectId: string;
}

export function ParaleloImportModal({ open, onClose, clientId, clienteNombre, projectId }: Props) {
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reuniones, setReuniones] = useState<ReunionParaleloConEstado[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoParalelo | undefined>();
  const [verDiag, setVerDiag] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { reuniones: rs, diagnostico: d } = await traerReunionesParalelo(projectId);
      setReuniones(rs);
      setDiagnostico(d);
      // Se premarca lo nuevo: es lo que se quiere el 99% de las veces, y
      // desmarcar lo que sobra cuesta menos que marcar de a una.
      setMarcadas(new Set(rs.filter((r) => !r.yaImportada).map((r) => r.externalId)));
    } catch (e) {
      setError((e as Error).message);
      setReuniones([]);
    } finally {
      setCargando(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void cargar();
  }, [open, cargar]);

  const pendientes = useMemo(() => reuniones.filter((r) => !r.yaImportada), [reuniones]);
  const yaImportadas = useMemo(() => reuniones.filter((r) => r.yaImportada), [reuniones]);
  const tareasMarcadas = useMemo(
    () => reuniones.filter((r) => marcadas.has(r.externalId)).reduce((n, r) => n + r.tareas.length, 0),
    [reuniones, marcadas],
  );

  const alternar = (externalId: string) =>
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });

  const importar = async () => {
    const seleccionadas = reuniones.filter((r) => marcadas.has(r.externalId) && !r.yaImportada);
    if (!seleccionadas.length) return;

    setImportando(true);
    try {
      const res = await importarReunionesParalelo(clientId, seleccionadas);

      if (res.fallos.length) {
        // Un fallo se dice con nombre y motivo. "Se importaron algunas" deja a
        // quien mira sin saber cuáles faltan ni si debe reintentar.
        toast.error(
          `Importadas ${res.reunionesCreadas}, fallaron ${res.fallos.length}: ` +
            res.fallos.map((f) => `${f.titulo} (${f.motivo})`).join(' · '),
        );
      } else {
        toast.success(
          `${res.reunionesCreadas} reunion${res.reunionesCreadas === 1 ? '' : 'es'} y ` +
            `${res.tareasCreadas} tarea${res.tareasCreadas === 1 ? '' : 's'} importadas.`,
        );
      }

      if (res.reunionesCreadas > 0) onClose();
      else await cargar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportando(false);
    }
  };

  const marcadasPendientes = pendientes.filter((r) => marcadas.has(r.externalId)).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Importar reuniones de Paralelo — ${clienteNombre}`}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-xs text-text-muted">
            {marcadasPendientes > 0
              ? `${marcadasPendientes} reunión${marcadasPendientes === 1 ? '' : 'es'} · ${tareasMarcadas} tarea${tareasMarcadas === 1 ? '' : 's'} entrarán`
              : 'Nada seleccionado'}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={importando}>
              Cancelar
            </Button>
            <Button onClick={importar} disabled={importando || marcadasPendientes === 0}>
              <Download className="h-4 w-4" />
              {importando ? 'Importando…' : 'Importar seleccionadas'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-text-secondary">
            Solo entra lo que marques. Los responsables salen de la transcripción — revísalos.
          </p>
          <Button variant="ghost" onClick={() => void cargar()} disabled={cargando}>
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>

        {error && (
          <div className="rounded-[10px] border border-danger/40 bg-danger/10 p-3 text-sm text-text-primary flex gap-2">
            <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {cargando && <div className="text-sm text-text-muted py-6 text-center">Consultando a Paralelo…</div>}

        {!cargando && !error && reuniones.length === 0 && (
          <div className="surface p-8 text-center">
            <div className="text-text-secondary text-sm">No hay reuniones nuevas en Paralelo.</div>
            <div className="text-text-muted text-xs mt-1">
              Se miran los últimos días. Si acabas de tener una, Paralelo puede tardar en procesarla.
            </div>

            {/* Vacío puede ser "no hay nada" o "algo se está comiendo las reuniones".
                El conteo por escalón distingue las dos sin abrir el inspector. */}
            {diagnostico && (
              <div className="mt-4 text-left">
                <button
                  type="button"
                  onClick={() => setVerDiag((v) => !v)}
                  className="text-xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1"
                >
                  Detalle técnico
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verDiag ? 'rotate-180' : ''}`} />
                </button>
                {verDiag && (
                  <dl className="mt-2 rounded-[8px] border border-border-subtle p-3 space-y-1">
                    {Object.entries(diagnostico).map(([k, v]) => (
                      <div key={k} className="flex gap-3 text-xs">
                        <dt className="text-text-muted min-w-[11rem]">{k}</dt>
                        <dd className="text-text-primary break-all">
                          {Array.isArray(v) ? v.join(', ') || '—' : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </div>
        )}

        {pendientes.map((r) => {
          const marcada = marcadas.has(r.externalId);
          const desplegada = abierta === r.externalId;
          return (
            <div
              key={r.externalId}
              className={`rounded-[10px] border p-3 transition-colors ${
                marcada ? 'border-accent/50 bg-accent/5' : 'border-border-subtle bg-bg-base/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={() => alternar(r.externalId)}
                  className="mt-1 h-4 w-4 shrink-0 accent-current cursor-pointer"
                  aria-label={`Importar ${r.titulo}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text-primary truncate">{r.titulo}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {r.fecha ? format(parseISO(r.fecha), "d 'de' MMMM, HH:mm", { locale: es }) : 'Sin fecha'}
                    {' · '}
                    {r.duracionMin} min
                    {' · '}
                    {r.tareas.length} tarea{r.tareas.length === 1 ? '' : 's'}
                  </div>
                  {!r.tieneReporte && (
                    <div className="text-xs text-warning mt-1">
                      Paralelo aún no generó el reporte: entraría sin resumen ni tareas.
                    </div>
                  )}
                </div>
                {r.tareas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAbierta(desplegada ? null : r.externalId)}
                    className="text-xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1 shrink-0"
                  >
                    Ver tareas
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${desplegada ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {desplegada && (
                <ul className="mt-3 pl-7 space-y-2 border-t border-border-subtle pt-3">
                  {r.tareas.map((t) => (
                    <li key={t.externalId} className="text-xs">
                      <div className="text-text-primary">{t.titulo}</div>
                      <div className="text-text-muted mt-0.5 flex flex-wrap gap-x-2 gap-y-1 items-center">
                        <Badge tone={t.prioridad === 'P1' ? 'danger' : t.prioridad === 'P3' ? 'neutral' : 'warning'}>
                          {t.prioridad}
                        </Badge>
                        <span>{t.responsables.length ? t.responsables.join(', ') : 'Sin asignar'}</span>
                        {t.plazoTexto && <span>· plazo dicho: “{t.plazoTexto}”</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {yaImportadas.length > 0 && (
          <div className="pt-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Ya importadas ({yaImportadas.length})
            </div>
            <div className="space-y-1.5">
              {yaImportadas.map((r) => (
                <div
                  key={r.externalId}
                  className="flex items-center gap-2 text-xs text-text-muted rounded-[8px] border border-border-subtle px-3 py-2"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  <span className="truncate">{r.titulo}</span>
                  <span className="ml-auto shrink-0">
                    {r.fecha ? format(parseISO(r.fecha), 'd MMM', { locale: es }) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
