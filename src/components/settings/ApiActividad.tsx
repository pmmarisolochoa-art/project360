/**
 * Configuración → API y Desarrolladores → pestaña "Actividad".
 *
 * Es la ventana al audit log: qué llamó a la API, cuándo, desde dónde y cómo
 * salió. Sirve para dos cosas muy distintas y las dos importan:
 *
 *   · Depurar. Cuando Paralelo diga "no me funciona", acá está el 400 exacto
 *     con su hora, en vez de una conversación a ciegas.
 *   · Vigilar. Una ráfaga de rechazos seguidos es la señal de que alguien está
 *     probando llaves — y sin este panel nadie se enteraría nunca.
 */

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  listarActividad,
  resumenActividad,
  detectarAlertas,
  type ApiKeyRow,
  type ApiRequestRow,
  type Alerta,
  type ResumenActividad,
} from '@/services/apiKeys';

const hora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** Color del estado. Los errores tienen que saltar a la vista, no leerse. */
function tonoDeEstado(code: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (code === null) return 'neutral';
  if (code >= 500) return 'danger';
  if (code === 429) return 'warning';
  if (code >= 400) return 'danger';
  return 'success';
}

export function ApiActividad({ keys }: { keys: ApiKeyRow[] }) {
  const [filas, setFilas] = useState<ApiRequestRow[]>([]);
  const [resumen, setResumen] = useState<ResumenActividad | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [keyId, setKeyId] = useState('');
  const [soloErrores, setSoloErrores] = useState(false);
  const [cargando, setCargando] = useState(true);

  const nombreDeKey = useCallback(
    (id: string | null) => {
      if (!id) return '—';
      const k = keys.find((x) => x.id === id);
      return k ? `${k.nombre} (${k.key_prefix}…)` : 'Llave borrada';
    },
    [keys],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await listarActividad({
        keyId: keyId || undefined,
        soloErrores,
        limite: 100,
      });
      setFilas(datos);

      // Las alertas se calculan SIEMPRE sobre las llamadas sin filtrar: si se
      // miraran solo las de la llave elegida, un ataque contra otra pasaría
      // desapercibido justo mientras se está mirando el panel.
      const todas = keyId || soloErrores ? await listarActividad({ limite: 100 }) : datos;
      setAlertas(detectarAlertas(todas));

      setResumen(await resumenActividad(keys.filter((k) => k.activa).length));
    } catch (e) {
      console.warn('[api-actividad] no se pudo cargar', e);
    } finally {
      setCargando(false);
    }
  }, [keyId, soloErrores, keys]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-4">
      {/* ── Resumen del día ── */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tarjeta etiqueta="Llamadas hoy" valor={String(resumen.llamadasHoy)} />
          <Tarjeta etiqueta="Errores hoy" valor={String(resumen.erroresHoy)} alerta={resumen.erroresHoy > 0} />
          <Tarjeta
            etiqueta="% de errores"
            valor={`${resumen.porcentajeErrores}%`}
            alerta={resumen.porcentajeErrores >= 20}
          />
          <Tarjeta etiqueta="Llaves activas" valor={String(resumen.keysActivas)} />
        </div>
      )}

      {/* ── Alertas ── */}
      {alertas.map((a, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 ${
            a.tipo === 'posible_ataque'
              ? 'border-red-500/40 bg-red-500/10'
              : 'border-amber-500/40 bg-amber-500/10'
          }`}
        >
          {a.tipo === 'posible_ataque' ? (
            <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <div className="font-medium">
              {a.tipo === 'posible_ataque' ? 'Posible intento de acceso' : 'Límite de llamadas alcanzado'}
              {' — '}
              <span className="text-text-secondary font-normal">{nombreDeKey(a.keyId)}</span>
            </div>
            <p className="text-text-secondary text-xs mt-0.5">{a.mensaje}</p>
          </div>
        </div>
      ))}

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Llave"
          className="min-w-[220px]"
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          options={[
            { value: '', label: 'Todas las llaves' },
            ...keys.map((k) => ({ value: k.id, label: `${k.nombre} (${k.key_prefix}…)` })),
          ]}
        />
        <label className="flex items-center gap-2 text-sm h-10 cursor-pointer">
          <input
            type="checkbox"
            checked={soloErrores}
            onChange={(e) => setSoloErrores(e.target.checked)}
            className="accent-[var(--accent-primary)]"
          />
          Solo errores
        </label>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void cargar()}
          loading={cargando}
        >
          Actualizar
        </Button>
      </div>

      {/* ── Tabla ── */}
      {cargando && filas.length === 0 ? (
        <p className="text-sm text-text-muted py-4">Cargando…</p>
      ) : filas.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border-subtle px-4 py-8 text-center">
          <Activity className="h-5 w-5 mx-auto text-text-muted mb-2" />
          <p className="text-sm text-text-secondary">
            {soloErrores || keyId ? 'Sin llamadas que coincidan con el filtro.' : 'Todavía nadie ha llamado a la API.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
                <th className="text-left font-medium py-2 pr-3">Fecha</th>
                <th className="text-left font-medium py-2 pr-3">Llave</th>
                <th className="text-left font-medium py-2 pr-3">Endpoint</th>
                <th className="text-left font-medium py-2 pr-3">Estado</th>
                <th className="text-left font-medium py-2 pr-3">IP</th>
                <th className="text-right font-medium py-2">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b border-border-subtle/60 last:border-0">
                  <td className="py-2 pr-3 text-text-secondary whitespace-nowrap">{hora(f.created_at)}</td>
                  <td className="py-2 pr-3 text-text-secondary">{nombreDeKey(f.api_key_id)}</td>
                  <td className="py-2 pr-3">
                    <code className="text-[11px]">
                      <span className="text-text-muted">{f.metodo}</span> {f.endpoint}
                    </code>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={tonoDeEstado(f.status_code)}>{f.status_code ?? '—'}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-text-muted text-[11px]">{f.ip_address ?? '—'}</td>
                  <td className="py-2 text-right text-text-secondary tabular-nums">
                    {f.response_time_ms != null ? `${f.response_time_ms} ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-text-muted mt-2">
            Mostrando las {filas.length} llamadas más recientes.
          </p>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ etiqueta, valor, alerta }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-[10px] border border-border-subtle px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-text-muted">{etiqueta}</div>
      <div className={`text-xl font-semibold mt-0.5 ${alerta ? 'text-red-500' : ''}`}>{valor}</div>
    </div>
  );
}
