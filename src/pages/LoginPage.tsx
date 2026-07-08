import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Loader2 } from 'lucide-react';
import { signIn } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/store/useToastStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            Sales Brain OS
          </div>
          <h1 className="heading text-2xl lg:text-3xl font-bold">
            <span className="gradient-text">Iniciar sesión</span>
          </h1>
          <p className="text-xs text-text-muted mt-2">
            Acceso al cerebro de tu agencia.
          </p>
        </header>

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

        <p className="mt-6 text-[11px] text-text-muted text-center leading-relaxed">
          Sign-up cerrado. Si necesitas acceso, contacta al owner de la agencia.
        </p>
      </motion.div>
    </div>
  );
}
