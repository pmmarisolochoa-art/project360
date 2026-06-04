import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DashboardMacro } from '@/pages/DashboardMacro';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ClientBrainPage } from '@/pages/ClientBrainPage';
import { DeliverablesRepoPage } from '@/pages/DeliverablesRepoPage';
import { LinksRepoPage } from '@/pages/LinksRepoPage';
import { SopAgentPage } from '@/pages/SopAgentPage';
import { AllTasksPage } from '@/pages/AllTasksPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { AgendaPage } from '@/pages/AgendaPage';
import { TeamPage } from '@/pages/TeamPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { ClientPortalFunnelPage } from '@/pages/ClientPortalFunnelPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      {/* Portal cliente — público (sin Layout) para que el cliente final acceda sin login */}
      <Route path="client-portal/funnel/:token" element={<ClientPortalFunnelPage />} />
      <Route element={<Layout />}>
        <Route index element={<DashboardMacro />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
