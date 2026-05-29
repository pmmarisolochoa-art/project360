import { create } from 'zustand';
import type { FunnelDoc, FunnelKind, FunnelNode, FunnelEdge } from '@/types/funnel';

interface FunnelState {
  funnels: FunnelDoc[];
  add: (f: FunnelDoc) => void;
  update: (id: string, patch: Partial<FunnelDoc>) => void;
  remove: (id: string) => void;
  byClient: (clientId: string) => FunnelDoc[];
}

export const useFunnelStore = create<FunnelState>((set, get) => ({
  funnels: [],
  add: (f) => set((s) => ({ funnels: [...s.funnels, f] })),
  update: (id, patch) => set((s) => ({ funnels: s.funnels.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
  remove: (id) => set((s) => ({ funnels: s.funnels.filter((f) => f.id !== id) })),
  byClient: (clientId) => get().funnels.filter((f) => f.clientId === clientId),
}));

/** Plantillas pre-armadas por tipo de embudo. */
export function templateForKind(kind: FunnelKind, clientId: string): FunnelDoc {
  const id = `fn_${Math.random().toString(36).slice(2, 7)}`;
  const nid = (n: string) => `n_${n}_${Math.random().toString(36).slice(2, 5)}`;

  if (kind === 'capture') {
    const sources = ['Meta Ads', 'Google Ads', 'YouTube Ads', 'Email lista', 'Orgánico IG'];
    const sourceNodes: FunnelNode[] = sources.map((s) => ({ id: nid('src'), type: 'source', label: s }));
    const lp = { id: nid('lp'), type: 'page' as const, label: 'Página de Opt-in', expectedConvRate: 0.30, tool: 'Leadpages' };
    const lead = { id: nid('lead'), type: 'lead' as const, label: 'Lead capturado', expectedConvRate: 0.04 };
    const thanks = { id: nid('thx'), type: 'page' as const, label: 'Página gracias + CTA' };
    const e1 = { id: nid('e1'), type: 'email' as const, label: 'Email #1 Bienvenida + WhatsApp' };
    const e1b = { id: nid('e1b'), type: 'email' as const, label: 'Email #1 bis (no abrió)' };
    const split = { id: nid('split'), type: 'split' as const, label: 'Abre / No abre' };
    const e2 = { id: nid('e2'), type: 'email' as const, label: 'Email #2 Educativo' };
    const e3 = { id: nid('e3'), type: 'email' as const, label: 'Email #3 Caso de éxito' };
    const e4 = { id: nid('e4'), type: 'email' as const, label: 'Email #4 CTA producto' };
    const sale = { id: nid('sale'), type: 'sale' as const, label: 'Venta' };
    const nodes = [...sourceNodes, lp, lead, thanks, e1, split, e1b, e2, e3, e4, sale];
    const edges: FunnelEdge[] = [
      ...sourceNodes.map((s) => ({ from: s.id, to: lp.id })),
      { from: lp.id, to: lead.id },
      { from: lead.id, to: thanks.id, label: 'Confirmación' },
      { from: lead.id, to: e1.id, label: 'Email' },
      { from: e1.id, to: split.id },
      { from: split.id, to: e1b.id, label: 'No abrió' },
      { from: split.id, to: e2.id, label: 'Abrió' },
      { from: e2.id, to: e3.id },
      { from: e3.id, to: e4.id },
      { from: e4.id, to: sale.id },
    ];
    return { id, clientId, kind, name: 'Captación · Lead → Email → Venta', nodes, edges, createdAt: new Date().toISOString() };
  }

  if (kind === 'launch_event') {
    const nodes: FunnelNode[] = [
      { id: nid('ads'), type: 'source', label: 'Ads CPL 1 — Lista de espera' },
      { id: nid('lp1'), type: 'page', label: 'Landing Lista de espera', expectedConvRate: 0.40 },
      { id: nid('lead'), type: 'lead', label: 'Lead pre-lanzamiento' },
      { id: nid('cpl2'), type: 'email', label: 'CPL 2 — Webinar / Evento' },
      { id: nid('cpl3'), type: 'email', label: 'CPL 3 — Carrito abierto' },
      { id: nid('cart'), type: 'page', label: 'Página de carrito', expectedConvRate: 0.07 },
      { id: nid('sale'), type: 'sale', label: 'Venta' },
    ];
    const edges: FunnelEdge[] = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
    return { id, clientId, kind, name: 'Lanzamiento con Evento', nodes, edges, createdAt: new Date().toISOString() };
  }

  if (kind === 'evergreen') {
    const nodes: FunnelNode[] = [
      { id: nid('ads'), type: 'source', label: 'Meta Ads + Google Ads' },
      { id: nid('lp'),  type: 'page',   label: 'Landing Quiz / Lead Magnet', expectedConvRate: 0.35 },
      { id: nid('seq'), type: 'email',  label: 'Secuencia 7 emails 24/7' },
      { id: nid('vsl'), type: 'page',   label: 'VSL / Página de venta',      expectedConvRate: 0.05 },
      { id: nid('sale'), type: 'sale',  label: 'Venta evergreen' },
    ];
    const edges: FunnelEdge[] = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
    return { id, clientId, kind, name: 'Sistema Evergreen', nodes, edges, createdAt: new Date().toISOString() };
  }

  if (kind === 'ecommerce') {
    const nodes: FunnelNode[] = [
      { id: nid('ads'),  type: 'source', label: 'Meta Ads (DPA) + TikTok' },
      { id: nid('pdp'),  type: 'page',   label: 'Producto / PDP', expectedConvRate: 0.10 },
      { id: nid('cart'), type: 'page',   label: 'Carrito' },
      { id: nid('chk'),  type: 'page',   label: 'Checkout' },
      { id: nid('sale'), type: 'sale',   label: 'Venta' },
      { id: nid('abnd'), type: 'email',  label: 'Recuperación abandono' },
    ];
    const edges: FunnelEdge[] = [
      { from: nodes[0].id, to: nodes[1].id },
      { from: nodes[1].id, to: nodes[2].id },
      { from: nodes[2].id, to: nodes[3].id },
      { from: nodes[3].id, to: nodes[4].id },
      { from: nodes[2].id, to: nodes[5].id, label: 'Abandono' },
      { from: nodes[5].id, to: nodes[4].id, label: 'Vuelve' },
    ];
    return { id, clientId, kind, name: 'Ecommerce directo', nodes, edges, createdAt: new Date().toISOString() };
  }

  if (kind === 'warmup') {
    const nodes: FunnelNode[] = [
      { id: nid('aud'), type: 'source', label: 'Audiencia ya conocida' },
      { id: nid('ret'), type: 'page',   label: 'Retargeting con contenido educativo' },
      { id: nid('cta'), type: 'cta',    label: 'CTA Diagnóstico gratuito' },
      { id: nid('sale'),type: 'sale',   label: 'Venta consultiva' },
    ];
    const edges: FunnelEdge[] = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
    return { id, clientId, kind, name: 'Calentamiento audiencia', nodes, edges, createdAt: new Date().toISOString() };
  }

  // personal_brand
  const nodes: FunnelNode[] = [
    { id: nid('content'), type: 'source', label: 'Contenido orgánico (Reels, posts)' },
    { id: nid('grow'),    type: 'page',   label: 'Crecimiento de audiencia' },
    { id: nid('lm'),      type: 'cta',    label: 'Lead magnet en bio' },
    { id: nid('email'),   type: 'email',  label: 'Lista + nurturing' },
    { id: nid('offer'),   type: 'sale',   label: 'Oferta de alto valor' },
  ];
  const edges: FunnelEdge[] = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
  return { id, clientId, kind, name: 'Marca personal · Audiencia → Oferta', nodes, edges, createdAt: new Date().toISOString() };
}
