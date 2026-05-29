import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { Button } from '@/components/ui/Button';
import { step8Schema, type Step8Data } from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { StepShell } from '../StepShell';

const TEAM_ROLES = [
  { value: 'founder', label: 'Founder / CEO' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'content', label: 'Contenido' },
  { value: 'operations', label: 'Operaciones' },
  { value: 'design', label: 'Diseño' },
  { value: 'support', label: 'Soporte' },
];

const TOOLS = [
  { value: 'notion', label: 'Notion' },
  { value: 'trello', label: 'Trello' },
  { value: 'asana', label: 'Asana' },
  { value: 'clickup', label: 'ClickUp' },
  { value: 'slack', label: 'Slack' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'drive', label: 'Google Drive' },
  { value: 'zapier', label: 'Zapier' },
  { value: 'make', label: 'Make / Integromat' },
];

const ADS_ACCESS = [
  { value: 'meta', label: 'Meta Ads (Facebook/Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'youtube', label: 'YouTube Ads' },
  { value: 'linkedin', label: 'LinkedIn Ads' },
];

export function Step8Team({ onFinish }: { onFinish: () => void }) {
  const stored = useOnboardingStore((s) => s.step8);
  const patch = useOnboardingStore((s) => s.patchStep);
  const {
    register, handleSubmit, control, watch, setValue, formState: { errors },
  } = useForm<Step8Data>({
    resolver: zodResolver(step8Schema),
    defaultValues: {
      teamRoles: [],
      currentTools: [],
      adsAccess: [],
      projectParticipants: [],
      timezone: 'America/Bogota',
      ...stored,
    } as Step8Data,
    mode: 'onBlur',
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'projectParticipants' });
  const roles = watch('teamRoles') ?? [];
  const tools = watch('currentTools') ?? [];
  const adsAccess = watch('adsAccess') ?? [];

  const onSubmit = (data: Step8Data) => {
    patch('step8', data);
    onFinish();
  };

  return (
    <StepShell onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="¿Con cuántas personas cuenta tu equipo?"
          required
          type="number"
          min={0}
          {...register('teamSize')}
          error={errors.teamSize?.message}
        />
        <Select
          label="Zona horaria"
          required
          options={[
            { value: 'America/Bogota', label: 'Bogotá / Lima (UTC-5)' },
            { value: 'America/Mexico_City', label: 'CDMX (UTC-6)' },
            { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
            { value: 'America/Santiago', label: 'Santiago (UTC-4)' },
            { value: 'America/Los_Angeles', label: 'Los Ángeles (UTC-8)' },
            { value: 'America/New_York', label: 'Nueva York (UTC-5)' },
            { value: 'Europe/Madrid', label: 'Madrid (UTC+1)' },
          ]}
          {...register('timezone')}
        />
      </div>

      <CheckboxGroup
        label="Roles que existen en tu equipo"
        options={TEAM_ROLES}
        value={roles}
        onChange={(v) => setValue('teamRoles', v)}
        columns={3}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-medium text-text-secondary">
              Participantes activos en el proyecto
            </div>
            <div className="text-[11px] text-text-muted">
              Las personas que se conectarán con nuestro equipo
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => append({ name: '', role: '', email: '', whatsapp: '' })}
          >
            Agregar
          </Button>
        </div>

        <div className="space-y-2">
          {fields.length === 0 && (
            <div className="surface p-3 text-xs text-text-muted text-center">
              Aún no agregaste participantes
            </div>
          )}
          {fields.map((field, i) => (
            <div key={field.id} className="surface p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
              <Input
                label="Nombre"
                className="md:col-span-3"
                {...register(`projectParticipants.${i}.name` as const)}
              />
              <Input
                label="Rol"
                className="md:col-span-3"
                {...register(`projectParticipants.${i}.role` as const)}
              />
              <Input
                label="Email"
                type="email"
                className="md:col-span-3"
                {...register(`projectParticipants.${i}.email` as const)}
              />
              <Input
                label="WhatsApp"
                className="md:col-span-2"
                {...register(`projectParticipants.${i}.whatsapp` as const)}
              />
              <div className="md:col-span-1 flex justify-end pt-6">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="h-9 w-9 rounded-md text-text-muted hover:text-status-danger hover:bg-bg-elevated"
                  aria-label="Eliminar participante"
                >
                  <Trash2 className="h-4 w-4 mx-auto" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CheckboxGroup
        label="Herramientas que usas actualmente"
        options={TOOLS}
        value={tools}
        onChange={(v) => setValue('currentTools', v)}
        columns={3}
      />

      <CheckboxGroup
        label="¿A qué cuentas de ADS puedes darnos acceso?"
        options={ADS_ACCESS}
        value={adsAccess}
        onChange={(v) => setValue('adsAccess', v)}
        columns={2}
      />

      <Input
        label="Horario preferido para reuniones"
        required
        placeholder="Ej: lunes-jueves de 10 a 12am"
        {...register('preferredMeetingTime')}
        error={errors.preferredMeetingTime?.message}
      />

      <Textarea
        label="¿Hay alguna restricción o condición importante que debamos saber?"
        rows={3}
        {...register('restrictions')}
      />
      <Textarea
        label="Información adicional relevante"
        rows={3}
        {...register('additionalInfo')}
      />
    </StepShell>
  );
}
