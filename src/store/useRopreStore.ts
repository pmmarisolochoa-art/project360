import { onWriteError } from './onWriteError';
import { altaOptimista, cambioOptimista, bajaOptimista } from './escrituraOptimista';
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
    const revertir = altaOptimista(() => get().items, (items) => set({ items }), item);
    void RopreRepo.create(item).catch(onWriteError('ropre.create', 'No se pudo guardar el elemento del ROPRE. Se quitó de la lista: vuelve a intentarlo.', revertir));
  },
  update: (id, patch) => {
    const revertir = cambioOptimista(() => get().items, (items) => set({ items }), id, patch);
    void RopreRepo.update(id, patch).catch(onWriteError('ropre.update', 'No se pudieron guardar los cambios del elemento del ROPRE. Se deshicieron en pantalla.', revertir));
  },
  remove: (id) => {
    const revertir = bajaOptimista(() => get().items, (items) => set({ items }), id);
    void RopreRepo.remove(id).catch(onWriteError('ropre.remove', 'No se pudo eliminar el elemento del ROPRE. Vuelve a aparecer porque sigue ahí.', revertir));
  },
  byClient: (clientId) => get().items.filter((i) => i.clientId === clientId),
}));
