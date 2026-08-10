/**
 * "Mi semana" — la vista que faltaba en el espacio del miembro.
 *
 * EL PROBLEMA QUE RESUELVE
 * Hasta ahora, para saber qué tenía encima esta semana, una persona del equipo
 * tenía que entrar cliente por cliente: sus tareas viven en el cerebro de cada
 * cliente y sus reuniones también. Con 3 clientes son 3 vueltas y ninguna
 * respuesta a la pregunta que de verdad importa: "¿qué tengo el jueves?".
 *
 * Acá está todo lo suyo —tareas y reuniones, de todos sus clientes— en una
 * sola rejilla de lunes a domingo.
 *
 * LO PRIVADO SE VE ACÁ POR PRIMERA VEZ
 * La migración 030 creó las tareas y reuniones privadas, pero solo se podían
 * ver entrando al cerebro del cliente. Su dueño no tenía ningún lugar donde
 * mirar "lo mío" junto. Acá aparecen, con candado.
 *
 * Ojo: no hace falta filtrar lo privado de OTRA persona. Las policies de la
 * 030 hacen que esas filas ni siquiera lleguen al navegador — el filtro está
 * en la base, no acá.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Lock, Video, CheckCircle2, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import type { Task } from '@/types/task';
import type { Meeting } from '@/types/meeting';
import type { Client } from '@/types/client';

interface Props {
  tareas: Task[];
  reuniones: Meeting[];
  clientePorId: Record<string, Client | undefined>;
  onAbrirTarea: (t: Task) => void;
  onCompletar: (t: Task) => void;
}

/** Un elemento de la rejilla: da igual si nació como tarea o como reunión. */
interface Item {
  tipo: 'tarea' | 'reunion';
  id: string;
  cuando: Date;
  titulo: string;
  clientId: string;
  privada: boolean;
  completado: boolean;
  tarea?: Task;
  reunion?: Meeting;
}

