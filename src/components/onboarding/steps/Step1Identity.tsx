import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { step1Schema, type Step1Data } from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { StepShell } from '../StepShell';

const INDUSTRIES = [
  'Salud & Bienestar', 'EdTech', 'Moda & Streetwear', 'Belleza', 'Inmobiliario',
  'Fitness', 'Coaching', 'Software / SaaS', 'Consultoría', 'Restaurantes',
  'Servicios profesionales', 'Otro',
];

const SOCIAL_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X (Twitter)' },
];

export function Step1Identity({ onNext }: { onNext: () => void }) {
  const stored = useOnboardingStore((s) => s.step1);
  const patch = useOnboardingStore((s) => s.patchStep);

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { socials: [], socialUrls: {}, ...stored },
    mode: 'onBlur',
  });

  const socials = watch('socials') ?? [];
  const industry = watch('industry');

  const onSubmit = (data: Step1Data) => {
    patch('step1', data);
    onNext();
  };

  return (
    <StepShell onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nombre comercial" required {...register('businessName')} error={errors.businessName?.message} />
        <Input label="Nombre del fundador / contacto principal" required {...register('founderName')} error={errors.founderName?.message} />
        <Input label="Email de contacto" type="email" required {...register('email')} error={errors.email?.message} />
        <Input label="WhatsApp (con código de país)" required placeholder="+57 300 000 0000" {...register('whatsapp')} error={errors.whatsapp?.message} />
        <Select
          label="Industria / sector"
          required
          placeholder="Selecciona…"
          options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
          {...register('industry')}
          error={errors.industry?.message}
        />
        {industry === 'Otro' && (
          <Input label="Especifica industria" {...register('industryOther')} />
        )}
        <Input label="Años en el mercado" type="number" required min={0} {...register('yearsInMarket')} error={errors.yearsInMarket?.message} />
        <Input label="País" required {...register('country')} error={errors.country?.message} />
        <Input label="Ciudad" required {...register('city')} error={errors.city?.message} />
        <Input label="Sitio web (opcional)" placeholder="https://…" {...register('website')} error={errors.website?.message} />
      </div>

      <CheckboxGroup
        label="Redes sociales activas"
        options={SOCIAL_OPTIONS}
        value={socials}
        onChange={(v) => setValue('socials', v, { shouldValidate: true })}
        columns={3}
      />

      {socials.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {socials.map((s) => (
            <Input
              key={s}
              label={`URL / handle en ${s}`}
              placeholder={`@usuario o url`}
              onChange={(e) => {
                const current = watch('socialUrls') ?? {};
                setValue('socialUrls', { ...current, [s]: e.target.value });
              }}
              defaultValue={watch('socialUrls')?.[s] ?? ''}
            />
          ))}
        </div>
      )}

      <Input label="Logo (URL del logo o súbelo más tarde)" placeholder="https://…" {...register('logoUrl')} />
    </StepShell>
  );
}
