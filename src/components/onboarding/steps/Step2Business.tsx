import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { step2Schema, type Step2Data } from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { StepShell } from '../StepShell';

const BUSINESS_TYPES = [
  'B2C', 'B2B', 'D2C Ecommerce', 'Infoproducto / Curso', 'Servicio profesional',
  'Coaching / Mentoría', 'Software / SaaS', 'Retail físico con presencia digital', 'Otro',
];

const CURRENCIES = ['USD', 'COP', 'MXN', 'EUR', 'ARS', 'CLP', 'PEN', 'BRL'];

const REVENUE_MODELS = [
  { value: 'one_time', label: 'Venta única' },
  { value: 'subscription', label: 'Suscripción / Recurrente' },
  { value: 'mixed', label: 'Mixto' },
  { value: 'project', label: 'Por proyecto' },
  { value: 'commission', label: 'Comisión' },
];

export function Step2Business({ onNext }: { onNext: () => void }) {
  const stored = useOnboardingStore((s) => s.step2);
  const patch = useOnboardingStore((s) => s.patchStep);
  const {
    register, handleSubmit, formState: { errors },
  } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: stored,
    mode: 'onBlur',
  });

  const onSubmit = (data: Step2Data) => {
    patch('step2', data);
    onNext();
  };

  return (
    <StepShell onSubmit={handleSubmit(onSubmit)}>
      <Textarea
        label="¿Qué vendes? Describe tu producto / servicio principal"
        required
        rows={4}
        placeholder="Sé específico: para quién es, qué resuelve, cómo se entrega…"
        {...register('whatYouSell')}
        error={errors.whatYouSell?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Tipo de negocio"
          required
          placeholder="Selecciona…"
          options={BUSINESS_TYPES.map((b) => ({ value: b, label: b }))}
          {...register('businessType')}
          error={errors.businessType?.message}
        />
        <Select
          label="Modelo de ingresos"
          required
          placeholder="Selecciona…"
          options={REVENUE_MODELS}
          {...register('revenueModel')}
          error={errors.revenueModel?.message}
        />
        <Input
          label="Ticket promedio de venta"
          required
          type="number"
          min={0}
          step="0.01"
          {...register('averageTicket')}
          error={errors.averageTicket?.message}
        />
        <Select
          label="Moneda"
          required
          placeholder="Selecciona…"
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          {...register('currency')}
          error={errors.currency?.message}
        />
        <Input
          label="Producto / servicio estrella"
          required
          {...register('starProduct')}
          error={errors.starProduct?.message}
        />
      </div>

      <Textarea
        label="¿Tienes más productos / servicios? Descríbelos brevemente"
        rows={3}
        {...register('otherProducts')}
      />
    </StepShell>
  );
}
