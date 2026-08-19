import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Layout } from '@/components/layout/Layout';
import { MemberLayout } from '@/components/layout/MemberLayout';
import { useAuthStore, administra } from '@/store/useAuthStore';
// Eager: son los dos puntos de entrada reales (index y login). Cargarlos bajo
// demanda solo añadiría un parpadeo sin ahorrar nada, porque siempre se piden.
import { DashboardMacro } from '@/pages/DashboardMacro';
import { LoginPage } from '@/pages/LoginPage';

/**
 * El resto de rutas se cargan bajo demanda. Antes TODAS las páginas (con sus
 * dependencias: recharts, los módulos del cerebro, etc.) viajaban en el bundle
 * inicial aunque abrieras solo el dashboard. `lazy` las parte en chunks que se
 * bajan al navegar. Los `.then` mapean el export nombrado al `default` que
 * `lazy` espera.
 */
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const ClientBrainPage = lazy(() => import('@/pages/ClientBrainPage').then((m) => ({ default: m.ClientBrainPage })));
const SopAgentPage = lazy(() => import('@/pages/SopAgentPage').then((m) => ({ default: m.SopAgentPage })));
const AllTasksPage = lazy(() => import('@/pages/AllTasksPage').then((m) => ({ default: m.AllTasksPage })));
const ClientsPage = lazy(() => import('@/pages/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const AgendaPage = lazy(() => import('@/pages/AgendaPage').then((m) => ({ default: m.AgendaPage })));
const TeamPage = lazy(() => import('@/pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ClientPortalFunnelPage = lazy(() => import('@/pages/ClientPortalFunnelPage').then((m) => ({ default: m.ClientPortalFunnelPage })));
const MiEspacio = lazy(() => import('@/pages/MiEspacio').then((m) => ({ default: m.MiEspacio })));
const LinksEntregablesPage = lazy(() => import('@/pages/LinksEntregablesPage').then((m) => ({ default: m.LinksEntregablesPage })));

/**
 * Rutas viejas (inglés) → nuevas (español). Se mantienen como redirecciones
 * permanentes para no romper enlaces guardados, correos ya enviados ni los
 * deep-links del buscador. Se pueden borrar cuando ya nadie las use.
 */
const REDIRECCIONES: Array<[string, string]> = [
  ['/clients', '/clientes'],
  ['/agenda', '/agenda-global'],
  ['/team', '/equipo'],
  ['/settings', '/configuracion'],
  ['/tasks', '/tareas'],
  ['/repositorio/entregables', '/links-entregables'],
  ['/repositorio/links', '/links-entregables'],
  ['/agente-sop', '/configuracion'],
];

/** Spinner mientras baja el chunk de la ruta. Mismo look que el de AuthGate. */
function RouteFallback() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
    </div>
  );
}

export function AppRouter() {
  const role = useAuthStore((s) => s.role);
  const clientAccess = useAuthStore((s) => s.clientAccess);

  // Usuario MIEMBRO (equipo): su espacio personal multi-cliente.
  // Home = /mi-espacio; puede entrar a los cerebros de sus clientes.
  //
  // DIRECCIÓN no entra por aquí: aunque está en `team_members` igual que un
  // miembro, `resolveUserContext` le devuelve role 'direccion' y cae al bloque
  // de abajo, con el sidebar completo. Lo que NO ve es Configuración, que es
  // administrar y no dirigir.
  if (role === 'member' && clientAccess) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route path="client-portal/funnel/:token" element={<ClientPortalFunnelPage />} />
            <Route element={<MemberLayout />}>
              <Route path="mi-espacio" element={<MiEspacio />} />
              <Route path="client/:id" element={<ClientBrainPage />} />
              <Route path="client/:id/:module" element={<ClientBrainPage />} />
              <Route index element={<Navigate to="/mi-espacio" replace />} />
              <Route path="*" element={<Navigate to="/mi-espacio" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="login" element={<LoginPage />} />
        {/* Portal cliente — público (sin Layout) para que el cliente final acceda sin login */}
        <Route path="client-portal/funnel/:token" element={<ClientPortalFunnelPage />} />
        <Route element={<Layout />}>
          {/* Los 7 ítems del sidebar (Capa 0) */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardMacro />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="agenda-global" element={<AgendaPage />} />
          <Route path="tareas" element={<AllTasksPage />} />
          <Route path="equipo" element={<TeamPage />} />
          <Route path="links-entregables" element={<LinksEntregablesPage />} />
          {/* Configuración es administración: llaves de API, integraciones,
              datos de la cuenta. Dirección ve el negocio, no lo administra.
              La ruta no existe para ellos — no basta con esconder el enlace,
              porque la URL se puede escribir a mano. */}
          {administra(role) && <Route path="configuracion" element={<SettingsPage />} />}

          {/* Fuera del sidebar pero accesibles */}
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="configuracion/agente-sop" element={<SopAgentPage />} />
          <Route path="client/:id" element={<ClientBrainPage />} />
          <Route path="client/:id/:module" element={<ClientBrainPage />} />

          {/* Compatibilidad: rutas viejas → nuevas */}
          {REDIRECCIONES.map(([vieja, nueva]) => (
            <Route key={vieja} path={vieja.slice(1)} element={<Navigate to={nueva} replace />} />
          ))}

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
