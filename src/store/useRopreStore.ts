import { onWriteError } from './onWriteError';
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
    void RopreRepo.create(item).catch(onWriteError('ropre.create', 'No se pudo guardar el elemento del ROPRE. El equipo no lo verá hasta que se guarde.'));
  },
  update: (id, patch) => {
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    void RopreRepo.update(id, patch).catch(onWriteError('ropre.update', 'No se pudieron guardar los cambios del ROPRE. Recarga para ver el estado real.'));
  },
  remove: (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    void RopreRepo.remove(id).catch(onWriteError('ropre.remove', 'No se pudo eliminar el elemento del ROPRE. Recarga: puede seguir ahí.'));
  },
  byClient: (clientId) => get().items.filter((i) => i.clientId === clientId),
}));
