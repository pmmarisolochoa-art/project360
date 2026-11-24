import { onWriteError } from './onWriteError';
import { altaOptimista, bajaOptimista } from './escrituraOptimista';
import { create } from 'zustand';
import type { ContentMetricSnapshot } from '@/types/content';
import { ContentMetricsRepo } from '@/services/repositories';

interface ContentMetricsState {
  snapshots: ContentMetricSnapshot[];
  /** Agrega lecturas ya cargadas de Supabase — solo sincroniza el estado local. */
  addMany: (snapshots: ContentMetricSnapshot[]) => void;
  add: (snapshot: ContentMetricSnapshot) => void;
  remove: (id: string) => void;
  byPiece: (contentPieceId: string) => ContentMetricSnapshot[];
  /** Última lectura por frame de una pieza (frame 0 = post/reel/carrusel/video). */
  latestByFrame: (contentPieceId: string) => Record<number, ContentMetricSnapshot>;
}

export const useContentMetricsStore = create<ContentMetricsState>((set, get) => ({
  snapshots: [],
  addMany: (nuevas) => {
    if (nuevas.length === 0) return;
    set((s) => {
      const existentes = new Set(s.snapshots.map((m) => m.id));
      const faltantes = nuevas.filter((m) => !existentes.has(m.id));
      return faltantes.length === 0 ? s : { snapshots: [...s.snapshots, ...faltantes] };
    });
  },
  add: (snapshot) => {
    const revertir = altaOptimista(() => get().snapshots, (snapshots) => set({ snapshots }), snapshot);
    void ContentMetricsRepo.create(snapshot).catch(
      onWriteError('contentMetrics.create', 'No se pudo guardar la lectura de métricas. Se quitó de la lista: vuelve a intentarlo.', revertir),
    );
  },
  remove: (id) => {
    const revertir = bajaOptimista(() => get().snapshots, (snapshots) => set({ snapshots }), id);
    void ContentMetricsRepo.remove(id).catch(
      onWriteError('contentMetrics.remove', 'No se pudo eliminar la lectura. Vuelve a aparecer porque sigue ahí.', revertir),
    );
  },
  byPiece: (contentPieceId) =>
    get().snapshots
      .filter((m) => m.contentPieceId === contentPieceId)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
  latestByFrame: (contentPieceId) => {
    const out: Record<number, ContentMetricSnapshot> = {};
    for (const m of get().byPiece(contentPieceId)) {
      out[m.frameIndex] = m; // la última sobreescribe — la lista ya viene ordenada ascendente
    }
    return out;
  },
}));
