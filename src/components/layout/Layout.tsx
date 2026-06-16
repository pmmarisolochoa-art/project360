import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

export function Layout() {
  const user = useAuthStore((s) => s.user);

  // Saludo de bienvenida — solo la primera vez por sesión del navegador.
  // Usamos sessionStorage para que vuelva a aparecer al día siguiente.
  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('p360.welcomed') === 'true') return;
    // Derivar nombre del email (parte antes del @, capitalizada). Si no
    // hay email útil, usamos un saludo neutro.
    const handle = (user.email ?? '').split('@')[0] ?? '';
    const firstName = handle
      ? handle.charAt(0).toUpperCase() + handle.slice(1).split(/[._-]/)[0]
      : 'bienvenida';
    useToastStore.getState().show({
      tone: 'info',
      message: `Bienvenida a Project360, ${firstName} 👋 — Tu sistema de operaciones está listo.`,
      duration: 4000,
    });
    sessionStorage.setItem('p360.welcomed', 'true');
  }, [user]);

  return (
    <div className="flex h-full bg-bg-base text-text-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
