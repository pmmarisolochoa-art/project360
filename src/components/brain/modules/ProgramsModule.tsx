import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Rocket, Share2, ArrowRight } from 'lucide-react';
import type { Client } from '@/types/client';
import type { Program, ProgramEstado } from '@/types/program';
import {
  PROGRAM_TYPES, PROGRAM_COLORS, PROGRAM_ESTADO_META, programTypeMeta,
} from '@/types/program';
import { useProgramsStore } from '@/store/useProgramsStore';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { useClientStore } from '@/store/useClientStore';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/useToastStore';
import { genId } from '@/utils/id';
import { withAlpha } from '@/utils/colorGenerator';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';

const PROGRAM_FILTER_KEY = (clientId: string) => `p360.program.${clientId}`;

interface ProgramStats {
  total: number;
  done: number;
  progress: number;
  daysToEvent: number | null;
  funnelShareToken?: string;
}

export function ProgramsModule({ client, readOnly = false }: { client: Client; readOnly?: boolean }) {
  const accent = client.primaryColor;
  const navigate = useNavigate();
  const programs = useProgramsStore((s) => s.programs).filter((p) => p.clientId === client.id);
  const funnels = useFunnelLaunchStore((s) => s.funnels);
  const tasks = useClientStore((s) => s.tasks);
  const [createOpen, setCreateOpen] = useState(false);

  const statsFor = useMemo(() => {
    return (program: Program): ProgramStats => {
      const programFunnels = funnels.filter((f) => f.programId === program.id);
      const funnelIds = new Set(programFunnels.map((f) => f.id));
      const programTasks = tasks.filter((t) => t.clientId === client.id && t.funnelId && funnelIds.has(t.funnelId));
      const total = programTasks.length;
      const done = programTasks.filter((t) => t.status === 'completed').length;
      const progress = total === 0 ? 0 : Math.round((done / total) * 100);
      const daysToEvent = program.fechaEvento
        ? differenceInCalendarDays(parseISO(program.fechaEvento), new Date())
        : null;
      return { total, done, progress, daysToEvent, funnelShareToken: programFunnels[0]?.shareToken };
    };
  }, [funnels, tasks, client.id]);

  const openDetail = (program: Program) => {
    // Selecciona el programa en el Kanban (4D) y navega a Tareas.
    try { window.localStorage.setItem(PROGRAM_FILTER_KEY(client.id), program.id); } catch { /* noop */ }
    navigate(`/client/${client.id}/tasks`);
  };

  const share = (stats: ProgramStats) => {
    if (!stats.funnelShareToken) { toast.error('Este programa no tiene embudo para compartir'); return; }
    const url = `https://project360-pearl.vercel.app/client-portal/funnel/${stats.funnelShareToken}`;
    void navigator.clipboard?.writeText(url);
    toast.success('Link copiado');
  };

  return (
    <div className="space-y-4">
      {/* Resumen — programas activos (4C) */}
      <section className="surface p-5">
        <header className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="heading text-base font-bold flex items-center gap-1.5">
              <Rocket className="h-4 w-4" /> Programas de {client.name}
            </h3>
            <p className="text-[11px] text-text-muted">Un cliente puede correr varios programas a la vez.</p>
          </div>
          {!readOnly && (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Nuevo programa</Button>
          )}
        </header>

        {programs.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-border-default p-8 text-center">
            <div className="text-3xl mb-2">🚀</div>
            <p className="text-sm text-text-secondary mb-3">Elige el sistema de ventas de este proyecto.</p>
            {!readOnly && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Crear primer programa</Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {programs.map((p) => {
              const s = statsFor(p);
              const meta = programTypeMeta(p.tipo);
              const color = p.color ?? accent;
              return (
                <button
                  key={p.id}
                  onClick={() => openDetail(p)}
                  className="w-full grid grid-cols-[1.6fr_2fr_auto] gap-3 items-center rounded-[10px] border border-border-subtle bg-bg-base/30 px-3 py-2.5 text-left hover:bg-bg-elevated transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{meta.emoji}</span>
                    <span className="text-sm font-semibold text-text-primary truncate">{p.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: color }} />
                    </div>
                    <span className="text-[11px] text-text-muted tabular-nums w-9 text-right">{s.progress}%</span>
                  </div>
                  <div className="text-[11px] text-text-muted whitespace-nowrap">
                    {s.daysToEvent != null ? `Evento: ${s.daysToEvent}d` : `${s.total} tareas`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Grid de cards detalladas (4B) */}
      {programs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {programs.map((p) => {
            const s = statsFor(p);
            const meta = programTypeMeta(p.tipo);
            const estadoMeta = PROGRAM_ESTADO_META[p.estado];
            const color = p.color ?? accent;
            return (
              <div key={p.id} className="surface p-4 flex flex-col gap-3" style={{ borderColor: withAlpha(color, 0.35) }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{meta.emoji}</span>
                      <h4 className="text-sm font-bold text-text-primary truncate">{p.nombre}</h4>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">{meta.label}</div>
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 whitespace-nowrap"
                    style={{ background: withAlpha(estadoMeta.color, 0.15), color: estadoMeta.color }}
                  >
                    {estadoMeta.emoji} {estadoMeta.label}
                  </span>
                </div>

                <div>
                  <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: color }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-text-muted mt-1">
                    <span>{s.done}/{s.total} tareas · {s.progress}%</span>
                    <span>
                      {s.daysToEvent != null
                        ? `${s.daysToEvent}d al evento`
                        : p.fechaEvento ? format(parseISO(p.fechaEvento), 'd MMM', { locale: es }) : 'Sin evento'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-auto">
                  <Button size="sm" variant="ghost" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => openDetail(p)}>
                    Ver detalle
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Share2 className="h-3.5 w-3.5" />} onClick={() => share(s)}>
                    Compartir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreateProgramModal client={client} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}

/* ───────────────────────── Modal: nuevo programa ───────────────────────── */

function CreateProgramModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const addProgram = useProgramsStore((s) => s.add);
  const activateFromTemplate = useFunnelLaunchStore((s) => s.activateFromTemplate);
  const updateFunnel = useFunnelLaunchStore((s) => s.update);

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState(PROGRAM_TYPES[0].value);
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');
  const [fechaCierre, setFechaCierre] = useState('');
  const [color, setColor] = useState(PROGRAM_COLORS[0]);
  const [applyTemplate, setApplyTemplate] = useState(true);

  const meta = programTypeMeta(tipo);
  const hasTemplate = !!meta.template;

  const submit = () => {
    if (!nombre.trim()) { toast.error('Escribe el nombre del programa'); return; }
    const programId = genId();
    const program: Program = {
      id: programId,
      clientId: client.id,
      nombre: nombre.trim(),
      tipo,
      descripcion: descripcion.trim() || undefined,
      fechaInicio: fechaInicio || undefined,
      fechaEvento: fechaEvento || undefined,
      fechaCierre: fechaCierre || undefined,
      estado: 'activo' as ProgramEstado,
      color,
      createdAt: new Date().toISOString(),
    };

    // Materializa el embudo y lo vincula al programa.
    if (applyTemplate && hasTemplate && meta.template) {
      const start = fechaInicio ? new Date(fechaInicio) : new Date();
      const funnel = activateFromTemplate(client.id, meta.template, start, nombre.trim());
      if (funnel) {
        updateFunnel(funnel.id, { programId });
        program.funnelTemplate = meta.template;
        toast.success(`Programa creado con embudo · tareas generadas ✓`);
      } else {
        toast.success('Programa creado');
      }
    } else {
      toast.success('Programa creado');
    }

    addProgram(program);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Nuevo programa"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" leftIcon={<Rocket className="h-3.5 w-3.5" />} onClick={submit}>Crear programa</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Nombre del programa" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Lanzamiento Semilla · Junio 2026" autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Tipo"
            value={tipo}
            options={PROGRAM_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))}
            onChange={(e) => setTipo(e.target.value)}
          />
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-text-muted mb-1">Color</label>
            <div className="flex items-center gap-1.5 pt-1">
              {PROGRAM_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-6 w-6 rounded-full border-2 transition"
                  style={{ background: c, borderColor: color === c ? '#fff' : 'transparent' }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>
        <Textarea label="Descripción (opcional)" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <Input label="Inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          <Input label="Evento" type="date" value={fechaEvento} onChange={(e) => setFechaEvento(e.target.value)} />
          <Input label="Cierre" type="date" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} />
        </div>
        {hasTemplate && (
          <label className="flex items-center gap-2 rounded-[10px] border border-border-subtle bg-bg-base/30 px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={applyTemplate} onChange={(e) => setApplyTemplate(e.target.checked)} className="h-4 w-4 accent-accent-violet" />
            <span className="text-xs text-text-secondary">
              Aplicar plantilla de tareas de <strong className="text-text-primary">{meta.label}</strong> (genera las tareas del embudo automáticamente).
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}
