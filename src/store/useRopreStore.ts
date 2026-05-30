import { create } from 'zustand';
import type { RopreItem } from '@/types/ropre';
import { RopreRepo } from '@/services/repositories';

interface RopreState {
  items: RopreItem[];
  add: (item: RopreItem) => void;
  update: (id: string, patch: Partial<RopreItem>) => void;
  remove: (id: string) => void;
  byClient: (clientId: string) => RopreItem[];
}

export const useRopreStore = create<RopreState>((set, get) => ({
  items: [],
  add: (item) => {
    set((s) => ({ items: [item, ...s.items] }));
    void RopreRepo.create(item).catch((e) => console.warn('[ropre.create]', e));
  },
  update: (id, patch) => {
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    void RopreRepo.update(id, patch).catch((e) => console.warn('[ropre.update]', e));
  },
  remove: (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    void RopreRepo.remove(id).catch((e) => console.warn('[ropre.remove]', e));
  },
  byClient: (clientId) => get().items.filter((i) => i.clientId === clientId),
}));
