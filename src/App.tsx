import { useEffect } from 'react';
import { AppRouter } from './routes/AppRouter';
import { useTaskMonitor } from '@/hooks/useTaskMonitor';
import { useRopreSync } from '@/hooks/useRopreSync';
import { bootstrapFromRemote } from '@/services/bootstrap';
import { AuthGate } from '@/components/auth/AuthGate';
import { useAuthStore } from '@/store/useAuthStore';
import { ToastViewport } from '@/components/ui/Toast';

export default function App() {
  return (
    <>
      <AuthGate>
        <AppShell />
      </AuthGate>
      <ToastViewport />
    </>
  );
}

function AppShell() {
  const agencyId = useAuthStore((s) => s.agencyId);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    void bootstrapFromRemote();
  }, [agencyId, userId]);

  useTaskMonitor();
  useRopreSync();

  return <AppRouter />;
}
