import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Check, Sparkles } from 'lucide-react';

const STAGES = [
  'Procesando ADN del negocio',
  'Sintetizando buyer personas',
  'Construyendo oferta irresistible',
  'Analizando brechas vs metas',
  'Activando neuronas del cerebro',
];

export function BrainActivating() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 520);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          rotate: [0, 4, -4, 0],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-accent blur-3xl opacity-50" />
        <div className="relative h-28 w-28 rounded-full bg-gradient-accent flex items-center justify-center shadow-glow-accent">
          <Brain className="h-12 w-12 text-white" />
        </div>
        <motion.div
          animate={{ y: [-2, -10, -2], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="absolute -top-3 -right-3 text-accent-cyan"
        >
          <Sparkles className="h-6 w-6" />
        </motion.div>
      </motion.div>

      <h1 className="heading text-3xl md:text-4xl font-bold mb-2">
        <span className="gradient-text">Cerebro activando…</span>
      </h1>
      <p className="text-sm text-text-secondary mb-10 max-w-md">
        Procesando tu información con IA para construir la propuesta estratégica
        inicial de tu cerebro digital.
      </p>

      <ul className="w-full max-w-sm space-y-2.5">
        {STAGES.map((label, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <motion.li
              key={label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center gap-3 rounded-[10px] border p-3 text-sm transition-all ${
                done
                  ? 'border-status-success/30 bg-status-success/5 text-text-primary'
                  : active
                  ? 'border-accent-violet/40 bg-accent-violet/10 text-text-primary shadow-glow-accent/30'
                  : 'border-border-subtle bg-bg-surface text-text-muted'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                  done
                    ? 'bg-status-success/20 text-status-success'
                    : active
                    ? 'bg-accent-violet/20 text-accent-violet'
                    : 'bg-bg-elevated text-text-muted'
                }`}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : active ? (
                  <span className="inline-block h-2 w-2 rounded-full bg-accent-violet animate-pulse" />
                ) : (
                  i + 1
                )}
              </span>
              {label}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
