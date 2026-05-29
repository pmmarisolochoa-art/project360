import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { Slider } from '@/components/ui/Slider';
import { step3Schema, type Step3Data } from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { StepShell } from '../StepShell';

const REVENUE_RANGES = [
  '< 1.000 USD', '1.000 – 3.000 USD', '3.000 – 10.000 USD',
  '10.000 – 30.000 USD', '30.000 – 100.000 USD', '> 100.000 USD',
];

const BUDGET_RANGES = ['$0', '< $500', '$500 – $1.500', '$1.500 – $5.000', '$5.000 – $15.000', '> $15.000'];

const ACQUISITION_CHANNELS = [
  { value: 'referrals', label: 'Referidos' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'organic', label: 'Contenido orgánico' },
  { value: 'events', label: 'Eventos' },
  { value: 'cold_outreach', label: 'Cold outreach' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'tiktok_ads', label: 'TikTok Ads' },
  { value: 'email', label: 'Email marketing' },
  { value: 'other', label: 'Otro' },
];

const CRMS = ['HubSpot', 'Salesforce', 'Pipedrive', 'Notion', 'Spreadsheet', 'Otro'];

export function Step3Current({ onNext }: { onNext: () => void }) {
  const stored = useOnboardingStore((s) => s.step3);
  const patch = useOnboardingStore((s) => s.patchStep);
  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: { closeRate: 20, acquisitionChannels: [], hasFunnel: 'no', hasCrm: 'no', ...stored } as Step3Data,
    mode: 'onBlur',
  });

  const closeRate = watch('closeRate');
  const hasFunnel = watch('hasFunnel');
  const hasCrm = watch('hasCrm');
  const channels = watch('acquisitionChannels') ?? [];

  const onSubmit = (data: Step3Data) => {
    patch('step3', data);
    onNext();
  };

  return (
    <StepShell onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Facturación mensual promedio actual"
          required
          placeholder="Selecciona…"
          options={REVENUE_RANGES.map((r) => ({ value: r, label: r }))}
          {...register('monthlyRevenue')}
          error={errors.monthlyRevenue?.message}
        />
        <Input
          label="Clientes nuevos al mes actualmente"
          required
          type="number"
          min={0}
          {...register('newClientsMonth')}
          error={errors.newClientsMonth?.message}
        />
      </div>

      <CheckboxGroup
        label="¿Cómo consigues clientes actualmente?"
        required
        options={ACQUISITION_CHANNELS}
        value={channels}
        onChange={(v) => setValue('acquisitionChannels', v, { shouldValidate: true })}
        columns={3}
        error={errors.acquisitionChannels?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="¿Tienes embudo de ventas definido?"
          required
          options={[
            { value: 'yes', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'building', label: 'En construcción' },
          ]}
          {...register('hasFunnel')}
          error={errors.hasFunnel?.message}
        />
        <Select
          label="Inversión actual en publicidad/mes"
          required
          placeholder="Selecciona…"
          options={BUDGET_RANGES.map((b) => ({ value: b, label: b }))}
          {...register('currentAdsBudget')}
          error={errors.currentAdsBudget?.message}
        />
      </div>

      {hasFunnel === 'yes' && (
        <Textarea
          label="Describe brevemente tu embudo"
          rows={3}
          {...register('funnelDescription')}
        />
      )}

      <Textarea
        label="Tus 3 principales canales de adquisición hoy"
        required
        rows={2}
        placeholder="1. … 2. … 3. …"
        {...register('top3Channels')}
        error={errors.top3Channels?.message}
      />

      <Slider
        label="Tasa de cierre aproximada"
        suffix="%"
        min={0}
        max={100}
        value={closeRate}
        onChange={(e) => setValue('closeRate', Number(e.target.value), { shouldValidate: true })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="¿Tienes CRM?"
          required
          options={[
            { value: 'yes', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          {...register('hasCrm')}
        />
        {hasCrm === 'yes' && (
          <Select
            label="¿Cuál CRM?"
            placeholder="Selecciona…"
            options={CRMS.map((c) => ({ value: c, label: c }))}
            {...register('crmName')}
          />
        )}
      </div>
    </StepShell>
  );
}
