import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Option {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  hint?: string;
  error?: string;
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  required?: boolean;
  columns?: 1 | 2 | 3;
}

export function CheckboxGroup({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  required,
  columns = 2,
}: Props) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div>
      {label && (
        <div className="text-xs font-medium text-text-secondary mb-1.5">
          {label}
          {required && <span className="text-status-danger ml-1">*</span>}
        </div>
      )}
      <div
        className={cn(
          'grid gap-2',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        )}
      >
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => toggle(o.value)}
              className={cn(
                'flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-sm text-left transition-all focus-ring',
                checked
                  ? 'border-accent-violet/50 bg-accent-violet/10 text-text-primary shadow-glow-accent/30'
                  : 'border-border-subtle bg-bg-surface text-text-secondary hover:bg-bg-elevated',
              )}
            >
              <span
                className={cn(
                  'h-4 w-4 rounded-[5px] border flex items-center justify-center transition-colors',
                  checked
                    ? 'border-accent-violet bg-gradient-accent'
                    : 'border-border-strong bg-bg-base',
                )}
              >
                {checked && <Check className="h-3 w-3 text-white" />}
              </span>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      {(error || hint) && (
        <div
          className={cn(
            'text-[11px] mt-1',
            error ? 'text-status-danger' : 'text-text-muted',
          )}
        >
          {error ?? hint}
        </div>
      )}
    </div>
  );
}
