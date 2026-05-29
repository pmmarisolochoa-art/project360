import { create } from 'zustand';
import type { RopreItem } from '@/types/ropre';
import { isoFromNow } from '@/utils/dateHelpers';
import { RopreRepo } from '@/services/repositories';

interface RopreState {
  items: RopreItem[];
  add: (item: RopreItem) => void;
  update: (id: string, patch: Partial<RopreItem>) => void;
  remove: (id: string) => void;
  byClient: (clientId: string) => RopreItem[];
}

const seed: RopreItem[] = [
  // FitMind
  {
    id: 'r_1', clientId: 'c_fitmind', type: 'result',
    title: 'Llegar a $25.000 USD/mes facturados',
    description: 'OKR principal del trimestre — sostenido 3 meses consecutivos',
    targetValue: '$25.000', currentValue: '$12.400',
    createdAt: isoFromNow(-14),
  },
  {
    id: 'r_2', clientId: 'c_fitmind', type: 'objective',
    title: 'Reducir CPL a $4 USD', targetValue: '$4', currentValue: '$6.20',
    createdAt: isoFromNow(-12),
  },
  {
    id: 'r_3', clientId: 'c_fitmind', type: 'objective',
    title: 'Crecer +30k seguidores en Instagram', targetValue: '30.000', currentValue: '8.400',
    createdAt: isoFromNow(-10),
  },
  {
    id: 'r_4', clientId: 'c_fitmind', type: 'premise',
    title: 'El nicho de regulación nerviosa está en alza en LATAM',
    description: 'Tendencia de búsquedas creciente +120% YoY según Google Trends',
    createdAt: isoFromNow(-14),
  },
  {
    id: 'r_5', clientId: 'c_fitmind', type: 'risk', riskLevel: 'high',
    title: 'Saturación del feed orgánico tras 6 meses publicando',
    mitigation: 'Rotar formatos cada 4 semanas y testear hooks nuevos en Reels.',
    createdAt: isoFromNow(-9),
  },
  {
    id: 'r_6', clientId: 'c_fitmind', type: 'risk', riskLevel: 'medium',
    title: 'Dependencia de un solo canal (Meta) para adquisición',
    mitigation: 'Pilotear TikTok Ads en Q2 con 15% del presupuesto.',
    createdAt: isoFromNow(-8),
  },
  {
    id: 'r_7', clientId: 'c_fitmind', type: 'deliverable', status: 'done',
    title: 'Pixel + Conversions API configurados',
    responsible: 'Diego Ramírez',
    startDate: isoFromNow(-14), dueDate: isoFromNow(-10),
    createdAt: isoFromNow(-14),
  },
  {
    id: 'r_8', clientId: 'c_fitmind', type: 'deliverable', status: 'in_progress',
    title: 'Funnel principal v2 con webinar evergreen',
    responsible: 'Marisol Ochoa',
    startDate: isoFromNow(-7), dueDate: isoFromNow(7),
    createdAt: isoFromNow(-7),
  },
  {
    id: 'r_9', clientId: 'c_fitmind', type: 'deliverable', status: 'todo',
    title: '12 Reels editados del nuevo ángulo "regulación nerviosa"',
    responsible: 'Laura Mejía',
    startDate: isoFromNow(2), dueDate: isoFromNow(20),
    createdAt: isoFromNow(-2),
  },
  {
    id: 'r_10', clientId: 'c_fitmind', type: 'deliverable', status: 'review',
    title: 'Página de venta del programa premium',
    responsible: 'Marisol Ochoa',
    startDate: isoFromNow(-5), dueDate: isoFromNow(3),
    createdAt: isoFromNow(-5),
  },

  // Kuroko (mínimo viable)
  {
    id: 'r_k1', clientId: 'c_kuroko', type: 'result',
    title: 'Validar canal Meta Ads con ROAS ≥ 2.5x en 60 días',
    targetValue: '2.5x', currentValue: '—',
    createdAt: isoFromNow(-7),
  },
  {
    id: 'r_k2', clientId: 'c_kuroko', type: 'risk', riskLevel: 'high',
    title: 'Sin acceso a Business Manager — bloquea ejecución',
    mitigation: 'Escalar con founder esta semana y ofrecer alternativa de cuenta nueva.',
    createdAt: isoFromNow(-5),
  },
  {
    id: 'r_k3', clientId: 'c_kuroko', type: 'deliverable', status: 'in_progress',
    title: 'Auditoría completa de catálogo de productos',
    responsible: 'Camila Mora',
    startDate: isoFromNow(-3), dueDate: isoFromNow(4),
    createdAt: isoFromNow(-3),
  },
];

export const useRopreStore = create<RopreState>((set, get) => ({
  items: seed,
  add: (item) => {
    set((s) => ({ items: [item, ...s.items] }));
    void RopreRepo.create(item).catch((e) => console.warn('[ropre.create]', e));
  },
  update: (id, patch) => {
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    void RopreRepo.update(id, patch).catch((e) => console.warn('[ropre.update]', e));
  },
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  byClient: (clientId) => get().items.filter((i) => i.clientId === clientId),
}));
