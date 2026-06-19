import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, Calendar, CalendarRange, Mic, Rocket } from 'lucide-react';
import type { Client } from '@/types/client';
import { useClientStore } from '@/store/useClientStore';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { useRopreStore } from '@/store/useRopreStore';
import { withAlpha } from '@/utils/colorGenerator';
import { toast } from '@/store/useToastStore';
import {
  exportWeeklyReport,
  exportMonthlyReport,
  exportMeetingReport,
  exportLaunchReport,
} from '@/services/reportsPdf';

/**
 * Menú compacto en el header del cerebro: 4 reportes PDF.
 * - Semanal y mensual: directos.
 * - Reunión y Lanzamiento: abren sub-menú para elegir cuál.
 */
export function ReportsMenu({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<'meetings' | 'funnels' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // CRÍTICO: filtrar dentro del selector crea nuevo array por render →
  // bucle infinito → pantalla en blanco. Tomamos raw + useMemo.
  const allTasksRaw = useClientStore((s) => s.tasks);
  const allMeetingsRaw = useClientStore((s) => s.meetings);
  const allFunnelsRaw = useFunnelLaunchStore((s) => s.funnels);
  const allPhases = useFunnelLaunchStore((s) => s.phases);
  const allRopreRaw = useRopreStore((s) => s.items);
  const ropreItems = useMemo(() => allRopreRaw.filter((i) => i.clientId === client.id), [allRopreRaw, client.id]);
  const tasks = useMemo(() => allTasksRaw.filter((t) => t.clientId === client.id), [allTasksRaw, client.id]);
  const meetings = useMemo(() => allMeetingsRaw.filter((m) => m.clientId === client.id), [allMeetingsRaw, client.id]);
  const funnels = useMemo(() => allFunnelsRaw.filter((f) => f.clientId === client.id), [allFunnelsRaw, client.id]);
  const accent = client.primaryColor;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setSub(null);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const run = async (fn: () => void | Promise<void>, label: string) => {
    setOpen(false);
    setSub(null);
    // Aviso al usuario solo si la operación es async (puede tomar varios
    // segundos por la llamada a Claude). Si es síncrono jsPDF, ni se ve.
    const isAsync = label === 'Reporte semanal';
    if (isAsync) toast.info(`Generando ${label.toLowerCase()}… puede tardar unos segundos`);
    try {
      await fn();
      toast.success(`${label} generado`);
    } catch (e) {
      console.warn('[reportsPdf]', e);
      toast.error('No se pudo generar el reporte');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-xs font-medium transition hover:brightness-125"
        style={{
          borderColor: withAlpha(accent, 0.4),
          background: withAlpha(accent, 0.10),
          color: accent,
        }}
      >
        <FileText className="h-3.5 w-3.5" />
        Reportes PDF
        <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 z-50 rounded-[12px] border border-border-subtle bg-bg-elevated shadow-xl overflow-hidden"
          >
            {sub === null && (
              <div className="py-1">
                <MenuItem
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Reporte semanal"
                  hint="Resumen IA + tareas + foco próxima semana"
                  onClick={() => {
                    const activeFunnel = client.activeFunnelId
                      ? funnels.find((f) => f.id === client.activeFunnelId) ?? null
                      : funnels[0] ?? null;
                    run(
                      () => exportWeeklyReport({ client, tasks, meetings, funnel: activeFunnel, ropreItems }),
                      'Reporte semanal',
                    );
                  }}
                />
                <MenuItem
                  icon={<CalendarRange className="h-3.5 w-3.5" />}
                  label="Reporte mensual"
                  hint="KPIs + pendientes del mes"
                  onClick={() => run(() => exportMonthlyReport({ client, tasks, meetings }), 'Reporte mensual')}
                />
                <MenuItem
                  icon={<Mic className="h-3.5 w-3.5" />}
                  label="Reporte de reunión"
                  hint={meetings.length > 0 ? `${meetings.length} reuniones` : 'Sin reuniones'}
                  disabled={meetings.length === 0}
                  onClick={() => setSub('meetings')}
                />
                <MenuItem
                  icon={<Rocket className="h-3.5 w-3.5" />}
                  label="Reporte de lanzamiento"
                  hint={funnels.length > 0 ? `${funnels.length} embudos` : 'Sin embudos'}
                  disabled={funnels.length === 0}
                  onClick={() => setSub('funnels')}
                />
              </div>
            )}

            {sub === 'meetings' && (
              <div className="py-1">
                <SubHeader title="Elige reunión" onBack={() => setSub(null)} />
                <div className="max-h-72 overflow-y-auto">
                  {meetings
                    .slice()
                    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                    .slice(0, 20)
                    .map((m) => (
                      <MenuItem
                        key={m.id}
                        icon={<Mic className="h-3.5 w-3.5" />}
                        label={m.title}
                        hint={new Date(m.scheduledAt).toLocaleDateString('es')}
                        onClick={() => run(() => exportMeetingReport({ client, meeting: m }), 'Reporte de reunión')}
                      />
                    ))}
                </div>
              </div>
            )}

            {sub === 'funnels' && (
              <div className="py-1">
                <SubHeader title="Elige embudo" onBack={() => setSub(null)} />
                <div className="max-h-72 overflow-y-auto">
                  {funnels.map((f) => (
                    <MenuItem
                      key={f.id}
                      icon={<Rocket className="h-3.5 w-3.5" />}
                      label={f.name}
                      hint={f.status}
                      onClick={() => run(
                        () => exportLaunchReport({
                          client,
                          funnel: f,
                          phases: allPhases.filter((p) => p.funnelId === f.id),
                          tasks,
                        }),
                        'Reporte de lanzamiento',
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon, label, hint, onClick, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-bg-base/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="mt-0.5 text-text-muted">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium text-text-primary truncate">{label}</span>
        {hint && <span className="block text-[10px] text-text-muted truncate">{hint}</span>}
      </span>
    </button>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
      <button
        onClick={onBack}
        className="text-text-muted hover:text-text-primary text-[10px] uppercase tracking-wider"
      >
        ← Volver
      </button>
      <span className="text-[10px] uppercase tracking-wider text-text-secondary ml-auto">{title}</span>
    </div>
  );
}
