import { onWriteError } from './onWriteError';
import { altaOptimista, cambioOptimista } from './escrituraOptimista';
import { create } from 'zustand';
import type { FinanzasMensual } from '@/types/finanzas';
import { FinanzasRepo } from '@/services/repositories';

interface FinanzasState {
  registros: FinanzasMensual[];
  hydrate: (registros: FinanzasMensual[]) => void;
  /**
   * Un registro por cliente+mes: si ya existe lo actualiza, si no lo crea.
   * Único punto de escritura — la UI no distingue "crear" de "editar", solo
   * guarda el mes que tiene abierto.
   */
  guardarMes: (clientId: string, periodo: string, patch: Partial<FinanzasMensual>) => void;
  byClient: (clientId: string) => FinanzasMensual[];
  deMes: (clientId: string, periodo: string) => FinanzasMensual | undefined;
}

export const useFinanzasStore = create<FinanzasState>((set, get) => ({
  registros: [],

  hydrate: (registros) => set({ registros }),

  guardarMes: (clientId, periodo, patch) => {
    const existente = get().registros.find((r) => r.clientId === clientId && r.periodo === periodo);
    if (existente) {
      const revertir = cambioOptimista(() => get().registros, (registros) => set({ registros }), existente.id, patch);
      void FinanzasRepo.update(existente.id, patch).catch(onWriteError('finanzas.update', 'No se pudieron guardar los cambios de este mes. Se deshicieron en pantalla.', revertir));
      return;
    }
    const nuevo: FinanzasMensual = {
      id: crypto.randomUUID(),
      clientId,
      periodo,
      gastosAds: 0,
      gastosOtros: 0,
      metaIngresos: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...patch,
    };
    const revertir = altaOptimista(() => get().registros, (registros) => set({ registros }), nuevo);
    void FinanzasRepo.create(nuevo).catch(onWriteError('finanzas.create', 'No se pudo guardar este mes. Se quitó de la lista: vuelve a intentarlo.', revertir));
  },

  byClient: (clientId) => get().registros.filter((r) => r.clientId === clientId),
  deMes: (clientId, periodo) => get().registros.find((r) => r.clientId === clientId && r.periodo === periodo),
}));
