import { create } from 'zustand';
import type {
  ProjectionState, FunnelInputs, OKR, InvestmentLine, MarketSizing,
  DebriefingSections, ProjectPhase, ScenarioId,
} from '@/types/projection';
import type { ProjectType } from '@/types/client';
import { ProjectionsRepo } from '@/services/repositories';

/**
 * Auto-save debounced por clientId — evita golpear Supabase en cada keystroke.
 * Acumula cambios y dispara save 500ms después del último cambio.
 */
const SAVE_DEBOUNCE_MS = 500;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(clientId: string, getState: () => Store) {
  const existing = saveTimers.get(clientId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    saveTimers.delete(clientId);
    const state = getState().states[clientId];
    if (!state) return;
    void ProjectionsRepo.save(state).catch((e) => console.warn('[projections.save]', clientId, e));
  }, SAVE_DEBOUNCE_MS);
  saveTimers.set(clientId, t);
}

interface Store {
  states: Record<string, ProjectionState>;
  ensure: (clientId: string, defaults: Partial<ProjectionState> & { projectType?: ProjectType }) => void;
  patchFunnel: (clientId: string, patch: Partial<FunnelInputs>) => void;
  patchMarket: (clientId: string, patch: Partial<MarketSizing>) => void;
  patchDebriefing: (clientId: string, patch: DebriefingSections) => void;
  setOkrs: (clientId: string, okrs: OKR[]) => void;
  setInvestment: (clientId: string, lines: InvestmentLine[]) => void;
  setBenchmarkOverride: (clientId: string, key: string, value: number | undefined) => void;
  setDuration: (clientId: string, months: number) => void;
  setSuccessIndicators: (clientId: string, indicators: string[]) => void;
  setPhases: (clientId: string, phases: ProjectPhase[]) => void;
  setActiveScenario: (clientId: string, scenario: ScenarioId) => void;
}

function tid() { return `gt_${Math.random().toString(36).slice(2, 8)}`; }
function sid() { return `gs_${Math.random().toString(36).slice(2, 8)}`; }

function mkTask(name: string, startWeek: number, endWeek: number, subs: string[]): import('@/types/projection').GanttTask {
  return {
    id: tid(),
    name,
    startWeek,
    endWeek,
    status: 'not_started',
    subtasks: subs.map((s) => ({ id: sid(), name: s, done: false })),
  };
}

