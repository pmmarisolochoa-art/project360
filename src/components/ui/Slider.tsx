import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  suffix?: string;
}

export function Slider({ label, suffix, value, onChange, min, max, step, ...rest }: Props) {
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-xs font-medium text-text-secondary mb-1.5">
          <span>{label}</span>
          <span className="text-text-primary font-semibold">
            {value}
            {suffix}
          </span>
        </div>
      )}
      <input
        type="range"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        className="w-full accent-accent-violet"
        {...rest}
      />
    </div>
  );
}
