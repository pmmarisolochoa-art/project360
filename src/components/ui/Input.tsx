import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, leftAdornment, rightAdornment, className, id, required, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
          {required && <span className="text-status-danger ml-1">*</span>}
        </span>
      )}
      <span
        className={cn(
          'flex items-center gap-2 h-10 rounded-[10px] border px-3 transition-colors',
          error
            ? 'border-status-danger/60'
            : 'focus-within:border-accent-violet/60 focus-within:shadow-glow-accent/30',
        )}
        style={{
          background: 'var(--input-bg)',
          borderColor: error ? undefined : 'var(--input-border)',
        }}
      >
        {leftAdornment && <span className="text-text-muted">{leftAdornment}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none',
            className,
          )}
          required={required}
          {...rest}
        />
        {rightAdornment && <span className="text-text-muted">{rightAdornment}</span>}
      </span>
      {(error || hint) && (
        <span
          className={cn(
            'block text-[11px] mt-1',
            error ? 'text-status-danger' : 'text-text-muted',
          )}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  );
});
