import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, X, Info, XCircle } from 'lucide-react';
import { useToastStore, type ToastTone } from '@/store/useToastStore';

const TONE_STYLES: Record<ToastTone, { ring: string; bg: string; text: string; icon: React.ReactNode }> = {
  success: {
    ring: 'border-status-success/40',
    bg: 'bg-status-success/10',
    text: 'text-status-success',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  error: {
    ring: 'border-status-danger/40',
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
    icon: <XCircle className="h-4 w-4" />,
  },
  warning: {
    ring: 'border-status-warning/40',
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  info: {
    ring: 'border-accent-cyan/40',
    bg: 'bg-accent-cyan/10',
    text: 'text-accent-cyan',
    icon: <Info className="h-4 w-4" />,
  },
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const style = TONE_STYLES[t.tone];
          return (
            <motion.div
              key={t.id}
              role="status"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-[10px] border surface-elevated px-3.5 py-2.5 min-w-[280px] max-w-[420px] shadow-lg ${style.ring} ${style.bg}`}
            >
              <span className={style.text}>{style.icon}</span>
              <span className="flex-1 text-sm text-text-primary leading-snug">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-text-muted hover:text-text-primary"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
