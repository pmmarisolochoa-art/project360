import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Loader2 } from 'lucide-react';
import { signIn } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/store/useToastStore';
import { BRAND } from '@/config/brand';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Olvidé mi contraseña" — mismo form, cambia de modo en vez de abrir otra
  // pantalla (menos saltos para alguien que ya está bloqueado y frustrado).
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false);

  async function handleRecuperar(e: FormEvent) {
    e.preventDefault();
    if (!email) { setError('Escribe tu correo primero.'); return; }
    if (!supabase) { setError('Sin conexión a Supabase.'); return; }
    setEnviandoRecuperacion(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      // No se confirma ni se niega si el correo existe — evita que alguien use
      // este form para averiguar qué correos tienen cuenta en la agencia.
      toast.success('Si ese correo tiene cuenta, te llegó un link para crear una contraseña nueva.');
      setModoRecuperar(false);
    } catch {
      setError('No se pudo enviar el correo. Intenta de nuevo en un momento.');
    } finally {
      setEnviandoRecuperacion(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email y password son requeridos');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const u = await signIn(email, password);
      setUser(u);
      toast.success(`Bienvenida, ${u.email}`);
      // Respeta el destino al que iba (ej. link de la tarea desde un correo).
      const from = (location.state as { from?: { pathname: string; search?: string; hash?: string } } | null)?.from;
      const dest = from ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/';
      navigate(dest, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-base p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md surface p-8"
      >
        <header className="mb-6 text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-2">
            {BRAND.name}
          </div>
          <h1 className="heading text-2xl lg:text-3xl font-bold">
            <span className="gradient-text">Iniciar sesión</span>
          </h1>
          <p className="text-xs text-text-muted mt-2">
            Acceso al cerebro de tu agencia.
          </p>
        </header>

        {modoRecuperar ? (
          <form onSubmit={handleRecuperar} className="space-y-3">
            <p className="text-xs text-text-secondary -mt-1 mb-1">
              Escribe tu correo y te mandamos un link para crear una contraseña nueva.
            </p>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Email</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoFocus
                required
                disabled={enviandoRecuperacion}
              />
            </label>

            {error && (
              <div className="rounded-md border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
                {error}
              </div>
            )}

            <Button type="submit" disabled={enviandoRecuperacion} className="w-full">
              {enviandoRecuperacion ? (<><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>) : 'Enviar link'}
            </Button>
            <button
              type="button"
              onClick={() => { setModoRecuperar(false); setError(null); }}
              className="w-full text-center text-[11px] text-text-muted hover:text-text-primary"
            >
              ← Volver a iniciar sesión
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Email</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoFocus
                  required
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Contraseña</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={submitting}
                />
              </label>

              {error && (
                <div className="rounded-md border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Entrando…</>
                ) : (
                  <><LogIn className="h-4 w-4" /> Iniciar sesión</>
                )}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => { setModoRecuperar(true); setError(null); }}
              className="w-full mt-3 text-center text-[11px] text-text-muted hover:text-text-primary"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        )}

        <p className="mt-6 text-[11px] text-text-muted text-center leading-relaxed">
          Sign-up cerrado. Si necesitas acceso, contacta al owner de la agencia.
        </p>
      </motion.div>
    </div>
  );
}
