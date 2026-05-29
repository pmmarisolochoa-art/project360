import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { step5Schema, type Step5Data } from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { StepShell } from '../StepShell';

const OBJECTIVES = [
  { value: 'leads', label: 'Generar leads calificados' },
  { value: 'direct_sales', label: 'Aumentar ventas directas' },
  { value: 'audience', label: 'Construir audiencia' },
  { value: 'brand', label: 'Posicionar marca' },
  { value: 'launch', label: 'Lanzar nuevo producto' },
  { value: 'recover', label: 'Recuperar clientes' },
  { value: 'scale', label: 'Escalar operación' },
];

const BUDGET_RANGES = ['< $500', '$500 – $1.500', '$1.500 – $5.000', '$5.000 – $15.000', '> $15.000'];

export function Step5Goals({ onNext }: { onNext: () => void }) {
  const stored = useOnboardingStore((s) => s.step5);
  const patch = useOnboardingStore((s) => s.patchStep);
  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<Step5Data>({
    resolver: zodResolver(step5Schema),
    defaultValues: { primaryObjectives: [], ...stored } as Step5Data,
    mode: 'onBlur',
  });

  const objectives = watch('primaryObjectives') ?? [];

  const onSubmit = (data: Step5Data) => {
    patch('step5', data);
    onNext();
  };

  return (
    <StepShell onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Meta a 3 meses" required type="number" min={0} leftAdornment="$" {...register('revenue3m')} error={errors.revenue3m?.message} />
        <Input label="Meta a 6 meses" required type="number" min={0} leftAdornment="$" {...register('revenue6m')} error={errors.revenue6m?.message} />
        <Input label="Meta a 12 meses" required type="number" min={0} leftAdornment="$" {...register('revenue12m')} error={errors.revenue12m?.message} />
      </div>

      <Input
        label="Clientes nuevos por mes que necesitas para alcanzar tu meta"
        required
        type="number"
        min={0}
        {...register('newClientsNeeded')}
        error={errors.newClientsNeeded?.message}
      />

      <CheckboxGroup
        label="Objetivo principal del proyecto"
        required
        options={OBJECTIVES}
        value={objectives}
        onChange={(v) => setValue('primaryObjectives', v, { shouldValidate: true })}
        columns={3}
        error={errors.primaryObjectives?.message}
      />

      <Textarea
        label="¿Qué consideras un éxito absoluto al finalizar el proyecto?"
        required
        rows={4}
        placeholder="Describe el resultado tangible que cambiaría todo para tu negocio…"
        {...register('successDefinition')}
        error={errors.successDefinition?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Presupuesto mensual ADS"
          required
          placeholder="Selecciona…"
          options={BUDGET_RANGES.map((b) => ({ value: b, label: b }))}
          {...register('adsBudgetMonthly')}
          error={errors.adsBudgetMonthly?.message}
        />
        <Select
          label="Presupuesto mensual contenido"
          placeholder="Selecciona…"
          options={BUDGET_RANGES.map((b) => ({ value: b, label: b }))}
          {...register('contentBudgetMonthly')}
        />
        <Input
          label="Fecha ideal de inicio"
          required
          type="date"
          {...register('idealStartDate')}
          error={errors.idealStartDate?.message}
        />
      </div>
    </StepShell>
  );
}
