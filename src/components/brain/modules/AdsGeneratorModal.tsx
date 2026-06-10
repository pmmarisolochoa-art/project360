import { useState } from 'react';
import { Sparkles, Copy as CopyIcon, RefreshCw, DollarSign } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/useToastStore';
import { withAlpha } from '@/utils/colorGenerator';
import { generateAdVariants, type AdVariant } from '@/services/claudeApi';
import type { Client } from '@/types/client';

/**
 * Generador de anuncios para pauta — devuelve 5 variantes con ángulos distintos
 * (dolor, deseo, objeción, prueba social, curiosidad) para Meta / Google /
 * TikTok / YouTube Ads. Las variantes son transientes: el usuario las copia
 * y las lleva al Ads Manager.
 */

const AD_PLATFORMS = [
  { value: 'meta',    label: 'Meta Ads (Facebook + Instagram)' },
  { value: 'google',  label: 'Google Ads (Search)' },
  { value: 'tiktok',  label: 'TikTok Ads' },
  { value: 'youtube', label: 'YouTube Ads' },
];

const AD_OBJECTIVES = [
  { value: 'conversiones',   label: '🎯 Conversiones (venta directa)' },
  { value: 'leads',          label: '🧲 Leads (captura de datos)' },
  { value: 'trafico',        label: '🚶 Tráfico al sitio' },
  { value: 'mensajes',       label: '💬 Mensajes / DM' },
  { value: 'reconocimiento', label: '📢 Reconocimiento de marca' },
];

const ANGLE_COLOR: Record<string, string> = {
  pain:         '#EF4444',
  desire:       '#EC4899',
  objection:    '#F59E0B',
  social_proof: '#10B981',
  curiosity:    '#6366F1',
};

export function AdsGeneratorModal({
  client, accent, onClose,
}: {
  client: Client;
  accent: string;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState('meta');
  const [objective, setObjective] = useState('conversiones');
  const [productOrOffer, setProductOrOffer] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<AdVariant[]>([]);

  const run = async () => {
    if (!productOrOffer.trim()) {
      toast.error('Describe qué se anuncia (producto, oferta, lead magnet…)');
      return;
    }
    setLoading(true);
    try {
      const brain = client.aiBrainData ?? {};
      const arch = brain.brandArchitecture;
      const result = await generateAdVariants({
        clientName: client.name,
        industry: client.industry,
        platform,
        objective,
        productOrOffer,
        landingUrl: landingUrl || undefined,
        budget: budget || undefined,
        irresistibleOffer: brain.irresistibleOffer,
        brandMission: arch?.mission,
        brandVoiceTone: arch?.voiceTone,
        brandDos: arch?.dos,
        brandDonts: arch?.donts,
        personas: brain.buyerPersonas,
      });
      setVariants(result);
      toast.success(`${result.length} variantes generadas — elige la que mejor convierta`);
    } finally {
      setLoading(false);
    }
  };

  const copyVariant = (v: AdVariant) => {
    const parts = [
      v.headline && `🎯 HEADLINE\n${v.headline}`,
      v.primaryText && `\n📝 TEXTO PRINCIPAL\n${v.primaryText}`,
      v.description && `\n🔗 DESCRIPCIÓN\n${v.description}`,
      v.ctaButton && `\n🔘 BOTÓN CTA: ${v.ctaButton}`,
    ].filter(Boolean).join('\n');
    void navigator.clipboard.writeText(parts);
    toast.success(`Variante "${v.angleLabel}" copiada`);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" style={{ color: accent }} />
          Anuncios para pauta — generador IA
        </span>
      }
    >
      <div className="space-y-4">
        {/* Form */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Plataforma"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            options={AD_PLATFORMS}
          />
          <Select
            label="Objetivo de campaña"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            options={AD_OBJECTIVES}
          />
        </div>

        <Textarea
          label="¿Qué se anuncia? (producto, oferta, lead magnet…)"
          rows={2}
          value={productOrOffer}
          onChange={(e) => setProductOrOffer(e.target.value)}
          placeholder="Ej: Workshop online de cierre de ventas para coaches — 4 sesiones · $97"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Landing / URL destino"
            type="url"
            value={landingUrl}
            onChange={(e) => setLandingUrl(e.target.value)}
            placeholder="https://… (opcional)"
          />
          <Input
            label="Presupuesto mensual"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Ej: $1500 USD (opcional)"
          />
        </div>

        <div className="rounded-[10px] border border-dashed border-border-default bg-bg-base/30 p-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-text-secondary leading-relaxed">
            La IA usa la arquitectura de marca, oferta irresistible y avatar del cliente para
            generar <strong>5 variantes</strong> con ángulos distintos: <em>dolor · deseo · objeción · prueba social · curiosidad</em>.
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="shrink-0 text-xs inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:brightness-125 disabled:opacity-50 font-medium"
            style={{ color: accent, borderColor: withAlpha(accent, 0.4), background: withAlpha(accent, 0.10) }}
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? 'Generando…' : variants.length > 0 ? 'Regenerar 5 variantes' : 'Generar 5 variantes'}
          </button>
        </div>

        {/* Variantes */}
        {variants.length > 0 && (
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted">
              {variants.length} variantes — copia la que mejor encaje
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {variants.map((v, i) => (
                <VariantCard key={i} variant={v} onCopy={() => copyVariant(v)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function VariantCard({ variant, onCopy }: { variant: AdVariant; onCopy: () => void }) {
  const color = ANGLE_COLOR[variant.angle] ?? '#6366F1';
  return (
    <div
      className="rounded-[12px] border p-4 space-y-3 transition hover:brightness-105"
      style={{ borderColor: withAlpha(color, 0.35), background: withAlpha(color, 0.05) }}
    >
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: withAlpha(color, 0.18), color }}
        >
          {variant.angleLabel}
        </span>
        <button
          onClick={onCopy}
          className="text-[11px] inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 hover:bg-bg-elevated text-text-secondary"
          title="Copiar variante completa"
        >
          <CopyIcon className="h-3 w-3" /> Copiar
        </button>
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-wider text-text-muted mb-0.5">Headline</div>
        <div className="text-sm font-semibold text-text-primary leading-tight">
          {variant.headline}
        </div>
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-wider text-text-muted mb-0.5">Texto principal</div>
        <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
          {variant.primaryText}
        </div>
      </div>

      {variant.description && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-text-muted mb-0.5">Descripción</div>
          <div className="text-xs text-text-secondary">{variant.description}</div>
        </div>
      )}

      <div className="pt-1 border-t border-border-subtle">
        <Badge tone="accent">{variant.ctaButton}</Badge>
      </div>
    </div>
  );
}
