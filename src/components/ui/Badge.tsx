import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'subtle';

const TONE_STYLE: Record<Tone, React.CSSProperties> = {
  neutral: { background: 'var(--badge-neutral-bg)', color: 'var(--badge-neutral-text)', borderColor: 'var(--badge-neutral-border)' },
  success: { background: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', borderColor: 'var(--badge-success-border)' },
  warning: { background: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)', borderColor: 'var(--badge-warning-border)' },
  danger:  { background: 'var(--badge-danger-bg)',  color: 'var(--badge-danger-text)',  borderColor: 'var(--badge-danger-border)' },
  info:    { background: 'var(--badge-info-bg)',    color: 'var(--badge-info-text)',    borderColor: 'var(--badge-info-border)' },
  accent:  { background: 'var(--badge-accent-bg)',  color: 'var(--badge-accent-text)',  borderColor: 'var(--badge-accent-border)' },
  subtle:  { background: 'var(--badge-subtle-bg)',  color: 'var(--badge-subtle-text)',  borderColor: 'var(--badge-subtle-border)' },
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      style={TONE_STYLE[tone]}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider',
        className,
      )}
    >
      {children}
    </span>
  );
}
