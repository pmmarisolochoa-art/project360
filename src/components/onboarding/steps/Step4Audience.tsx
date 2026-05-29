import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { Slider } from '@/components/ui/Slider';
import { step4Schema, type Step4Data } from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { StepShell } from '../StepShell';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'whatsapp', label: 'Grupos de WhatsApp' },
  { value: 'forums', label: 'Foros / Reddit' },
];

export function Step4Audience({ onNext }: { onNext: () => void }) {
  const stored = useOnboardingStore((s) => s.step4);
  const patch = useOnboardingStore((s) => s.patchStep);
  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      ageRange: [25, 45],
      predominantGender: 'mixto',
      socioeconomicLevel: 'medio',
      onlineHangouts: [],
      ...stored,
    } as Step4Data,
    mode: 'onBlur',
  });

  const ageRange = watch('ageRange') ?? [25, 45];
  const hangouts = watch('onlineHangouts') ?? [];

  const onSubmit = (data: Step4Data) => {
    patch('step4', data);
    onNext();
  };

  return (
    <StepShell onSubmit={handleSubmit(onSubmit)}>
      <Textarea
        label="Describe a tu cliente ideal en detalle"
        required
        rows={5}
        placeholder="Edad, ocupación, situación de vida, qué consume, qué le frustra…"
        {...register('idealClientDescription')}
        error={errors.idealClientDescription?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium text-text-secondary mb-1.5">
            Rango de edad predominante
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Slider
              label="Desde"
              suffix=" años"
              min={13}
              max={80}
              value={ageRange[0]}
              onChange={(e) => setValue('ageRange', [Number(e.target.value), ageRange[1]])}
            />
            <Slider
              label="Hasta"
              suffix=" años"
              min={13}
              max={80}
              value={ageRange[1]}
              onChange={(e) => setValue('ageRange', [ageRange[0], Number(e.target.value)])}
            />
          </div>
        </div>
        <Select
          label="Género predominante"
          required
          options={[
            { value: 'mujeres', label: 'Mujeres' },
            { value: 'hombres', label: 'Hombres' },
            { value: 'mixto', label: 'Mixto' },
            { value: 'otro', label: 'Otro / No binario' },
          ]}
          {...register('predominantGender')}
        />
        <Select
          label="Nivel socioeconómico"
          required
          options={[
            { value: 'bajo', label: 'Bajo' },
            { value: 'medio', label: 'Medio' },
            { value: 'medio_alto', label: 'Medio-alto' },
            { value: 'alto', label: 'Alto' },
            { value: 'premium', label: 'Premium / Lujo' },
          ]}
          {...register('socioeconomicLevel')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea
          label="Top 3 dolores / problemas que quiere resolver"
          required
          rows={4}
          {...register('topPains')}
          error={errors.topPains?.message}
        />
        <Textarea
          label="Top 3 deseos / aspiraciones"
          required
          rows={4}
          {...register('topDesires')}
          error={errors.topDesires?.message}
        />
      </div>

      <Textarea
        label="Objeciones comunes antes de comprar"
        required
        rows={3}
        {...register('objections')}
        error={errors.objections?.message}
      />
      <Textarea
        label="¿Qué lenguaje usa tu cliente para describir su problema?"
        rows={3}
        hint="Frases textuales que tu cliente usaría — útil para copy."
        {...register('clientLanguage')}
      />

      <CheckboxGroup
        label="¿Dónde pasa el tiempo online tu cliente ideal?"
        options={PLATFORMS}
        value={hangouts}
        onChange={(v) => setValue('onlineHangouts', v)}
        columns={3}
      />

      <Textarea
        label="Competidores o marcas similares que consume"
        rows={3}
        {...register('consumedBrands')}
      />
    </StepShell>
  );
}
