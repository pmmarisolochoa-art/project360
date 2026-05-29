import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DashboardMacro } from '@/pages/DashboardMacro';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ClientBrainPage } from '@/pages/ClientBrainPage';
import { DeliverablesRepoPage } from '@/pages/DeliverablesRepoPage';
import { LinksRepoPage } from '@/pages/LinksRepoPage';
import { SopAgentPage } from '@/pages/SopAgentPage';
import { AllTasksPage } from '@/pages/AllTasksPage';

function Placeholder({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="p-8">
      <div className="surface p-10 text-center">
        <h1 className="heading text-2xl mb-2">{title}</h1>
        {hint && <p className="text-text-secondary text-sm">{hint}</p>}
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardMacro />} />
        <Route path="clients" element={<Placeholder title="Clientes" />} />
        <Route path="agenda" element={<Placeholder title="Agenda Global" />} />
        <Route path="team" element={<Placeholder title="Equipo" />} />
        <Route path="settings" element={<Placeholder title="Configuración" />} />
        <Route path="repositorio/entregables" element={<DeliverablesRepoPage />} />
        <Route path="repositorio/links" element={<LinksRepoPage />} />
        <Route path="agente-sop" element={<SopAgentPage />} />
        <Route path="tasks" element={<AllTasksPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="client/:id" element={<ClientBrainPage />} />
        <Route path="client/:id/:module" element={<ClientBrainPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
