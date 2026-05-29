import { create } from 'zustand';
import type { SopAssessment } from '@/types/viability';

interface SopState {
  assessments: SopAssessment[];
  save: (a: SopAssessment) => void;
  remove: (id: string) => void;
  setDecision: (id: string, decision: string) => void;
}

export const useSopStore = create<SopState>((set) => ({
  assessments: [],
  save: (a) => set((s) => ({ assessments: [a, ...s.assessments.filter((x) => x.id !== a.id)] })),
  remove: (id) => set((s) => ({ assessments: s.assessments.filter((a) => a.id !== id) })),
  setDecision: (id, decision) => set((s) => ({ assessments: s.assessments.map((a) => (a.id === id ? { ...a, decision } : a)) })),
}));
