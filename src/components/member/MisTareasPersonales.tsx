/**
 * "Mis tareas personales" — la lista transversal.
 *
 * POR QUÉ NO BASTABA CON "MI SEMANA"
 * La rejilla semanal responde "¿qué tengo el jueves?". Pero una tarea personal
 * muchas veces no tiene un día: "llamar al contador", "revisar mi propuesta".
 * En una rejilla por fechas eso se pierde — o peor, se queda enterrado en una
 * semana pasada a la que nadie vuelve.
 *
 * Esta lista es lo contrario: NO le importa la semana. Están todas, siempre a
 * la vista, y se marcan como hechas de un clic. Es el sitio donde vive lo
 * personal; la semana solo lo muestra de paso.
 *
 * LO QUE NO HACE, A PROPÓSITO
 * No es un segundo gestor de tareas. Sin filtros, sin prioridades visibles, sin
 * agrupaciones. Si esto crece hasta necesitarlas, la respuesta es llevar la
 * tarea al cliente que corresponda, no convertir el rincón personal en otro
 * tablero.
 */

import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format, isPast, isToday, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Lock, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Task } from '@/types/task';

interface Props {
  /** Todas las tareas del miembro; acá se queda solo con lo personal. */
  tareas: Task[];
  onCompletar: (t: Task) => void;
  onReabrir: (t: Task) => void;
}

/** Texto de la fecha, en corto. `null` cuando no aporta nada. */
function cuando(t: Task): { texto: string; tarde: boolean } | null {
  if (!t.dueDate) return null;
  const d = new Date(t.dueDate);
  if (isToday(d)) return { texto: 'Hoy', tarde: false };
  if (isPast(d)) {
    const dias = Math.abs(differenceInCalendarDays(startOfDay(d), startOfDay(new Date())));
    return { texto: dias === 1 ? 'Ayer' : `Hace ${dias} días`, tarde: true };
  }
  return { texto: format(d, "d 'de' MMM", { locale: es }), tarde: false };
}

export function MisTareasPersonales({ tareas, onCompletar, onReabrir }: Props) {
  const [verHechas, setVerHechas] = useState(false);

  const personales = useMemo(() => tareas.filter((t) => t.esPrivada), [tareas]);

  const pendientes = useMemo(
    () =>
      personales
        .filter((t) => t.status !== 'completed')
        // Las que tienen fecha primero y por orden; las que no, al final. Una
        // tarea sin fecha no es menos importante, pero sí menos urgente.
        .sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }),
    [personales],
  );

  const hechas = useMemo(
    () =>
      personales
        .filter((t) => t.status === 'completed')
        .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
        .slice(0, 10),
    [personales],
  );

  // Sin nada personal no se muestra un cajón vacío: se explica para qué sirve.
  if (personales.length === 0) {
    return (
      <section className="surface p-5">
        <Encabezado cantidad={0} />
        <p className="text-xs text-text-muted mt-2">
          Lo que apuntes acá solo lo ves tú — ni el equipo ni la dirección. Úsalo para lo tuyo:
          recordatorios, pendientes personales, ideas que no son de ningún cliente.
        </p>
      </section>
    );
  }

  return (
    <section className="surface p-5">
      <Encabezado cantidad={pendientes.length} />

      <div className="mt-3 space-y-1">
        {pendientes.map((t) => {
          const f = cuando(t);
          return (
            <div
              key={t.id}
              className="group flex items-center gap-2.5 rounded-[10px] border border-border-subtle px-3 py-2 hover:border-accent-violet/50 transition-colors"
            >
              {/* Siempre visible, no solo al pasar el ratón: en un móvil no hay
                  "pasar el ratón", y marcar como hecha es LA acción de esta lista. */}
              <button
                onClick={() => onCompletar(t)}
                aria-label={`Marcar "${t.title}" como completada`}
                title="Marcar como completada"
                className="h-5 w-5 shrink-0 grid place-items-center rounded-full border border-border-default text-transparent hover:border-status-success hover:text-status-success focus-ring transition-colors"
              >
                <Check className="h-3 w-3" />
              </button>

              <span className="flex-1 min-w-0 text-sm truncate" title={t.title}>
                {t.title}
              </span>

              {f && (
                <span className={cn('text-[11px] shrink-0', f.tarde ? 'text-status-danger' : 'text-text-muted')}>
                  {f.texto}
                </span>
              )}
            </div>
          );
        })}

        {pendientes.length === 0 && (
          <p className="text-xs text-text-muted py-2">Nada pendiente por acá. ✓</p>
        )}
      </div>

      {hechas.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <button
            onClick={() => setVerHechas((v) => !v)}
            className="text-[11px] text-text-muted hover:text-text-primary transition-colors focus-ring rounded"
          >
            {verHechas ? 'Ocultar' : 'Ver'} completadas ({hechas.length})
          </button>

          {verHechas && (
            <div className="mt-2 space-y-1">
              {hechas.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 px-3 py-1.5 text-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-status-success" />
                  <span className="flex-1 min-w-0 truncate line-through text-text-muted" title={t.title}>
                    {t.title}
                  </span>
                  {/* Marcar por error es fácil; deshacerlo tiene que serlo también. */}
                  <button
                    onClick={() => onReabrir(t)}
                    title="Volver a marcarla como pendiente"
                    aria-label={`Reabrir "${t.title}"`}
                    className="text-text-muted hover:text-text-primary focus-ring rounded"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Encabezado({ cantidad }: { cantidad: number }) {
  return (
    <header className="flex items-center gap-2">
      <Lock className="h-4 w-4 text-accent-violet" />
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Mis tareas personales</h2>
        <p className="text-xs text-text-muted mt-0.5">
          {cantidad === 0 ? 'Solo las ves tú' : `${cantidad} pendiente${cantidad === 1 ? '' : 's'} · solo las ves tú`}
        </p>
      </div>
    </header>
  );
}
