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
    set((s) => ({ pieces: [piece, ...s.pieces] }));
    void ContentRepo.create(piece).catch((e) => console.warn('[content.create]', e));
  },
  update: (id, patch) => {
    set((s) => ({ pieces: s.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    void ContentRepo.update(id, patch).catch((e) => console.warn('[content.update]', e));
  },
  remove: (id) => {
    set((s) => ({ pieces: s.pieces.filter((p) => p.id !== id) }));
    void ContentRepo.remove(id).catch((e) => console.warn('[content.remove]', e));
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
