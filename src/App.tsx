import { useEffect, useState } from 'react';
import { AppRouter } from './routes/AppRouter';
import { useTaskMonitor } from '@/hooks/useTaskMonitor';
import { useRopreSync } from '@/hooks/useRopreSync';
import { bootstrapFromRemote } from '@/services/bootstrap';
import { usingRemote } from '@/services/supabase';
import { ToastViewport } from '@/components/ui/Toast';

export default function App() {
  const [booted, setBooted] = useState(!usingRemote);

  useEffect(() => {
    if (booted) return;
    bootstrapFromRemote().finally(() => setBooted(true));
  }, [booted]);

  useTaskMonitor();
  useRopreSync();

  if (!booted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-bg-base">
        <div className="text-text-muted text-sm">Conectando con Supabase…</div>
      </div>
    );
  }
  return (
    <>
      <AppRouter />
      <ToastViewport />
    </>
  );
}
