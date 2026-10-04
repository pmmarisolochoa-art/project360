import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/store/useToastStore';
import { BRAND } from '@/config/brand';

/**
 * Destino del link de recuperación que manda Supabase (ver LoginPage →
 * resetPasswordForEmail). El link trae el token en la URL y supabase-js crea
 * sola una sesión temporal al cargar esta página — de ahí que `updateUser`
 * funcione sin pedir la contraseña vieja.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las dos contraseñas no coinciden.'); return; }
    if (!supabase) { setError('Sin conexión a Supabase.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      toast.success('Contraseña actualizada — ya puedes entrar con ella.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? 'El link expiró o ya se usó. Pide uno nuevo desde "Olvidé mi contraseña".'
          : 'Error al actualizar',
      );
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
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-2">{BRAND.name}</div>
          <h1 className="heading text-2xl lg:text-3xl font-bold">
            <span className="gradient-text">Nueva contraseña</span>
          </h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Contraseña nueva</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
              disabled={submitting}
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Repítela</span>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>) : (<><KeyRound className="h-4 w-4" /> Guardar contraseña</>)}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
