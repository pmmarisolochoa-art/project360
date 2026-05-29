import { create } from 'zustand';
import type { DeliverableItem, LinkItem } from '@/types/repository';

interface State {
  deliverables: DeliverableItem[];
  links: LinkItem[];
  addDeliverable: (d: DeliverableItem) => void;
  updateDeliverable: (id: string, patch: Partial<DeliverableItem>) => void;
  removeDeliverable: (id: string) => void;
  addLink: (l: LinkItem) => void;
  updateLink: (id: string, patch: Partial<LinkItem>) => void;
  removeLink: (id: string) => void;
}

export const useRepositoryStore = create<State>((set) => ({
  deliverables: [],
  links: [],
  addDeliverable: (d) => set((s) => ({ deliverables: [d, ...s.deliverables] })),
  updateDeliverable: (id, patch) => set((s) => ({ deliverables: s.deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
  removeDeliverable: (id) => set((s) => ({ deliverables: s.deliverables.filter((d) => d.id !== id) })),
  addLink: (l) => set((s) => ({ links: [l, ...s.links] })),
  updateLink: (id, patch) => set((s) => ({ links: s.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
  removeLink: (id) => set((s) => ({ links: s.links.filter((l) => l.id !== id) })),
}));
