import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from './ProgressBar';
import { Step1Identity } from './steps/Step1Identity';
import { Step2Business } from './steps/Step2Business';
import { Step3Current } from './steps/Step3Current';
import { Step4Audience } from './steps/Step4Audience';
import { Step5Goals } from './steps/Step5Goals';
import { Step6Competition } from './steps/Step6Competition';
import { Step7Content } from './steps/Step7Content';
import { Step8Team } from './steps/Step8Team';
import { BrainActivating } from './BrainActivating';
import {
  stepTitles, stepSubtitles, onboardingSchema, type OnboardingData,
} from '@/onboarding/schema';
import { useOnboardingStore } from '@/onboarding/store';
import { useClientStore } from '@/store/useClientStore';
import { useFunnelLaunchStore } from '@/store/useFunnelLaunchStore';
import { generateBrainFromOnboarding } from '@/services/claudeApi';
import { generateAccentColor } from '@/utils/colorGenerator';
import type { Client, ProjectType } from '@/types/client';
import type { FunnelTemplateKey } from '@/types/funnel';
import { FUNNEL_TEMPLATES } from '@/data/funnelTemplates';
import { FunnelTemplateSelector, FunnelCreationProgress } from './FunnelTemplateSelector';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { genId } from '@/utils/id';

export function OnboardingWizard() {
  const navigate = useNavigate();
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const setStep = useOnboardingStore((s) => s.setStep);
  const reset = useOnboardingStore((s) => s.reset);
  const stored = useOnboardingStore.getState;
  const addClient = useClientStore((s) => s.addClient);
  const updateClient = useClientStore((s) => s.updateClient);
  const activateFromTemplate = useFunnelLaunchStore((s) => s.activateFromTemplate);

  // Máquina de estados del cierre del wizard:
  //   'idle' → user editando pasos
  //   'activating' → llamada a Claude para generar el brain
  //   'choosing_funnel' → cliente creado, mostrando selector de embudo
  //   'materializing' → creando funnel + fases + tareas en Supabase
  type FinishStage = 'idle' | 'activating' | 'choosing_funnel' | 'materializing';
  const [stage, setStage] = useState<FinishStage>('idle');
  const [createdClient, setCreatedClient] = useState<Client | null>(null);
  const [materializingTemplateName, setMaterializingTemplateName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const goNext = () => setStep(Math.min(currentStep + 1, stepTitles.length - 1));
  const goBack = () => setStep(Math.max(currentStep - 1, 0));

  const finish = async () => {
    setError(null);
    const snapshot = stored();
    const parsed = onboardingSchema.safeParse({
      step1: snapshot.step1,
      step2: snapshot.step2,
      step3: snapshot.step3,
      step4: snapshot.step4,
      step5: snapshot.step5,
      step6: snapshot.step6,
      step7: snapshot.step7,
      step8: snapshot.step8,
    });

    if (!parsed.success) {
      setError('Algunos pasos no quedaron completos. Vuelve atrás y revisa los marcados en rojo.');
      return;
    }

    setStage('activating');

    try {
      const brain = await generateBrainFromOnboarding(parsed.data);
      const client = buildClientFromOnboarding(parsed.data, brain);
      addClient(client);
      setCreatedClient(client);
      // En vez de navegar directo, pasamos al selector de embudo. El cliente
      // ya está creado y persistido — si el usuario cierra ahora, lo
      // encuentra en /clients y puede elegir embudo después.
      setStage('choosing_funnel');
    } catch {
      setError('No pudimos activar el cerebro. Reintenta en unos segundos.');
      setStage('idle');
    }
  };

  const handleFunnelConfirm = (templateKey: FunnelTemplateKey) => {
    if (!createdClient) return;
    const template = FUNNEL_TEMPLATES.find((t) => t.key === templateKey);
    if (!template) return;
    setMaterializingTemplateName(template.name);
    setStage('materializing');

    // La materialización es síncrona en memoria + fire-and-forget a Supabase.
    // Damos ~600ms para que el progress bar se vea y dé feedback visual.
    try {
      const funnel = activateFromTemplate(createdClient.id, templateKey, new Date());
      const totalTasks = template.phases.reduce((sum, p) => sum + p.tasks.length, 0);
      if (funnel) {
        updateClient(createdClient.id, { activeFunnelId: funnel.id });
      }
      setTimeout(() => {
        reset();
        toast.success(`✅ ${totalTasks} tareas creadas. Tu embudo está listo.`);
        navigate(`/client/${createdClient.id}/tasks`);
      }, 600);
    } catch (e) {
      console.warn('[funnel.materialize]', e);
      setError('No pudimos crear el embudo. El cliente ya quedó guardado — puedes elegir embudo desde Planeación.');
      setTimeout(() => {
        reset();
        navigate(`/client/${createdClient.id}/planning`);
      }, 1500);
    }
  };

  const handleFunnelSkip = () => {
    if (!createdClient) return;
    reset();
    navigate(`/client/${createdClient.id}/planning`);
  };

  if (stage === 'activating') return <BrainActivating />;

  if (stage === 'choosing_funnel' && createdClient) {
    return (
      <FunnelTemplateSelector
        clientName={createdClient.name}
        accentColor={createdClient.primaryColor}
        onConfirm={handleFunnelConfirm}
        onSkip={handleFunnelSkip}
      />
    );
  }

  if (stage === 'materializing' && createdClient) {
    return (
      <FunnelCreationProgress
        templateName={materializingTemplateName}
        accentColor={createdClient.primaryColor}
      />
    );
  }

  const StepComponent = [
    Step1Identity, Step2Business, Step3Current, Step4Audience,
    Step5Goals, Step6Competition, Step7Content, Step8Team,
  ][currentStep];

  const isLast = currentStep === stepTitles.length - 1;

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-5">
      <header className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">
          Activación de cerebro
        </div>
        <h1 className="heading text-3xl font-bold">
          <span className="gradient-text">{stepTitles[currentStep]}</span>
        </h1>
        <p className="text-sm text-text-secondary">{stepSubtitles[currentStep]}</p>
      </header>

      <ProgressBar steps={stepTitles} current={currentStep} onJump={(i) => i <= currentStep && setStep(i)} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="surface p-6"
        >
          {isLast ? (
            <Step8Team onFinish={finish} />
          ) : (() => {
            const Comp = StepComponent as React.ComponentType<{ onNext: () => void }>;
            return <Comp onNext={goNext} />;
          })()}
        </motion.div>
      </AnimatePresence>

      {error && (
        <div className="surface border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={goBack}
          disabled={currentStep === 0}
        >
          Anterior
        </Button>

        <Button
          type="submit"
          form="onboarding-step-form"
          rightIcon={isLast ? <Sparkles className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        >
          {isLast ? 'Activar cerebro' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}

function buildClientFromOnboarding(data: OnboardingData, brain: Awaited<ReturnType<typeof generateBrainFromOnboarding>>): Client {
  const name = data.step1.businessName;
  const projectType = (brain.recommendedSystem ?? 'evergreen') as ProjectType;
  const adsBudget = parseBudgetMid(data.step5.adsBudgetMonthly);

  return {
    id: genId(),
    agencyId: useAuthStore.getState().agencyId ?? 'a_1',
    name,
    industry: data.step1.industry,
    businessType: data.step2.businessType,
    primaryColor: generateAccentColor(name),
    status: 'onboarding',
    projectType,
    monthlyAdsBudget: adsBudget,
    adsConnected: { meta: false, google: false, tiktok: false, ga4: false },
    metrics: {
      roas: null,
      pendingTasksToday: brain.initialDeliverables?.length ?? 0,
      nextMeetingAt: null,
      progressPercent: 5,
      bottleneck: { role: 'Estratega', reason: 'Pendiente sesión de kickoff' },
    },
    onboardingData: {
      identity: {
        businessName: data.step1.businessName,
        founderName: data.step1.founderName,
        email: data.step1.email,
        whatsapp: data.step1.whatsapp,
        industry: data.step1.industry,
        yearsInMarket: data.step1.yearsInMarket,
        country: data.step1.country,
        city: data.step1.city,
        website: data.step1.website || undefined,
        socials: data.step1.socialUrls as Record<string, string>,
      },
      business: data.step2,
      current: data.step3,
      audience: data.step4,
      goals: data.step5,
      competition: data.step6,
      content: data.step7,
      team: data.step8,
    },
    aiBrainData: brain,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function parseBudgetMid(range: string): number {
  // Devuelve el punto medio aproximado del rango seleccionado para usarlo como dato base.
  const nums = range.match(/\d[\d.,]*/g)?.map((n) => Number(n.replace(/[.,]/g, ''))) ?? [];
  if (nums.length === 2) return (nums[0] + nums[1]) / 2;
  if (nums.length === 1) return nums[0];
  return 0;
}
