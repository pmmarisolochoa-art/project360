import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useClientStore } from '@/store/useClientStore';
import { ClientCard } from '@/components/dashboard/ClientCard';
import { GlobalStats } from '@/components/dashboard/GlobalStats';
import { WeeklyCalendar } from '@/components/dashboard/WeeklyCalendar';
import { TodayTasks } from '@/components/dashboard/TodayTasks';
import { MeetingDrawer } from '@/components/dashboard/MeetingDrawer';
import { useUIDrawerStore } from '@/store/useUIDrawerStore';
import { Button } from '@/components/ui/Button';

export function DashboardMacro() {
  const clients = useClientStore((s) => s.clients);
  const meetings = useClientStore((s) => s.meetings);
  const meetingId = useUIDrawerStore((s) => s.meetingId);
  const closeMeeting = useUIDrawerStore((s) => s.closeMeeting);
  const activeMeeting = meetingId ? meetings.find((m) => m.id === meetingId) : null;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-1"
      >
        <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-1.5">
          Capa 0 · Command Center
        </div>
        <h1 className="heading text-3xl lg:text-4xl font-bold">
          <span className="gradient-text">Visión macro</span> del portafolio
        </h1>
        <p className="text-sm text-text-secondary mt-1.5">
          Estado consolidado de todos los cerebros activos de tu agencia.
        </p>
      </motion.header>

      <GlobalStats />

      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="heading text-lg font-bold">Clientes activos</h2>
            <p className="text-xs text-text-muted">
              {clients.length} cerebros · clic para abrir
            </p>
          </div>
        </div>
        {clients.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clients.map((c, i) => (
              <ClientCard key={c.id} client={c} index={i} />
            ))}
          </div>
        )}
      </section>

      <TodayTasks />

      <WeeklyCalendar />

      <AnimatePresence>
        {activeMeeting && <MeetingDrawer meeting={activeMeeting} onClose={closeMeeting} />}
      </AnimatePresence>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface p-10 text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-gradient-accent flex items-center justify-center opacity-80">
        <Plus className="h-5 w-5 text-white" />
      </div>
      <h3 className="heading text-lg mb-1">Aún no hay cerebros activos</h3>
      <p className="text-sm text-text-secondary mb-4">
        Inicia el onboarding de tu primer cliente para activar su cerebro.
      </p>
      <Link to="/onboarding">
        <Button>Iniciar onboarding</Button>
      </Link>
    </div>
  );
}
