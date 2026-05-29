import type { FunnelProjection } from '@/types/metrics';

export function projectFunnel(input: {
  reach: number;
  ctr: number; // 0..1
  leadConversion: number; // ctr clic → lead
  sqlRate: number; // lead → sql
  closeRate: number; // sql → venta
  averageTicket: number;
}): FunnelProjection {
  const clicks = input.reach * input.ctr;
  const leads = clicks * input.leadConversion;
  const sqls = leads * input.sqlRate;
  const sales = sqls * input.closeRate;
  const revenue = sales * input.averageTicket;
  return {
    reach: Math.round(input.reach),
    ctr: input.ctr,
    leads: Math.round(leads),
    sqls: Math.round(sqls),
    sales: Math.round(sales),
    averageTicket: input.averageTicket,
    revenue: Math.round(revenue),
  };
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function healthFromMetrics(roas: number | null, progress: number, overdueTasks: number) {
  if (overdueTasks > 4 || (roas !== null && roas < 1.5)) return 'red' as const;
  if (overdueTasks > 1 || progress < 30 || (roas !== null && roas < 2.5)) return 'yellow' as const;
  return 'green' as const;
}
