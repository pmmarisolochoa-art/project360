import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { step7Schema, type Step7Data } from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { StepShell } from '../StepShell';

const TONES = [
  { value: 'professional', label: 'Profesional' },
  { value: 'friendly', label: 'Cercano / Amigable' },
  { value: 'inspirational', label: 'Inspiracional' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'educational', label: 'Educativo' },
  { value: 'humorous', label: 'Humorístico' },
  { value: 'premium', label: 'Exclusivo / Premium' },
  { value: 'empathic', label: 'Empático' },
  { value: 'direct', label: 'Directo / Crudo' },
];

export function Step7Content({ onNext }: { onNext: () => void }) {
  const stored = useOnboardingStore((s) => s.step7);
  const patch = useOnboardingStore((s) => s.patchStep);
  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<Step7Data>({
    resolver: zodResolver(step7Schema),
    defaultValues: {
      hasVisualIdentity: 'partial',
      hasBrandManual: 'no',
      hasTestimonials: 'no',
      contentProducer: 'solo',
      videoCapability: 'basic',
      tone: [],
      ...stored,
    } as Step7Data,
    mode: 'onBlur',
  });

  const tone = watch('tone') ?? [];
  const hasManual = watch('hasBrandManual');
  const hasTestim = watch('hasTestimonials');

  const onSubmit = (data: Step7Data) => {
    patch('step7', data);
    onNext();
  };

  return (
    <StepShell onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="¿Tienes identidad visual definida?"
          required
          options={[
            { value: 'yes', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'partial', label: 'Parcial' },
          ]}
          {...register('hasVisualIdentity')}
        />
        <Select
          label="¿Tienes manual de marca / guía de estilo?"
          required
          options={[
            { value: 'yes', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          {...register('hasBrandManual')}
        />
      </div>

      {hasManual === 'yes' && (
        <Input
          label="URL del manual de marca (Drive, Figma, PDF…)"
          placeholder="https://…"
          {...register('brandManualUrl')}
        />
      )}

      <CheckboxGroup
        label="Tono de comunicación de la marca"
        required
        options={TONES}
        value={tone}
        onChange={(v) => setValue('tone', v, { shouldValidate: true })}
        columns={3}
        error={errors.tone?.message}
      />

      <Textarea
        label="¿Tienes contenido existente que haya funcionado muy bien?"
        rows={3}
        placeholder="Pega links o describe qué piezas explotaron y por qué crees que funcionaron…"
        {...register('topPerformingContent')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="¿Tienes testimonios / casos de éxito documentados?"
          required
          options={[
            { value: 'yes', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          {...register('hasTestimonials')}
        />
        <Select
          label="¿Quién produce el contenido actualmente?"
          required
          options={[
            { value: 'solo', label: 'Solo yo' },
            { value: 'team', label: 'Tengo equipo' },
            { value: 'outsource', label: 'Tercerizo' },
            { value: 'nobody', label: 'Nadie' },
          ]}
          {...register('contentProducer')}
        />
      </div>

      {hasTestim === 'yes' && (
        <Textarea
          label="Describe brevemente tus mejores testimonios"
          rows={3}
          {...register('testimonialsDescription')}
        />
      )}

      <Select
        label="Capacidad de grabación de video"
        required
        options={[
          { value: 'studio', label: 'Sí — estudio profesional' },
          { value: 'basic', label: 'Sí — setup básico (celular + luz)' },
          { value: 'none', label: 'No tengo capacidad de grabar' },
        ]}
        {...register('videoCapability')}
      />

      <Textarea
        label="Temas sobre los que puedes hablar con autoridad"
        rows={3}
        {...register('authorityTopics')}
      />
      <Textarea
        label="Temas que la marca NO debe tocar"
        rows={3}
        hint="Política, religión, comparaciones específicas, etc."
        {...register('forbiddenTopics')}
      />
    </StepShell>
  );
}
