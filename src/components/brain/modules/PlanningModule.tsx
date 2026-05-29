import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Sparkles, Plus, ChevronDown, ChevronUp, Workflow, Trash2,
  Database, TrendingUp, Users as UsersIcon, FileText, BarChart3, Megaphone, X,
} from 'lucide-react';
import type { Client } from '@/types/client';
import type { FunnelKind, FunnelDoc, FunnelNode } from '@/types/funnel';
import { FUNNEL_KIND_META } from '@/types/funnel';
import { useFunnelStore, templateForKind } from '@/store/useFunnelStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
import { runMarketResearch, TOPIC_META, type ResearchTopic, type ResearchResult, type ResearchInsight } from '@/services/marketResearchAgent';
import { toast } from '@/store/useToastStore';
import { withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';

export function PlanningModule({ client }: { client: Client }) {
  return (
    <div className="space-y-6">
      <MarketResearchPanel client={client} />
      <FunnelSystemPanel client={client} />
    </div>
  );
}

/* ───────────────────────── A · Agente de investigación ───────────────────────── */

function MarketResearchPanel({ client }: { client: Client }) {
  const accent = client.primaryColor;
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<ResearchTopic[]>(['benchmarks', 'trends', 'competition']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const r = await runMarketResearch({ industry: client.industry, country: client.onboardingData.identity?.country, topics });
      setResult(r);
      setOpen(false);
      toast.success('Investigación lista');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface p-5">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="heading text-base font-bold flex items-center gap-1.5">
            <Search className="h-4 w-4" /> Investigación de Mercado con IA
          </h3>
          <p className="text-[11px] text-text-muted">Agente especializado en benchmarks y competencia para {client.industry}</p>
        </div>
        <Button leftIcon={<Search className="h-4 w-4" />} onClick={() => setOpen(true)}>
          🔍 Iniciar Investigación de Mercado
        </Button>
      </header>

      {result ? (
        <ResearchResultsView result={result} accent={accent} />
      ) : (
        <div className="rounded-[10px] border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
          Configura los focos de investigación y lanza el agente.
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Configurar agente de investigación"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />} loading={loading} onClick={run}>
              Investigar ahora
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary mb-3">¿Qué quieres investigar?</p>
        <CheckboxGroup
          options={(Object.keys(TOPIC_META) as ResearchTopic[]).map((t) => ({ value: t, label: TOPIC_META[t].label }))}
          value={topics}
          onChange={(v) => setTopics(v as ResearchTopic[])}
        />
      </Modal>
    </section>
  );
}

const CATEGORY_ICON = {
  benchmarks: Database, tendencias: TrendingUp, estrategias_competencia: UsersIcon,
  angulos_comunicacion: Megaphone, stack_recomendado: BarChart3, insights_clave: FileText,
};
const CATEGORY_LABEL = {
  benchmarks: 'Benchmarks', tendencias: 'Tendencias', estrategias_competencia: 'Estrategias de competencia',
  angulos_comunicacion: 'Ángulos de comunicación', stack_recomendado: 'Stack recomendado', insights_clave: 'Insights clave',
};

function ResearchResultsView({ result, accent }: { result: ResearchResult; accent: string }) {
  const sections = Object.entries(result).filter(([k, v]) => k !== 'fuentes_referenciadas' && Array.isArray(v) && v.length > 0) as Array<[keyof ResearchResult, ResearchInsight[]]>;
  return (
    <div className="space-y-3">
      {sections.map(([key, items]) => {
        const Icon = CATEGORY_ICON[key as keyof typeof CATEGORY_ICON] ?? Database;
        return (
          <div key={key} className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: withAlpha(accent, 0.15), color: accent }}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-sm font-bold text-text-primary">{CATEGORY_LABEL[key as keyof typeof CATEGORY_LABEL] ?? key}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((it) => (
                <div key={it.id} className="rounded-md border border-border-subtle bg-bg-surface p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="text-xs font-semibold text-text-primary">{it.title}</div>
                    <Badge tone={it.source === 'benchmark' ? 'info' : 'accent'}>
                      {it.source === 'benchmark' ? 'Benchmark' : 'Tendencia 2025-2026'}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary leading-snug">{it.content}</p>
                  <Button size="sm" variant="ghost" className="mt-2" onClick={() => toast.success('Agregado a Planeación')}>
                    <Plus className="h-3 w-3" /> Agregar a Planeación
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="rounded-md border border-border-subtle bg-bg-base/20 p-3 text-[10px] text-text-muted">
        <strong>Fuentes consultadas:</strong> {result.fuentes_referenciadas.join(' · ')}
      </div>
    </div>
  );
}

/* ───────────────────────── B · Sistema de Embudos ───────────────────────── */

function FunnelSystemPanel({ client }: { client: Client }) {
  const accent = client.primaryColor;
  const allFunnels = useFunnelStore((s) => s.funnels);
  const funnels = allFunnels.filter((f) => f.clientId === client.id);
  const add = useFunnelStore((s) => s.add);
  const remove = useFunnelStore((s) => s.remove);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedFunnel, setSelectedFunnel] = useState<FunnelDoc | null>(null);
  const [editingNode, setEditingNode] = useState<FunnelNode | null>(null);

  const create = (kind: FunnelKind) => {
    const f = templateForKind(kind, client.id);
    add(f);
    setSelectedFunnel(f);
    setPickerOpen(false);
    toast.success(`Embudo "${FUNNEL_KIND_META[kind].label}" creado`);
  };

  return (
    <section className="surface p-5">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="heading text-base font-bold flex items-center gap-1.5">
            <Workflow className="h-4 w-4" /> Sistema de Embudos
          </h3>
          <p className="text-[11px] text-text-muted">Constructor visual por tipo de proyecto</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setPickerOpen(true)}>
          Crear embudo
        </Button>
      </header>

      {funnels.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
          Aún no hay embudos. Crea uno para empezar.
        </div>
      ) : (
        <div className="space-y-3">
          {funnels.map((f) => (
            <FunnelCard
              key={f.id}
              funnel={f}
              accent={accent}
              isSelected={selectedFunnel?.id === f.id}
              onSelect={() => setSelectedFunnel(selectedFunnel?.id === f.id ? null : f)}
              onDelete={() => { remove(f.id); if (selectedFunnel?.id === f.id) setSelectedFunnel(null); toast.success('Embudo eliminado'); }}
              onNodeClick={setEditingNode}
            />
          ))}
        </div>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="¿Qué tipo de embudo quieres crear?"
        size="md"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(FUNNEL_KIND_META) as FunnelKind[]).map((k) => (
            <button
              key={k}
              onClick={() => create(k)}
              className="rounded-md border border-border-subtle bg-bg-elevated/30 p-3 text-left hover:bg-bg-elevated transition"
            >
              <div className="text-sm font-semibold text-text-primary">{FUNNEL_KIND_META[k].label}</div>
              <div className="text-[11px] text-text-muted mt-0.5">{FUNNEL_KIND_META[k].description}</div>
            </button>
          ))}
        </div>
      </Modal>

      {editingNode && (
        <NodeDetailDrawer
          node={editingNode}
          accent={accent}
          onClose={() => setEditingNode(null)}
        />
      )}
    </section>
  );
}

function FunnelCard({
  funnel, accent, isSelected, onSelect, onDelete, onNodeClick,
}: {
  funnel: FunnelDoc;
  accent: string;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onNodeClick: (n: FunnelNode) => void;
}) {
  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/30">
      <header className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer" onClick={onSelect}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <h4 className="text-sm font-bold text-text-primary truncate">{funnel.name}</h4>
          <Badge tone="neutral">{FUNNEL_KIND_META[funnel.kind].label}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-7 w-7 rounded-md text-text-muted hover:text-status-danger hover:bg-bg-elevated">
            <Trash2 className="h-3.5 w-3.5 mx-auto" />
          </button>
          {isSelected ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
        </div>
      </header>
      {isSelected && (
        <div className="border-t border-border-subtle p-4">
          <FunnelDiagram funnel={funnel} accent={accent} onNodeClick={onNodeClick} />
        </div>
      )}
    </div>
  );
}

function FunnelDiagram({ funnel, accent, onNodeClick }: { funnel: FunnelDoc; accent: string; onNodeClick: (n: FunnelNode) => void }) {
  // Layout vertical simplificado: nodos source en top fila, luego cascada vertical.
  const sources = funnel.nodes.filter((n) => n.type === 'source');
  const rest = funnel.nodes.filter((n) => n.type !== 'source');

  return (
    <div className="space-y-2">
      {sources.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Fuentes de tráfico</div>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((n) => (
              <button
                key={n.id}
                onClick={() => onNodeClick(n)}
                className="rounded-md border px-2.5 py-1.5 text-xs hover:brightness-125 transition"
                style={{ background: withAlpha(accent, 0.10), borderColor: withAlpha(accent, 0.35), color: accent }}
              >
                {n.label}
              </button>
            ))}
          </div>
          <div className="text-center text-text-muted text-lg">↓</div>
        </div>
      )}

      <div className="space-y-1.5">
        {rest.map((n, i) => (
          <div key={n.id} className="flex flex-col items-center">
            <button
              onClick={() => onNodeClick(n)}
              className={cn(
                'rounded-md border px-4 py-2 text-sm w-full max-w-md text-left hover:brightness-125 transition',
                n.type === 'lead' && 'transform',
              )}
              style={{
                background:
                  n.type === 'sale' ? withAlpha('#10B981', 0.15) :
                  n.type === 'lead' ? withAlpha(accent, 0.18) :
                  n.type === 'split' ? 'rgba(245,158,11,0.10)' :
                  'rgba(255,255,255,0.04)',
                borderColor:
                  n.type === 'sale' ? 'rgba(16,185,129,0.4)' :
                  n.type === 'lead' ? withAlpha(accent, 0.4) :
                  n.type === 'split' ? 'rgba(245,158,11,0.3)' :
                  'rgba(255,255,255,0.10)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-text-primary">{n.label}</span>
                {n.expectedConvRate !== undefined && (
                  <span className="text-[10px] text-text-muted">{(n.expectedConvRate * 100).toFixed(1)}%</span>
                )}
              </div>
            </button>
            {i < rest.length - 1 && <div className="text-text-muted text-lg my-0.5">↓</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeDetailDrawer({ node, accent, onClose }: { node: FunnelNode; accent: string; onClose: () => void }) {
  const [draft, setDraft] = useState(node);
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          Detalle del nodo
        </span>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => { toast.success('Cambios guardados'); onClose(); }}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Nombre" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <Textarea label="Descripción / objetivo" rows={3} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Tasa de conversión esperada (%)"
            type="number"
            step="0.5"
            value={(draft.expectedConvRate ?? 0) * 100}
            onChange={(e) => setDraft({ ...draft, expectedConvRate: Number(e.target.value) / 100 })}
          />
          <Select
            label="Herramienta"
            value={draft.tool ?? ''}
            options={['', 'ClickFunnels', 'Leadpages', 'WordPress', 'Webflow', 'Shopify', 'Hotmart', 'Otro'].map((v) => ({ value: v, label: v || '—' }))}
            onChange={(e) => setDraft({ ...draft, tool: e.target.value })}
          />
        </div>
        <Input label="Responsable" value={draft.responsible ?? ''} onChange={(e) => setDraft({ ...draft, responsible: e.target.value })} />
      </div>
    </Modal>
  );
}
