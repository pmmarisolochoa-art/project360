import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  Step6Data,
  Step7Data,
  Step8Data,
} from './schema';

interface OnboardingState {
  currentStep: number;
  step1?: Partial<Step1Data>;
  step2?: Partial<Step2Data>;
  step3?: Partial<Step3Data>;
  step4?: Partial<Step4Data>;
  step5?: Partial<Step5Data>;
  step6?: Partial<Step6Data>;
  step7?: Partial<Step7Data>;
  step8?: Partial<Step8Data>;
  setStep: (n: number) => void;
  patchStep: <K extends keyof OnboardingState>(key: K, data: Partial<OnboardingState[K]>) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 0,
      setStep: (n) => set({ currentStep: n }),
      patchStep: (key, data) => set((s) => ({ ...s, [key]: { ...(s[key] as object), ...data } })),
      reset: () =>
        set({
          currentStep: 0,
          step1: undefined,
          step2: undefined,
          step3: undefined,
          step4: undefined,
          step5: undefined,
          step6: undefined,
          step7: undefined,
          step8: undefined,
        }),
    }),
    { name: 'sales-brain-onboarding' },
  ),
);
