import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, CalendarClock, Check } from 'lucide-react';
import { useMisPendientes } from '@/hooks/useMisPendientes';
import { useClientStore } from '@/store/useClientStore';
import type { Task } from '@/types/task';

/**
 * La campana: lo que ME falta hoy.
 *
 * Hasta el 15-sep esto era un botón SIN acción que pintaba un número: contaba
 * las tareas vencidas de TODO el portafolio, iguales para cualquiera que
 * entrara, y el "marcar como leído" no sobrevivía a una recarga porque las
 * alertas vivían en memoria. Prometía tres cosas y no cumplía ninguna.
 *
 * Ahora es personal (ver `useIdentidadTareas`), se calcula en vivo desde las
 * tareas, y al pulsarla se abre. Sin estado de "leído": una tarea sale de aquí
 * cuando se completa o se le cambia la fecha, que es lo único que de verdad la
 * quita de tu día.
 */
export function PanelPendientes() {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { vencidas, hoy, total } = useMisPendientes();
  const clients = useClientStore((s) => s.clients);
  const nombreCliente = (id: string) => clients.find((c) => c.id === id)?.name ?? '';

  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [abierto]);

  const irA = (t: Task) => {
    setAbierto(false);
    navigate(`/client/${t.clientId}/tasks?task=${t.id}`);
  };

  const Fila = ({ t, nota, tono }: { t: Task; nota: string; tono: 'rojo' | 'ambar' }) => (
    <button
      type="button"
      onClick={() => irA(t)}
      className="w-full text-left px-3 py-2.5 hover:bg-bg-base/60 transition flex items-start gap-2.5"
    >
      <span
        className="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: tono === 'rojo' ? 'var(--status-danger, #EF4444)' : '#F59E0B' }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-text-primary leading-snug line-clamp-2">{t.title}</span>
        <span className="block text-[11px] text-text-muted mt-0.5">
          {nota}
          {nombreCliente(t.clientId) ? ` · ${nombreCliente(t.clientId)}` : ''}
        </span>
      </span>
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Notificaciones${total ? `: ${total} pendientes` : ''}`}
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="relative h-10 w-10 inline-flex items-center justify-center rounded-[10px] bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition focus-ring"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-status-danger text-[10px] font-bold text-white flex items-center justify-center">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] z-50 rounded-[12px] border border-border-subtle bg-bg-elevated shadow-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border-subtle">
            <div className="text-sm font-semibold text-text-primary">Mis pendientes</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {total === 0 ? 'Nada que requiera tu atención' : `${vencidas.length} retrasada${vencidas.length === 1 ? '' : 's'} · ${hoy.length} para hoy`}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {total === 0 && (
              <div className="px-3 py-8 text-center">
                <Check className="h-7 w-7 mx-auto text-status-success mb-2" />
                <div className="text-sm text-text-secondary">Estás al día</div>
                <div className="text-[11px] text-text-muted mt-1">
                  Sin tareas retrasadas ni con entrega hoy.
                </div>
              </div>
            )}

            {vencidas.length > 0 && (
              <>
                <div className="px-3 pt-3 pb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                  <AlertTriangle className="h-3 w-3 text-status-danger" /> Retrasadas
                </div>
                {vencidas.map(({ task, dias }) => (
                  <Fila
                    key={task.id}
                    t={task}
                    tono="rojo"
                    nota={dias === 0 ? 'vencida' : `${dias} día${dias === 1 ? '' : 's'} de retraso`}
                  />
                ))}
              </>
            )}

            {hoy.length > 0 && (
              <>
                <div className="px-3 pt-3 pb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                  <CalendarClock className="h-3 w-3" /> Para hoy
                </div>
                {hoy.map((t) => <Fila key={t.id} t={t} tono="ambar" nota="entrega hoy" />)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
