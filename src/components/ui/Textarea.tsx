import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, hint, error, className, required, ...rest },
  ref,
) {
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
          {required && <span className="text-status-danger ml-1">*</span>}
        </span>
      )}
      <textarea
        ref={ref}
        rows={rest.rows ?? 4}
        className={cn(
          'w-full rounded-[10px] border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none resize-y transition-colors',
          error
            ? 'border-status-danger/60'
            : 'focus:border-accent-violet/60 focus:shadow-glow-accent/30',
          className,
        )}
        style={{
          background: 'var(--input-bg)',
          borderColor: error ? undefined : 'var(--input-border)',
        }}
        required={required}
        {...rest}
      />
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
