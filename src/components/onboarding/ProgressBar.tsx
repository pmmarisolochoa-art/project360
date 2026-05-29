import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Props {
  steps: ReadonlyArray<string>;
  current: number;
  onJump?: (i: number) => void;
}

export function ProgressBar({ steps, current, onJump }: Props) {
  const percent = ((current + 1) / steps.length) * 100;
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between mb-3 text-[11px] uppercase tracking-wider">
        <span className="text-text-muted">
          Paso {current + 1} de {steps.length}
        </span>
        <span className="text-text-primary font-semibold">{Math.round(percent)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden mb-4">
        <motion.div
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-gradient-accent rounded-full shadow-glow-accent"
        />
      </div>
      <ol className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {steps.map((title, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={title}>
              <button
                type="button"
                disabled={!onJump || i > current}
                onClick={() => onJump?.(i)}
                className={cn(
                  'w-full flex flex-col items-start gap-1 rounded-md p-1.5 text-left transition disabled:cursor-not-allowed',
                  (done || active) && 'opacity-100',
                  !done && !active && 'opacity-50',
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-1.5 text-[10px] font-semibold',
                    active ? 'text-accent-violet' : done ? 'text-status-success' : 'text-text-muted',
                  )}
                >
                  <span
                    className={cn(
                      'h-4 w-4 rounded-full border flex items-center justify-center text-[9px]',
                      done && 'bg-status-success/20 border-status-success text-status-success',
                      active && 'bg-accent-violet/20 border-accent-violet',
                      !done && !active && 'border-border-default',
                    )}
                  >
                    {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                  </span>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <span className="text-[11px] text-text-secondary leading-tight line-clamp-2">{title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
