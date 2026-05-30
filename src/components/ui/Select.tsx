import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Option {
  value: string;
  label: string;
}

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, hint, error, options, placeholder, className, required, ...rest },
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
      <span
        className={cn(
          'relative flex items-center h-10 rounded-[10px] border transition-colors',
          error
            ? 'border-status-danger/60'
            : 'focus-within:border-accent-violet/60 focus-within:shadow-glow-accent/30',
        )}
        style={{
          background: 'var(--input-bg)',
          borderColor: error ? undefined : 'var(--input-border)',
        }}
      >
        <select
          ref={ref}
          required={required}
          className={cn(
            'w-full appearance-none bg-transparent px-3 pr-9 text-sm text-text-primary outline-none',
            !rest.value && 'text-text-muted',
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-bg-elevated text-text-primary">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 h-4 w-4 text-text-muted pointer-events-none" />
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
