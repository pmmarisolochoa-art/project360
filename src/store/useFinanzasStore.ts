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

/**
 * Cola de red por cliente+mes: el formulario guarda campo por campo al
 * perder foco (inversión, otros gastos, meta, notas pueden llegar en
 * ráfaga). El PRIMER guardado de un mes nuevo hace un INSERT; si los
 * siguientes mandan su UPDATE sin esperar, pueden llegarle a Supabase antes
 * de que ese INSERT haya terminado — la fila todavía no existe, el UPDATE
 * no toca 0 filas sin dar error, y el dato se pierde en silencio (visto en
 * vivo, 23-nov-2026: "Meta de ingresos" y "Notas" volvían vacíos al
 * recargar aunque "Inversión en ads" sí quedaba guardado). Encadenar las
 * llamadas de red por clave asegura que cada una espere a que la anterior
 * haya terminado en el servidor antes de salir.
 */
const colaPorMes = new Map<string, Promise<unknown>>();

function encolar(clientId: string, periodo: string, tarea: () => Promise<unknown>): Promise<unknown> {
  const key = `${clientId}:${periodo}`;
  const anterior = colaPorMes.get(key) ?? Promise.resolve();
  const siguiente = anterior.then(tarea, tarea);
  colaPorMes.set(key, siguiente);
  return siguiente;
}

export const useFinanzasStore = create<FinanzasState>((set, get) => ({
  registros: [],

  hydrate: (registros) => set({ registros }),

  guardarMes: (clientId, periodo, patch) => {
    const existente = get().registros.find((r) => r.clientId === clientId && r.periodo === periodo);
    if (existente) {
      const revertir = cambioOptimista(() => get().registros, (registros) => set({ registros }), existente.id, patch);
      void encolar(clientId, periodo, () => FinanzasRepo.update(existente.id, patch))
        .catch(onWriteError('finanzas.update', 'No se pudieron guardar los cambios de este mes. Se deshicieron en pantalla.', revertir));
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
    void encolar(clientId, periodo, () => FinanzasRepo.create(nuevo))
      .catch(onWriteError('finanzas.create', 'No se pudo guardar este mes. Se quitó de la lista: vuelve a intentarlo.', revertir));
  },

  byClient: (clientId) => get().registros.filter((r) => r.clientId === clientId),
  deMes: (clientId, periodo) => get().registros.find((r) => r.clientId === clientId && r.periodo === periodo),
}));
