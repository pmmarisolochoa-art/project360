/**
 * Benchmarks hardcoded por industria. Fuente: agregado de reportes públicos
 * (WordStream, Databox, AdEspresso, HubSpot 2024). El estratega puede
 * sobrescribirlos en el módulo de Proyección si tiene data más actualizada.
 */

export interface IndustryBenchmark {
  ctrMeta: number;       // %
  ctrGoogle: number;     // %
  landingConv: number;   // %
  avgCpl: number;        // USD
  avgRoas: number;       // x
  closeRate: number;     // %
  avgLtv: number;        // USD
}

export const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  'Salud & Bienestar':       { ctrMeta: 1.6, ctrGoogle: 3.2, landingConv: 3.5, avgCpl: 8,  avgRoas: 2.8, closeRate: 12, avgLtv: 380 },
  'Belleza':                 { ctrMeta: 1.8, ctrGoogle: 4.0, landingConv: 4.0, avgCpl: 6,  avgRoas: 3.2, closeRate: 14, avgLtv: 260 },
  'Fitness':                 { ctrMeta: 1.5, ctrGoogle: 3.0, landingConv: 3.2, avgCpl: 9,  avgRoas: 2.6, closeRate: 11, avgLtv: 420 },
  'EdTech':                  { ctrMeta: 1.4, ctrGoogle: 3.8, landingConv: 3.0, avgCpl: 12, avgRoas: 2.4, closeRate: 9,  avgLtv: 650 },
  'Coaching':                { ctrMeta: 1.7, ctrGoogle: 3.5, landingConv: 3.5, avgCpl: 14, avgRoas: 3.0, closeRate: 8,  avgLtv: 1200 },
  'Moda & Streetwear':       { ctrMeta: 1.4, ctrGoogle: 2.8, landingConv: 2.8, avgCpl: 5,  avgRoas: 3.5, closeRate: 18, avgLtv: 180 },
  'Inmobiliario':            { ctrMeta: 0.9, ctrGoogle: 2.6, landingConv: 2.0, avgCpl: 25, avgRoas: 4.5, closeRate: 4,  avgLtv: 8500 },
  'Software / SaaS':         { ctrMeta: 1.2, ctrGoogle: 2.5, landingConv: 4.0, avgCpl: 28, avgRoas: 3.8, closeRate: 6,  avgLtv: 3200 },
  'Consultoría':             { ctrMeta: 1.0, ctrGoogle: 2.4, landingConv: 3.0, avgCpl: 30, avgRoas: 4.0, closeRate: 7,  avgLtv: 5500 },
  'Restaurantes':            { ctrMeta: 1.6, ctrGoogle: 3.0, landingConv: 3.5, avgCpl: 4,  avgRoas: 2.5, closeRate: 20, avgLtv: 95 },
  'Servicios profesionales': { ctrMeta: 1.3, ctrGoogle: 3.0, landingConv: 3.2, avgCpl: 18, avgRoas: 3.4, closeRate: 9,  avgLtv: 1800 },
};

export const DEFAULT_BENCHMARK: IndustryBenchmark = {
  ctrMeta: 1.4, ctrGoogle: 3.0, landingConv: 3.0, avgCpl: 12, avgRoas: 3.0, closeRate: 10, avgLtv: 500,
};

export function getBenchmark(industry: string): IndustryBenchmark {
  return INDUSTRY_BENCHMARKS[industry] ?? DEFAULT_BENCHMARK;
}
