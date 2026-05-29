import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { step6Schema, type Step6Data } from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { StepShell } from '../StepShell';

const MARKET_SIZES = [
  { value: 'niche', label: 'Nicho muy específico (< 10k personas)' },
  { value: 'small', label: 'Pequeño (10k – 100k)' },
  { value: 'medium', label: 'Medio (100k – 1M)' },
  { value: 'large', label: 'Grande (1M – 10M)' },
  { value: 'massive', label: 'Masivo (> 10M)' },
];

export function Step6Competition({ onNext }: { onNext: () => void }) {
  const stored = useOnboardingStore((s) => s.step6);
  const patch = useOnboardingStore((s) => s.patchStep);
  const {
    register, handleSubmit, watch, formState: { errors },
  } = useForm<Step6Data>({
    resolver: zodResolver(step6Schema),
    defaultValues: { hasSeasonality: 'no', ...stored } as Step6Data,
    mode: 'onBlur',
  });

  const seasonality = watch('hasSeasonality');

  const onSubmit = (data: Step6Data) => {
    patch('step6', data);
    onNext();
  };

  return (
    <StepShell onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Competidor directo #1" required {...register('competitor1')} error={errors.competitor1?.message} />
        <Input label="Competidor directo #2" required {...register('competitor2')} error={errors.competitor2?.message} />
        <Input label="Competidor directo #3" required {...register('competitor3')} error={errors.competitor3?.message} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea label="¿Qué hace BIEN tu competencia?" rows={4} {...register('competitorsStrengths')} />
        <Textarea
          label="¿Qué hace MAL tu competencia?"
          rows={4}
          hint="Esto es oro para tu propuesta — sé crítico."
          {...register('competitorsWeaknesses')}
        />
      </div>

      <Textarea
        label="Tu diferenciador REAL frente a la competencia"
        required
        rows={3}
        {...register('differentiator')}
        error={errors.differentiator?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="¿Hay estacionalidad en tu negocio?"
          required
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Sí' },
          ]}
          {...register('hasSeasonality')}
        />
        <Select
          label="Tamaño estimado de tu mercado potencial"
          required
          placeholder="Selecciona…"
          options={MARKET_SIZES}
          {...register('marketSize')}
          error={errors.marketSize?.message}
        />
      </div>

      {seasonality === 'yes' && (
        <Textarea
          label="Describe la estacionalidad"
          rows={3}
          placeholder="¿Cuándo y por qué? Picos / valles del año…"
          {...register('seasonalityDescription')}
        />
      )}

      <Textarea
        label="¿Hay algún evento externo próximo que afecte tu industria?"
        rows={3}
        {...register('externalEvents')}
      />
    </StepShell>
  );
}
