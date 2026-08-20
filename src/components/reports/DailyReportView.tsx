/**
 * Reporte de la Daily, en pantalla.
 *
 * Se lee de arriba abajo y en ese orden a propósito: primero el pulso y las
 * alertas —lo que hace que alguien actúe hoy—, después los números, y al final
 * el detalle de tareas. Quien solo mire los primeros cinco centímetros ya sabe
 * si tiene que hacer algo.
 *
 * Los HECHOS y la LECTURA se distinguen a simple vista: lo que sale de la base
 * va en tarjetas y tablas; lo que interpretó la IA lleva su marca. Si algún día
 * la IA se equivoca, hay que poder saber de un vistazo qué parte es opinión.
 */

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Sparkles, CheckCircle2, Clock, Plus, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { lineaDeAlerta, type ReporteDaily, type FilaSeguimiento } from '@/services/reports/dailyReport';

const ESTADO_TAREA: Record<
  FilaSeguimiento['estado'],
  { label: string; tone: 'success' | 'info' | 'danger' | 'neutral' }
> = {
  completada: { label: '✅ Completada', tone: 'success' },
  en_progreso: { label: '⏳ En progreso', tone: 'info' },
  vencida: { label: '❌ Vencida', tone: 'danger' },
  pendiente: { label: 'Pendiente', tone: 'neutral' },
};

const ESTADO_PERSONA: Record<string, 'success' | 'warning' | 'neutral'> = {
  Disponible: 'success',
  'Con bloqueante': 'warning',
  Ausente: 'neutral',
};

