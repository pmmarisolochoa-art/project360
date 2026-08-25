import { onWriteError } from './onWriteError';
import { altaOptimista, cambioOptimista, bajaOptimista } from './escrituraOptimista';
import { create } from 'zustand';
import type { ContentPiece, ContentStatus } from '@/types/content';
import { ContentRepo } from '@/services/repositories';

interface ContentState {
  pieces: ContentPiece[];
  add: (piece: ContentPiece) => void;
  update: (id: string, patch: Partial<ContentPiece>) => void;
  remove: (id: string) => void;
  byClient: (clientId: string) => ContentPiece[];
}


export const useContentStore = create<ContentState>((set, get) => ({
  pieces: [],
  add: (piece) => {
    const revertir = altaOptimista(() => get().pieces, (pieces) => set({ pieces }), piece);
    void ContentRepo.create(piece).catch(onWriteError('content.create', 'No se pudo guardar la pieza. Se quitó de la lista: vuelve a intentarlo.', revertir));
  },
  update: (id, patch) => {
    const revertir = cambioOptimista(() => get().pieces, (pieces) => set({ pieces }), id, patch);
    void ContentRepo.update(id, patch).catch(onWriteError('content.update', 'No se pudieron guardar los cambios de la pieza. Se deshicieron en pantalla.', revertir));
  },
  remove: (id) => {
    const revertir = bajaOptimista(() => get().pieces, (pieces) => set({ pieces }), id);
    void ContentRepo.remove(id).catch(onWriteError('content.remove', 'No se pudo eliminar la pieza. Vuelve a aparecer porque sigue ahí.', revertir));
  },
  byClient: (clientId) => get().pieces.filter((p) => p.clientId === clientId),
}));

export type DateField = 'recordingDate' | 'editingDate' | 'approvalDate' | 'publishDate';

export const DATE_FIELD_LABEL: Record<DateField, { icon: string; label: string }> = {
  recordingDate: { icon: '📹', label: 'Grabación' },
  editingDate:   { icon: '✂️', label: 'Edición' },
  approvalDate:  { icon: '✅', label: 'Aprobación' },
  publishDate:   { icon: '📅', label: 'Publicación' },
};

export const STATUS_FLOW: ContentStatus[] = [
  'not_started', 'recording', 'editing', 'review', 'sent_to_client', 'approved', 'scheduled', 'published',
];