function defaultPhases(projectType: ProjectType): ProjectPhase[] {
  const base: ProjectPhase[] = [
    {
      id: 'p0', name: 'Onboarding & Setup', startWeek: 1, endWeek: 2, status: 'in_progress', progress: 0,
      tasks: [
        mkTask('Acceso a cuentas de ADS', 1, 1, [
          'Solicitar acceso a Meta Business Manager',
          'Solicitar acceso a Google Ads',
          'Verificar acceso a Analytics/GA4',
        ]),
        mkTask('Instalación de píxeles y tracking', 1, 2, [
          'Instalar Meta Pixel en sitio web',
          'Configurar eventos estándar del píxel',
          'Instalar Google Tag Manager',
          'Verificar disparo de eventos de conversión',
        ]),
        mkTask('Auditoría de activos existentes', 1, 2, [
          'Auditoría de cuenta Meta Ads (historial, audiencias, píxel)',
          'Auditoría de cuenta Google Ads',
          'Revisión de landing pages actuales',
          'Análisis de métricas históricas',
        ]),
        mkTask('Definición de audiencias', 2, 2, [
          'Construir audiencias de retargeting (visitantes web)',
          'Crear audiencias similares (lookalike)',
          'Definir audiencias frías de interés',
        ]),
      ],
    },
    {
      id: 'p1', name: 'Producción de activos', startWeek: 2, endWeek: 4, status: 'in_progress', progress: 0,
      tasks: [
        mkTask('Creación de creatividades para ADS', 2, 3, [
          'Briefing de creatividades al diseñador',
          'Diseño de 3 variantes de imagen estática',
          'Producción de 2 videos/reels para ADS',
          'Revisión y aprobación de creatividades',
        ]),
        mkTask('Desarrollo de landing pages', 2, 4, [
          'Wireframe y copy de la landing principal',
          'Diseño visual de la landing',
          'Desarrollo/construcción en la herramienta elegida',
          'Pruebas de velocidad y mobile',
          'Revisión y aprobación del cliente',
        ]),
        mkTask('Configuración de automatizaciones', 3, 4, [
          'Configurar secuencia de bienvenida (email)',
          'Configurar flujo de nurturing',
          'Conectar formulario con CRM/email',
        ]),
        mkTask('Copy de anuncios', 2, 3, [
          'Redactar 5 variantes de headline',
          'Redactar 3 variantes de body copy',
          'Definir CTAs por etapa del funnel',
        ]),
      ],
    },
    {
      id: 'p2', name: 'Lanzamiento & Aprendizaje', startWeek: 5, endWeek: 8, status: 'not_started', progress: 0,
      tasks: [
        mkTask('Configuración y lanzamiento de campañas', 5, 5, [
          'Crear estructura de campañas (awareness/consideración/conversión)',
          'Configurar conjuntos de anuncios con audiencias definidas',
          'Cargar creatividades y copys aprobados',
          'Configurar presupuestos y puja',
        ]),
        mkTask('Testing A/B inicial', 5, 7, [
          'Lanzar test A/B de 2 creatividades',
          'Lanzar test A/B de 2 audiencias',
          'Documentar hipótesis y criterios de ganador',
        ]),
        mkTask('Optimización de landing', 6, 8, [
          'Revisar heatmaps y grabaciones (Hotjar/MS Clarity)',
          'Ajustar CTA y form según comportamiento',
        ]),
        mkTask('Revisión semanal semana 2', 7, 7, [
          'Preparar reporte de primeros 7 días',
          'Reunión de ajuste de estrategia',
        ]),
      ],
    },
    {
      id: 'p3', name: 'Optimización', startWeek: 9, endWeek: 16, status: 'not_started', progress: 0,
      tasks: [
        mkTask('Análisis de resultados semana 3-8', 9, 10, []),
        mkTask('Escalar campañas ganadoras', 10, 14, []),
        mkTask('Pausar creatividades con bajo rendimiento', 10, 12, []),
        mkTask('Expandir audiencias ganadoras con lookalikes', 11, 14, []),
        mkTask('Segunda ronda de creatividades (aprendizaje aplicado)', 13, 16, []),
      ],
    },
    {
      id: 'p4', name: 'Escala', startWeek: 17, endWeek: 24, status: 'not_started', progress: 0,
      tasks: [
        mkTask('Incremento de presupuesto (regla del 20% semanal)', 17, 24, []),
        mkTask('Apertura de nueva plataforma (si aplica)', 18, 22, []),
        mkTask('Automatización de reportes', 17, 19, []),
        mkTask('Revisión de oferta y propuesta de valor', 20, 22, []),
      ],
    },
    {
      id: 'p5', name: 'Consolidación', startWeek: 25, endWeek: 52, status: 'not_started', progress: 0,
      tasks: [
        mkTask('Documentar sistema ganador', 25, 28, []),
        mkTask('Crear playbook de la cuenta', 27, 32, []),
        mkTask('Identificar oportunidades de expansión', 30, 40, []),
        mkTask('Revisión de contrato y continuidad', 48, 52, []),
      ],
    },
  ];
  if (projectType === 'launch') {
    base.push(
      { id: 'pl1', name: 'Pre-lanzamiento (captación de lista)', startWeek: 1,  endWeek: 6,  status: 'not_started', progress: 0, tasks: [mkTask('Lead magnet', 1, 3, []), mkTask('Lista de espera', 2, 5, []), mkTask('Pre-warming', 4, 6, [])] },
      { id: 'pl2', name: 'Apertura de carrito',                  startWeek: 7,  endWeek: 7,  status: 'not_started', progress: 0, tasks: [mkTask('Email lanzamiento', 7, 7, []), mkTask('Anuncios apertura', 7, 7, [])] },
      { id: 'pl3', name: 'Carrito abierto',                      startWeek: 7,  endWeek: 9,  status: 'not_started', progress: 0, tasks: [mkTask('Webinar', 7, 8, []), mkTask('FB lives', 8, 9, []), mkTask('Anuncios urgencia', 8, 9, [])] },
      { id: 'pl4', name: 'Cierre',                               startWeek: 9,  endWeek: 9,  status: 'not_started', progress: 0, tasks: [mkTask('Email cierre', 9, 9, []), mkTask('Last call', 9, 9, []), mkTask('Anuncios escasez', 9, 9, [])] },
      { id: 'pl5', name: 'Post-lanzamiento',                     startWeek: 10, endWeek: 12, status: 'not_started', progress: 0, tasks: [mkTask('Onboarding nuevos clientes', 10, 12, []), mkTask('NPS', 11, 12, []), mkTask('Debriefing', 12, 12, [])] },
    );
  }
  return base;
}