export function DailyReportView({ r }: { r: ReporteDaily }) {
  const alerta = lineaDeAlerta(r.vencidas);
  const fecha = parseISO(r.fecha);

  return (
    <div className="space-y-4">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Reporte de la Daily</div>
        <h3 className="heading text-lg font-bold capitalize">
          {r.diaSemana} {format(fecha, "d 'de' MMMM", { locale: es })}
        </h3>
        <p className="text-xs text-text-muted mt-0.5">
          {r.duracionMin} min
          {r.participantes.length > 0 && ` · ${r.participantes.length} participantes`}
          {r.dailyAnterior &&
            ` · compara con la del ${format(parseISO(r.dailyAnterior.fecha), 'd MMM', { locale: es })}`}
        </p>
      </div>

      {/* ── Pulso: lo primero que se lee ─────────────────────────────────── */}
      {r.pulso ? (
        <div
          className={`rounded-[12px] border p-4 ${
            r.vencidas > 0 || r.alertas.length > 0
              ? 'border-warning/40 bg-warning/5'
              : 'border-success/40 bg-success/5'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
            <Activity className="h-3 w-3" /> Pulso general
            <span className="ml-0.5 inline-flex" title="Escrito por la IA a partir de la reunión">
              <Sparkles className="h-3 w-3" />
            </span>
          </div>
          <p className="text-sm text-text-primary leading-relaxed">{r.pulso}</p>
        </div>
      ) : (
        <div className="rounded-[12px] border border-border-subtle p-3 text-xs text-text-muted">
          Sin pulso: la lectura de la reunión no se pudo generar. Los datos de tareas de abajo sí son
          correctos.
        </div>
      )}

      {/* ── Alertas ──────────────────────────────────────────────────────── */}
      {(alerta || r.alertas.length > 0) && (
        <div className="rounded-[12px] border border-danger/40 bg-danger/5 p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-danger">
            <AlertTriangle className="h-3 w-3" /> Alertas y urgencias
          </div>
          {alerta && <p className="text-sm font-semibold text-text-primary">{alerta}</p>}
          {r.alertas.map((a, i) => (
            <p key={i} className="text-sm text-text-primary flex gap-2">
              <span className="text-danger">·</span> {a}
            </p>
          ))}
        </div>
      )}

      {/* ── Números ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Cifra label="Venían de la anterior" valor={r.seguimiento.length} icon={<Clock className="h-3.5 w-3.5" />} />
        <Cifra
          label="Completadas"
          valor={r.seguimiento.filter((s) => s.estado === 'completada').length}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          tono="success"
        />
        <Cifra label="Vencidas" valor={r.vencidas} icon={<AlertTriangle className="h-3.5 w-3.5" />} tono={r.vencidas > 0 ? 'danger' : 'neutral'} />
        <Cifra label="Nuevas hoy" valor={r.nuevas.length} icon={<Plus className="h-3.5 w-3.5" />} tono="info" />
      </div>

      {/* ── Estado del equipo ────────────────────────────────────────────── */}
      {r.estadoEquipo.length > 0 && (
        <Seccion titulo="Estado del equipo" deIA>
          <div className="flex flex-wrap gap-2">
            {r.estadoEquipo.map((p, i) => (
              <div key={i} className="rounded-[10px] border border-border-subtle px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{p.persona}</span>
                  <Badge tone={ESTADO_PERSONA[p.estado] ?? 'neutral'}>{p.estado}</Badge>
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {p.area}
                  {p.observacion && ` · ${p.observacion}`}
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* ── Prioridades por área ─────────────────────────────────────────── */}
      {r.prioridades.length > 0 && (
        <Seccion titulo="Prioridades" deIA>
          <div className="grid gap-2 md:grid-cols-2">
            {r.prioridades.map((p, i) => {
              const sinDatos = p.items.length === 1 && /no mencionad/i.test(p.items[0]);
              return (
                <div key={i} className="rounded-[10px] border border-border-subtle p-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{p.area}</div>
                  {sinDatos ? (
                    <div className="text-xs text-text-muted italic">No se mencionó en esta daily</div>
                  ) : (
                    <ol className="space-y-1">
                      {p.items.map((it, j) => (
                        <li key={j} className="text-sm text-text-primary flex gap-2">
                          <span className="text-text-muted">{j + 1}.</span> {it}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </Seccion>
      )}

      {/* ── Seguimiento de la daily anterior ─────────────────────────────── */}
      <Seccion
        titulo={
          r.dailyAnterior
            ? `Tareas de la daily del ${format(parseISO(r.dailyAnterior.fecha), 'd MMM', { locale: es })}`
            : 'Seguimiento'
        }
      >
        {r.seguimiento.length === 0 ? (
          <VacioTexto>
            {r.dailyAnterior
              ? 'La daily anterior no dejó tareas registradas.'
              : 'Es la primera daily registrada: no hay con qué comparar todavía.'}
          </VacioTexto>
        ) : (
          <TablaTareas filas={r.seguimiento} conAtraso />
        )}
      </Seccion>

      {/* ── Nuevas de hoy ────────────────────────────────────────────────── */}
      <Seccion titulo="Nuevas tareas asignadas hoy">
        {r.nuevas.length === 0 ? (
          <VacioTexto>Esta daily no generó tareas nuevas.</VacioTexto>
        ) : (
          <TablaTareas filas={r.nuevas} />
        )}
      </Seccion>
    </div>
  );
}

/* ── Piezas ────────────────────────────────────────────────────────────────*/

function Seccion({
  titulo,
  deIA = false,
  children,
}: {
  titulo: string;
  /** Marca las secciones que interpretó la IA, para no confundirlas con datos. */
  deIA?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold">{titulo}</h4>
        {deIA && (
          <span
            className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-text-muted"
            title="Interpretado por la IA a partir de lo que se dijo en la reunión"
          >
            <Sparkles className="h-2.5 w-2.5" /> lectura
          </span>
        )}
        <div className="flex-1 h-px bg-border-subtle" />
      </div>
      {children}
    </section>
  );
}

function TablaTareas({ filas, conAtraso = false }: { filas: FilaSeguimiento[]; conAtraso?: boolean }) {
  return (
    <div className="rounded-[10px] border border-border-subtle overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border-subtle/60">
          {filas.map((f, i) => {
            const e = ESTADO_TAREA[f.estado];
            return (
              <tr key={i} className="hover:bg-bg-elevated/30">
                <td className="px-3 py-2 text-text-primary">{f.titulo}</td>
                <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{f.responsable}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge tone={e.tone}>{e.label}</Badge>
                </td>
                {conAtraso && (
                  <td className="px-3 py-2 text-xs text-danger whitespace-nowrap">
                    {f.diasAtraso > 0 ? `hace ${f.diasAtraso}d` : ''}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cifra({
  label,
  valor,
  icon,
  tono = 'neutral',
}: {
  label: string;
  valor: number;
  icon: React.ReactNode;
  tono?: 'neutral' | 'success' | 'danger' | 'info';
}) {
  const color =
    tono === 'success'
      ? 'text-success'
      : tono === 'danger'
        ? 'text-danger'
        : tono === 'info'
          ? 'text-info'
          : 'text-text-primary';
  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted">
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{valor}</div>
    </div>
  );
}

const VacioTexto = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-[10px] border border-border-subtle p-4 text-xs text-text-muted">{children}</div>
);
