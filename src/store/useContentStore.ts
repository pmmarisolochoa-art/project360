import { create } from 'zustand';
import type { ContentPiece, ContentStatus } from '@/types/content';
import { isoFromNow } from '@/utils/dateHelpers';

interface ContentState {
  pieces: ContentPiece[];
  add: (piece: ContentPiece) => void;
  update: (id: string, patch: Partial<ContentPiece>) => void;
  remove: (id: string) => void;
  byClient: (clientId: string) => ContentPiece[];
}

const seed: ContentPiece[] = [
  // FitMind — 8 piezas variadas
  {
    id: 'ct_1', clientId: 'c_fitmind', title: 'Reel: "Por qué te estancas en tu camino de bienestar"',
    platform: 'instagram', format: 'reel',
    copyText: 'Hook: Si llevas 3 meses estancada, no es falta de disciplina…',
    status: 'editing', approval: 'pending',
    recordingDate: isoFromNow(-3), editingDate: isoFromNow(0), approvalDate: isoFromNow(2), publishDate: isoFromNow(4),
    hasLeadMagnet: true, leadMagnetDescription: 'Guía: 5 señales de bloqueo emocional (PDF)',
    createdAt: isoFromNow(-5),
  },
  {
    id: 'ct_2', clientId: 'c_fitmind', title: 'Carrusel: 7 mitos de la nutrición consciente',
    platform: 'instagram', format: 'carousel',
    copyText: 'Slide 1: La nutrición consciente NO es contar calorías. Es…',
    status: 'approved', approval: 'approved',
    recordingDate: isoFromNow(-7), editingDate: isoFromNow(-5), approvalDate: isoFromNow(-2), publishDate: isoFromNow(1),
    hasLeadMagnet: false,
    createdAt: isoFromNow(-10),
  },
  {
    id: 'ct_3', clientId: 'c_fitmind', title: 'Reel: Ejercicio de regulación nerviosa en 60 segundos',
    platform: 'tiktok', format: 'short',
    copyText: 'Si tu sistema nervioso está al límite, prueba esto…',
    status: 'recording', approval: 'pending',
    recordingDate: isoFromNow(1), editingDate: isoFromNow(3), approvalDate: isoFromNow(5), publishDate: isoFromNow(7),
    hasLeadMagnet: true, leadMagnetDescription: 'Audio guía gratuita de respiración 4-7-8',
    createdAt: isoFromNow(-1),
  },
  {
    id: 'ct_4', clientId: 'c_fitmind', title: 'YouTube Long: Mi historia y por qué fundé FitMind',
    platform: 'youtube', format: 'video',
    copyText: 'Capítulos: Mi crisis, El descubrimiento, La transformación, Lo que aprendí.',
    status: 'not_started', approval: 'pending',
    recordingDate: isoFromNow(5), editingDate: isoFromNow(9), approvalDate: isoFromNow(12), publishDate: isoFromNow(15),
    hasLeadMagnet: false,
    createdAt: isoFromNow(0),
  },
  {
    id: 'ct_5', clientId: 'c_fitmind', title: 'Post: Testimonio Mariana — antes y después',
    platform: 'instagram', format: 'post',
    copyText: '"Pensé que estaba rota. Después de 3 meses con Laura…"',
    status: 'sent_to_client', approval: 'pending',
    recordingDate: isoFromNow(-4), editingDate: isoFromNow(-3), approvalDate: isoFromNow(0), publishDate: isoFromNow(2),
    hasLeadMagnet: false,
    createdAt: isoFromNow(-6),
  },
  {
    id: 'ct_6', clientId: 'c_fitmind', title: 'Reel: "Lo que tu psicóloga no te dice"',
    platform: 'instagram', format: 'reel',
    copyText: 'Hook polémico para captar atención.',
    status: 'rejected', approval: 'rejected', approvalNotes: 'Cambiar el hook — muy polarizante para nuestro tono. Sugerencia: empezar desde curiosidad, no confrontación.',
    recordingDate: isoFromNow(-5), editingDate: isoFromNow(-3), approvalDate: isoFromNow(-1), publishDate: isoFromNow(2),
    hasLeadMagnet: false,
    createdAt: isoFromNow(-7),
  },
  {
    id: 'ct_7', clientId: 'c_fitmind', title: 'Story serie: 3 días de check-in del sistema nervioso',
    platform: 'instagram', format: 'story',
    copyText: 'Día 1: ¿cómo te sentís al despertar? Día 2: tu cuerpo te habla. Día 3: integra.',
    status: 'published', approval: 'approved',
    recordingDate: isoFromNow(-14), editingDate: isoFromNow(-12), approvalDate: isoFromNow(-10), publishDate: isoFromNow(-9),
    hasLeadMagnet: true, leadMagnetDescription: 'Mini-curso de 7 días por email',
    createdAt: isoFromNow(-15),
  },
  {
    id: 'ct_8', clientId: 'c_fitmind', title: 'Reel: Cómo dejé de comer emocionalmente',
    platform: 'instagram', format: 'reel',
    copyText: 'Hook personal: "Lloraba con la nevera abierta…"',
    status: 'review', approval: 'pending',
    recordingDate: isoFromNow(-2), editingDate: isoFromNow(0), approvalDate: isoFromNow(2), publishDate: isoFromNow(5),
    hasLeadMagnet: true, leadMagnetDescription: 'Test: ¿Comes emocional? — diagnóstico de 8 preguntas',
    createdAt: isoFromNow(-3),
  },
  // Kuroko — 2
  {
    id: 'ct_k1', clientId: 'c_kuroko', title: 'Lookbook FW colección urbana',
    platform: 'instagram', format: 'carousel',
    copyText: 'La calle es nuestro lienzo. Drop 02.',
    status: 'editing', approval: 'pending',
    recordingDate: isoFromNow(-1), editingDate: isoFromNow(2), approvalDate: isoFromNow(4), publishDate: isoFromNow(6),
    hasLeadMagnet: false,
    createdAt: isoFromNow(-2),
  },
  {
    id: 'ct_k2', clientId: 'c_kuroko', title: 'TikTok: BTS sesión de fotos del drop',
    platform: 'tiktok', format: 'short',
    copyText: 'BTS — así nace una colección.',
    status: 'not_started', approval: 'pending',
    recordingDate: isoFromNow(3), editingDate: isoFromNow(5), approvalDate: isoFromNow(6), publishDate: isoFromNow(8),
    hasLeadMagnet: false,
    createdAt: isoFromNow(0),
  },
];

export const useContentStore = create<ContentState>((set, get) => ({
  pieces: seed,
  add: (piece) => set((s) => ({ pieces: [piece, ...s.pieces] })),
  update: (id, patch) => set((s) => ({ pieces: s.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  remove: (id) => set((s) => ({ pieces: s.pieces.filter((p) => p.id !== id) })),
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