function defaultFunnel(monthlyAdsBudget: number, averageTicket: number): FunnelInputs {
  return {
    monthlyAdsBudget: monthlyAdsBudget || 1500,
    estimatedReach: 120_000,
    ctr: 0.018,
    landingConversionRate: 0.030,
    sqlRate: 0.45,
    closeRate: 0.18,
    averageTicket: averageTicket || 250,
  };
}

function defaultInvestment(adsBudget: number): InvestmentLine[] {
  return [
    { id: 'i_meta', category: 'Inversión en Meta Ads', monthly: Math.round(adsBudget * 0.60) },
    { id: 'i_google', category: 'Inversión en Google Ads', monthly: Math.round(adsBudget * 0.25) },
    { id: 'i_tiktok', category: 'Inversión en TikTok Ads', monthly: Math.round(adsBudget * 0.15) },
    { id: 'i_content', category: 'Producción de contenido', monthly: 600 },
    { id: 'i_dev', category: 'Desarrollo (landing/funnel)', monthly: 1200, onlyMonths: [1, 2] },
    { id: 'i_tools', category: 'Herramientas y software', monthly: 180 },
    { id: 'i_fee', category: 'Fee de agencia', monthly: 1800 },
  ];
}

export const useProjectionStore = create<Store>((set, get) => ({
  states: {},
  ensure: (clientId, defaults) =>
    set((s) => {
      if (s.states[clientId]) return s;
      const projectType = defaults.projectType ?? 'evergreen';
      const adsBudget = defaults.funnel?.monthlyAdsBudget ?? 1500;
      const fresh: ProjectionState = {
        clientId,
        funnel: defaultFunnel(adsBudget, defaults.funnel?.averageTicket ?? 0),
        activeScenario: 'realistic',
        phases: defaultPhases(projectType),
        okrs: [
          {
            id: 'okr_1',
            objective: defaults.debriefing?.executiveSummary?.text
              ? 'Llegar a la meta de facturación trimestral del cliente con un sistema escalable.'
              : 'Construir un sistema de adquisición escalable y rentable.',
            deadline: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
            responsible: 'Estratega Digital',
            keyResults: [
              { id: 'kr_1', description: 'ROAS sostenido por encima del benchmark', initialValue: 1.8, targetValue: 3, currentValue: 2.4, unit: 'ROAS' },
              { id: 'kr_2', description: 'Leads calificados por mes', initialValue: 40, targetValue: 180, currentValue: 90, unit: 'count' },
              { id: 'kr_3', description: 'CPL por debajo del benchmark del sector', initialValue: 18, targetValue: 9, currentValue: 12, unit: 'USD' },
            ],
          },
        ],
        successIndicators: [
          'Sistema de adquisición funcionando con ROAS positivo sostenido 3 meses.',
          'El cliente puede prever cuántos leads y ventas tendrá cada mes.',
          'Equipo opera con autonomía y reporting predecible.',
        ],
        benchmarksOverride: {},
        market: { tam: 5_000_000, sam: 800_000, somPercent: 1.5 },
        investment: defaultInvestment(adsBudget),
        durationMonths: 12,
        debriefing: defaults.debriefing ?? {},
      };
      // Persist el state inicial (sin debounce, ya que es solo al primer load)
      void ProjectionsRepo.save(fresh).catch((e) => console.warn('[projections.save:initial]', e));
      return { states: { ...s.states, [clientId]: fresh } };
    }),
  patchFunnel: (clientId, patch) => {
    set((s) => ({
      states: { ...s.states, [clientId]: { ...s.states[clientId], funnel: { ...s.states[clientId].funnel, ...patch } } },
    }));
    scheduleSave(clientId, get);
  },
  patchMarket: (clientId, patch) => {
    set((s) => ({
      states: { ...s.states, [clientId]: { ...s.states[clientId], market: { ...s.states[clientId].market, ...patch } } },
    }));
    scheduleSave(clientId, get);
  },
  patchDebriefing: (clientId, patch) => {
    set((s) => ({
      states: { ...s.states, [clientId]: { ...s.states[clientId], debriefing: { ...s.states[clientId].debriefing, ...patch } } },
    }));
    scheduleSave(clientId, get);
  },
  setOkrs: (clientId, okrs) => {
    set((s) => ({ states: { ...s.states, [clientId]: { ...s.states[clientId], okrs } } }));
    scheduleSave(clientId, get);
  },
  setInvestment: (clientId, lines) => {
    set((s) => ({ states: { ...s.states, [clientId]: { ...s.states[clientId], investment: lines } } }));
    scheduleSave(clientId, get);
  },
  setBenchmarkOverride: (clientId, key, value) => {
    set((s) => {
      const next = { ...s.states[clientId].benchmarksOverride };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return { states: { ...s.states, [clientId]: { ...s.states[clientId], benchmarksOverride: next } } };
    });
    scheduleSave(clientId, get);
  },
  setDuration: (clientId, months) => {
    set((s) => ({ states: { ...s.states, [clientId]: { ...s.states[clientId], durationMonths: months } } }));
    scheduleSave(clientId, get);
  },
  setSuccessIndicators: (clientId, indicators) => {
    set((s) => ({ states: { ...s.states, [clientId]: { ...s.states[clientId], successIndicators: indicators } } }));
    scheduleSave(clientId, get);
  },
  setPhases: (clientId, phases) => {
    set((s) => ({ states: { ...s.states, [clientId]: { ...s.states[clientId], phases } } }));
    scheduleSave(clientId, get);
  },
  setActiveScenario: (clientId, scenario) => {
    set((s) => ({ states: { ...s.states, [clientId]: { ...s.states[clientId], activeScenario: scenario } } }));
    scheduleSave(clientId, get);
  },
}));