export function MiSemana({ tareas, reuniones, clientePorId, onAbrirTarea, onCompletar }: Props) {
  // Desplazamiento en semanas respecto a la actual. 0 = esta semana.
  const [offset, setOffset] = useState(0);

  // `weekStartsOn: 1` = la semana empieza el lunes. Es como trabaja el equipo y
  // como se calcula el cierre de semana (Lun-Dom) desde el 23-jul.
  const inicio = useMemo(
    () => startOfWeek(addDays(new Date(), offset * 7), { weekStartsOn: 1 }),
    [offset],
  );
  const fin = useMemo(() => endOfWeek(inicio, { weekStartsOn: 1 }), [inicio]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(inicio, i)), [inicio]);

  const items = useMemo(() => {
    const out: Item[] = [];

    for (const t of tareas) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      if (d < inicio || d > fin) continue;
      out.push({
        tipo: 'tarea',
        id: t.id,
        cuando: d,
        titulo: t.title,
        clientId: t.clientId,
        privada: !!t.esPrivada,
        completado: t.status === 'completed',
        tarea: t,
      });
    }

    for (const m of reuniones) {
      if (!m.scheduledAt) continue;
      const d = new Date(m.scheduledAt);
      if (d < inicio || d > fin) continue;
      out.push({
        tipo: 'reunion',
        id: m.id,
        cuando: d,
        titulo: m.title,
        clientId: m.clientId,
        privada: !!m.esPrivada,
        completado: !!m.completed,
        reunion: m,
      });
    }

    return out.sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
  }, [tareas, reuniones, inicio, fin]);

  const porDia = useMemo(
    () => dias.map((d) => ({ dia: d, items: items.filter((i) => isSameDay(i.cuando, d)) })),
    [dias, items],
  );

  const pendientes = items.filter((i) => !i.completado).length;

  return (
    <section className="surface p-5">
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-accent-violet" />
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Mi semana</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {offset === 0 ? 'Esta semana' : format(inicio, "'Semana del' d 'de' MMMM", { locale: es })}
              {' · '}
              {pendientes === 0 ? 'nada pendiente' : `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <BotonSemana etiqueta="Semana anterior" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </BotonSemana>
          {offset !== 0 && (
            <button
              onClick={() => setOffset(0)}
              className="h-8 px-3 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus-ring"
            >
              Hoy
            </button>
          )}
          <BotonSemana etiqueta="Semana siguiente" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </BotonSemana>
        </div>
      </header>

      {/* 7 columnas en pantalla ancha; en móvil se apilan y los días vacíos se
          esconden, porque scrollear 7 tarjetas vacías no ayuda a nadie. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {porDia.map(({ dia, items: delDia }) => {
          const hoy = isToday(dia);
          const vacio = delDia.length === 0;
          return (
            <div
              key={dia.toISOString()}
              className={cn(
                'rounded-[10px] border p-2 min-h-[92px]',
                hoy ? 'border-accent-primary/60 bg-accent-primary/5' : 'border-border-subtle',
                vacio && 'hidden lg:block',
              )}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span className={cn('text-[11px] uppercase tracking-wider', hoy ? 'text-accent-primary font-semibold' : 'text-text-muted')}>
                  {format(dia, 'EEE', { locale: es })}
                </span>
                <span className={cn('text-sm', hoy ? 'font-bold text-accent-primary' : 'text-text-secondary')}>
                  {format(dia, 'd')}
                </span>
              </div>

              {vacio ? (
                <p className="text-[11px] text-text-muted/60">—</p>
              ) : (
                <div className="space-y-1.5">
                  {delDia.map((i) => (
                    <TarjetaItem
                      key={`${i.tipo}-${i.id}`}
                      item={i}
                      cliente={clientePorId[i.clientId]}
                      onAbrirTarea={onAbrirTarea}
                      onCompletar={onCompletar}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-text-muted mt-3 text-center">
          Nada agendado esta semana. Si esperabas ver algo, revisa que las tareas tengan fecha límite.
        </p>
      )}
    </section>
  );
}

function BotonSemana({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="h-8 w-8 grid place-items-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors focus-ring"
    >
      {children}
    </button>
  );
}

function TarjetaItem({
  item,
  cliente,
  onAbrirTarea,
  onCompletar,
}: {
  item: Item;
  cliente?: Client;
  onAbrirTarea: (t: Task) => void;
  onCompletar: (t: Task) => void;
}) {
  const navigate = useNavigate();
  // Una tarea PERSONAL cuelga del Espacio de Agencia, que el miembro no tiene
  // entre sus clientes: `cliente` viene vacío. No es un error — se muestra como
  // "Personal" en vez de dejar el hueco en blanco.
  const esPersonal = item.privada && !cliente;
  const color = cliente?.primaryColor ?? '#8B5CF6';

  const abrir = () => {
    if (item.tipo === 'tarea' && item.tarea) return onAbrirTarea(item.tarea);
    // Sin cliente al que ir, no hay adónde navegar.
    if (esPersonal) return;
    // Las reuniones se ven en el cerebro del cliente, donde está el drawer con
    // agenda, notas y compromisos. No se duplica esa pantalla acá.
    //
    // El slug es `meetings`, aunque en pantalla la pestaña diga "Agenda" — está
    // así en BRAIN_MODULES. Escribir `/reuniones` llevaba a una ruta que no
    // existe y a una pantalla vacía.
    navigate(`/client/${item.clientId}/meetings`);
  };

  const atrasada =
    item.tipo === 'tarea' &&
    !item.completado &&
    differenceInCalendarDays(startOfDay(item.cuando), startOfDay(new Date())) < 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrir())}
      className={cn(
        'group w-full text-left rounded-md border px-2 py-1.5 transition-colors cursor-pointer focus-ring',
        'border-border-subtle hover:border-accent-primary/50 hover:bg-bg-hover',
        item.completado && 'opacity-55',
      )}
      // La franja de color es la del cliente: identifica de quién es el trabajo
      // sin ocupar una línea de texto.
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start gap-1.5">
        {item.tipo === 'reunion' && <Video className="h-3 w-3 shrink-0 mt-0.5 text-text-muted" />}
        {item.privada && (
          <Lock className="h-3 w-3 shrink-0 mt-0.5 text-accent-violet" aria-label="Privada — solo la ves tú" />
        )}
        <span
          className={cn(
            'text-[11px] leading-tight line-clamp-2',
            item.completado && 'line-through text-text-muted',
          )}
          title={item.titulo}
        >
          {item.titulo}
        </span>
      </div>

      <div className="flex items-center justify-between gap-1 mt-1">
        <span className="text-[10px] text-text-muted truncate">
          {item.tipo === 'reunion'
            ? format(item.cuando, 'HH:mm')
            : (cliente?.name ?? (esPersonal ? 'Personal' : ''))}
        </span>

        {atrasada && <Badge tone="danger">tarde</Badge>}

        {/* Completar sin abrir nada: es la acción que más se repite en la
            semana y obligaba a entrar al cerebro del cliente. */}
        {item.tipo === 'tarea' && !item.completado && item.tarea && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCompletar(item.tarea!);
            }}
            title="Marcar completada"
            aria-label={`Marcar "${item.titulo}" como completada`}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-text-muted hover:text-status-success transition-opacity focus-ring rounded"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