export const SCENARIO_META: Record<ScenarioId, { label: string; factor: number; tone: string }> = {
  conservative: { label: 'Conservador', factor: 0.7, tone: '#A0A0B4' },
  realistic:    { label: 'Realista',    factor: 1.0, tone: '#8B5CF6' },
  optimistic:   { label: 'Optimista',   factor: 1.3, tone: '#10B981' },
};

export function calculateFunnel(inputs: FunnelInputs): import('@/types/projection').FunnelOutputs {
  const clicks = inputs.estimatedReach * inputs.ctr;
  const leads = clicks * inputs.landingConversionRate;
  const sqls = leads * inputs.sqlRate;
  const sales = sqls * inputs.closeRate;
  const revenue = sales * inputs.averageTicket;
  const roas = inputs.monthlyAdsBudget > 0 ? revenue / inputs.monthlyAdsBudget : 0;
  const cpl = leads > 0 ? inputs.monthlyAdsBudget / leads : 0;
  const costPerSale = sales > 0 ? inputs.monthlyAdsBudget / sales : 0;
  return {
    clicks: Math.round(clicks),
    leads: Math.round(leads),
    sqls: Math.round(sqls),
    sales: Math.round(sales),
    revenue: Math.round(revenue),
    roas: Math.round(roas * 100) / 100,
    cpl: Math.round(cpl * 100) / 100,
    costPerSale: Math.round(costPerSale * 100) / 100,
  };
}
