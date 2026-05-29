import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Target, Gem, BookOpen, Users2, Globe, Mail, Phone,
  Sparkles, RefreshCw, Pencil, Save, X, AlertTriangle, Check,
} from 'lucide-react';
import type { Client, AIBrainData } from '@/types/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';
import { useClientStore } from '@/store/useClientStore';
import { toast } from '@/store/useToastStore';
import { regenerateBrainSection } from '@/services/claudeApi';
import { AIOptionsFlow } from './AIOptionsFlow';

type SubSection = '1A' | '1B' | '1C' | '1D' | '1E';

const subSections: Array<{ id: SubSection; label: string; icon: typeof Building2 }> = [
  { id: '1A', label: 'Ficha del Cliente', icon: Building2 },
  { id: '1B', label: 'Análisis de Mercado', icon: Target },
  { id: '1C', label: 'Oferta Irresistible', icon: Gem },
  { id: '1D', label: 'Narrativa de Marca', icon: BookOpen },
  { id: '1E', label: 'Buyer Personas', icon: Users2 },
];

const INDUSTRIES = [
  'Salud & Bienestar', 'EdTech', 'Moda & Streetwear', 'Belleza', 'Inmobiliario',
  'Fitness', 'Coaching', 'Software / SaaS', 'Consultoría', 'Restaurantes',
  'Servicios profesionales', 'Otro',
];
const BUSINESS_TYPES = [
  'B2C', 'B2B', 'D2C Ecommerce', 'Infoproducto / Curso', 'Servicio profesional',
  'Coaching / Mentoría', 'Software / SaaS', 'Retail físico con presencia digital', 'Otro',
];
const CURRENCIES = ['USD', 'COP', 'MXN', 'EUR', 'ARS', 'CLP', 'PEN', 'BRL'];

export function ProfileModule({ client }: { client: Client }) {
  const [active, setActive] = useState<SubSection>('1A');
  const accent = client.primaryColor;

  return (
    <div className="space-y-4">
      <div className="surface p-1.5 flex items-center gap-1 overflow-x-auto">
        {subSections.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-[8px] px-3 py-2 text-xs font-medium whitespace-nowrap transition-all focus-ring',
                isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
              style={isActive ? { background: withAlpha(accent, 0.15), boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.3)}` } : undefined}
            >
              <s.icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono text-text-muted">{s.id}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      <motion.div
        key={active}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {active === '1A' && <ClientCard client={client} accent={accent} />}
        {active === '1B' && <MarketAnalysis client={client} accent={accent} />}
        {active === '1C' && <IrresistibleOffer client={client} accent={accent} />}
        {active === '1D' && <BrandNarrative client={client} accent={accent} />}
        {active === '1E' && <BuyerPersonas client={client} accent={accent} />}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1A — Ficha del Cliente (con edición in-place)
   ═══════════════════════════════════════════════════════════════════════════ */

type EditingSection = 'business' | 'contact' | null;

interface FichaDraft {
  // Datos del negocio
  businessName: string;
  founderName: string;
  industry: string;
  yearsInMarket: number;
  country: string;
  city: string;
  businessType: string;
  averageTicket: number;
  currency: string;
  starProduct: string;
  // Contacto
  email: string;
  whatsapp: string;
  website: string;
}

function buildDraft(client: Client): FichaDraft {
  const id = client.onboardingData.identity;
  const biz = client.onboardingData.business as Record<string, unknown> | undefined;
  return {
    businessName: id?.businessName ?? client.name,
    founderName: id?.founderName ?? '',
    industry: id?.industry ?? client.industry,
    yearsInMarket: id?.yearsInMarket ?? 0,
    country: id?.country ?? '',
    city: id?.city ?? '',
    businessType: (biz?.businessType as string) ?? client.businessType,
    averageTicket: (biz?.averageTicket as number) ?? 0,
    currency: (biz?.currency as string) ?? 'USD',
    starProduct: (biz?.starProduct as string) ?? '',
    email: id?.email ?? '',
    whatsapp: id?.whatsapp ?? '',
    website: id?.website ?? '',
  };
}

function ClientCard({ client, accent }: { client: Client; accent: string }) {
  const updateClient = useClientStore((s) => s.updateClient);
  const [editing, setEditing] = useState<EditingSection>(null);
  const [draft, setDraft] = useState<FichaDraft>(() => buildDraft(client));
  const [errors, setErrors] = useState<Partial<Record<keyof FichaDraft, string>>>({});

  // Reset draft cuando cambia el cliente (navegación entre cerebros)
  useEffect(() => { setDraft(buildDraft(client)); setEditing(null); setErrors({}); }, [client.id]);

  const startEdit = (which: 'business' | 'contact') => {
    setDraft(buildDraft(client));
    setErrors({});
    setEditing(which);
  };

  const cancel = () => {
    setDraft(buildDraft(client));
    setErrors({});
    setEditing(null);
  };

  const validate = (which: 'business' | 'contact'): boolean => {
    const e: Partial<Record<keyof FichaDraft, string>> = {};
    if (which === 'business') {
      if (!draft.businessName.trim()) e.businessName = 'Requerido';
      if (!draft.founderName.trim()) e.founderName = 'Requerido';
      if (!draft.industry.trim()) e.industry = 'Requerido';
      if (draft.yearsInMarket < 0) e.yearsInMarket = 'Inválido';
      if (draft.averageTicket < 0) e.averageTicket = 'Inválido';
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) e.email = 'Email inválido';
      if (!draft.whatsapp.trim()) e.whatsapp = 'Requerido';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    if (!editing) return;
    if (!validate(editing)) {
      toast.error('Revisa los campos marcados antes de guardar.');
      return;
    }
    // Merge ambos lugares: top-level del Client + onboardingData
    const prevIdentity = client.onboardingData.identity ?? ({} as NonNullable<typeof client.onboardingData.identity>);
    const prevBusiness = (client.onboardingData.business as Record<string, unknown>) ?? {};

    updateClient(client.id, {
      name: draft.businessName,
      industry: draft.industry,
      businessType: draft.businessType,
      onboardingData: {
        ...client.onboardingData,
        identity: {
          ...prevIdentity,
          businessName: draft.businessName,
          founderName: draft.founderName,
          email: draft.email,
          whatsapp: draft.whatsapp,
          industry: draft.industry,
          yearsInMarket: draft.yearsInMarket,
          country: draft.country,
          city: draft.city,
          website: draft.website || undefined,
        },
        business: {
          ...prevBusiness,
          businessType: draft.businessType,
          averageTicket: draft.averageTicket,
          currency: draft.currency,
          starProduct: draft.starProduct,
        },
      },
    });
    toast.success('Ficha actualizada correctamente');
    setEditing(null);
    setErrors({});
  };

  const isBizEdit = editing === 'business';
  const isContactEdit = editing === 'contact';

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 rounded-[10px] border border-status-warning/30 bg-status-warning/10 px-3.5 py-2.5 text-sm text-status-warning"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Modo edición activo — los cambios no se guardan hasta que hagas click en{' '}
              <strong className="font-semibold">Guardar</strong>.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Datos del negocio */}
        <div className="surface p-5 lg:col-span-2">
          <SectionTitleRow
            icon={<Building2 className="h-4 w-4" />}
            title="Datos del negocio"
            accent={accent}
            action={
              isBizEdit ? (
                <EditActions onCancel={cancel} onSave={save} />
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => startEdit('business')}
                  disabled={editing === 'contact'}
                >
                  Editar
                </Button>
              )
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <EditableField
              label="Nombre comercial"
              editing={isBizEdit}
              value={draft.businessName}
              displayValue={client.name}
              onChange={(v) => setDraft({ ...draft, businessName: v })}
              accent={accent}
              error={errors.businessName}
              required
            />
            <EditableField
              label="Fundador / Contacto"
              editing={isBizEdit}
              value={draft.founderName}
              displayValue={client.onboardingData.identity?.founderName}
              onChange={(v) => setDraft({ ...draft, founderName: v })}
              accent={accent}
              error={errors.founderName}
              required
            />
            <EditableSelect
              label="Industria"
              editing={isBizEdit}
              value={draft.industry}
              displayValue={client.industry}
              options={industriesWithCurrent(draft.industry)}
              onChange={(v) => setDraft({ ...draft, industry: v })}
              accent={accent}
              error={errors.industry}
              required
            />
            <EditableField
              label="Años en el mercado"
              type="number"
              editing={isBizEdit}
              value={String(draft.yearsInMarket)}
              displayValue={`${client.onboardingData.identity?.yearsInMarket ?? 0} años`}
              onChange={(v) => setDraft({ ...draft, yearsInMarket: Number(v) || 0 })}
              accent={accent}
              error={errors.yearsInMarket}
            />
            <div className="grid grid-cols-2 gap-2">
              <EditableField
                label="País"
                editing={isBizEdit}
                value={draft.country}
                displayValue={client.onboardingData.identity?.country}
                onChange={(v) => setDraft({ ...draft, country: v })}
                accent={accent}
              />
              <EditableField
                label="Ciudad"
                editing={isBizEdit}
                value={draft.city}
                displayValue={client.onboardingData.identity?.city}
                onChange={(v) => setDraft({ ...draft, city: v })}
                accent={accent}
              />
            </div>
            <EditableSelect
              label="Tipo de negocio"
              editing={isBizEdit}
              value={draft.businessType}
              displayValue={client.businessType}
              options={businessTypesWithCurrent(draft.businessType)}
              onChange={(v) => setDraft({ ...draft, businessType: v })}
              accent={accent}
            />
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <EditableField
                label="Ticket promedio"
                type="number"
                editing={isBizEdit}
                value={String(draft.averageTicket)}
                displayValue={`${draft.currency} ${draft.averageTicket}`}
                onChange={(v) => setDraft({ ...draft, averageTicket: Number(v) || 0 })}
                accent={accent}
                error={errors.averageTicket}
              />
              <EditableSelect
                label="Moneda"
                editing={isBizEdit}
                value={draft.currency}
                displayValue={draft.currency}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                onChange={(v) => setDraft({ ...draft, currency: v })}
                accent={accent}
              />
            </div>
            <EditableField
              label="Producto estrella"
              editing={isBizEdit}
              value={draft.starProduct}
              displayValue={(client.onboardingData.business as { starProduct?: string } | undefined)?.starProduct}
              onChange={(v) => setDraft({ ...draft, starProduct: v })}
              accent={accent}
            />
          </div>
        </div>

        {/* Contacto & redes */}
        <div className="surface p-5">
          <SectionTitleRow
            icon={<Globe className="h-4 w-4" />}
            title="Contacto & redes"
            accent={accent}
            action={
              isContactEdit ? (
                <EditActions onCancel={cancel} onSave={save} />
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => startEdit('contact')}
                  disabled={editing === 'business'}
                >
                  Editar
                </Button>
              )
            }
          />

          <div className="mt-4 space-y-3">
            <EditableField
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Email"
              type="email"
              editing={isContactEdit}
              value={draft.email}
              displayValue={client.onboardingData.identity?.email}
              onChange={(v) => setDraft({ ...draft, email: v })}
              accent={accent}
              error={errors.email}
              required
              inline
            />
            <EditableField
              icon={<Phone className="h-3.5 w-3.5" />}
              label="WhatsApp"
              editing={isContactEdit}
              value={draft.whatsapp}
              displayValue={client.onboardingData.identity?.whatsapp}
              onChange={(v) => setDraft({ ...draft, whatsapp: v })}
              accent={accent}
              error={errors.whatsapp}
              required
              inline
            />
            <EditableField
              icon={<Globe className="h-3.5 w-3.5" />}
              label="Sitio web"
              type="url"
              editing={isContactEdit}
              value={draft.website}
              displayValue={client.onboardingData.identity?.website}
              onChange={(v) => setDraft({ ...draft, website: v })}
              accent={accent}
              inline
            />

            {client.onboardingData.identity?.socials &&
              Object.keys(client.onboardingData.identity.socials).length > 0 && (
                <div className="pt-2 border-t border-border-subtle">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
                    Redes activas
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(client.onboardingData.identity.socials).map(([platform, handle]) =>
                      handle ? (
                        <Badge key={platform} tone="neutral" className="lowercase">
                          {platform}: {handle}
                        </Badge>
                      ) : null,
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function industriesWithCurrent(current: string) {
  const list = INDUSTRIES.map((i) => ({ value: i, label: i }));
  if (current && !INDUSTRIES.includes(current)) list.unshift({ value: current, label: `${current} (actual)` });
  return list;
}
function businessTypesWithCurrent(current: string) {
  const list = BUSINESS_TYPES.map((b) => ({ value: b, label: b }));
  if (current && !BUSINESS_TYPES.includes(current)) list.unshift({ value: current, label: `${current} (actual)` });
  return list;
}

function EditActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="ghost" leftIcon={<X className="h-3.5 w-3.5" />} onClick={onCancel}>
        Cancelar
      </Button>
      <Button size="sm" leftIcon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>
        Guardar cambios
      </Button>
    </div>
  );
}

/* ───────── Editable primitives ───────── */

function EditableField({
  label, value, displayValue, editing, onChange, accent,
  error, required, type = 'text', icon, inline,
}: {
  label: string;
  value: string;
  displayValue?: string | number | null;
  editing: boolean;
  onChange: (v: string) => void;
  accent: string;
  error?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'url' | 'number';
  icon?: React.ReactNode;
  inline?: boolean;
}) {
  if (!editing) {
    if (inline) {
      return (
        <div className="flex items-center gap-2.5 text-sm">
          {icon && <span className="text-text-muted">{icon}</span>}
          <span className="text-text-primary break-all">{displayValue || '—'}</span>
        </div>
      );
    }
    return (
      <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
        <div className="text-sm text-text-primary mt-1 truncate">{displayValue ?? '—'}</div>
      </div>
    );
  }

  return (
    <div
      className="rounded-[10px] border bg-bg-elevated/40 p-3 transition-all"
      style={{ borderColor: error ? 'rgba(239,68,68,0.5)' : withAlpha(accent, 0.4) }}
    >
      <label className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
        {icon && <span>{icon}</span>}
        {label}
        {required && <span className="text-status-danger">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-text-primary outline-none mt-1"
        style={{ caretColor: accent }}
      />
      {error && <div className="text-[10px] text-status-danger mt-1">{error}</div>}
    </div>
  );
}

function EditableSelect({
  label, value, displayValue, editing, options, onChange, accent, error, required,
}: {
  label: string;
  value: string;
  displayValue?: string | number | null;
  editing: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  accent: string;
  error?: string;
  required?: boolean;
}) {
  if (!editing) {
    return (
      <div className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
        <div className="text-sm text-text-primary mt-1 truncate">{displayValue ?? '—'}</div>
      </div>
    );
  }
  return (
    <div
      className="rounded-[10px] border bg-bg-elevated/40 p-3 transition-all"
      style={{ borderColor: error ? 'rgba(239,68,68,0.5)' : withAlpha(accent, 0.4) }}
    >
      <label className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
        {required && <span className="text-status-danger ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-text-primary outline-none mt-1 appearance-none"
        style={{ caretColor: accent }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg-elevated">
            {o.label}
          </option>
        ))}
      </select>
      {error && <div className="text-[10px] text-status-danger mt-1">{error}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1B — Análisis de Mercado (regenerar con IA)
   ═══════════════════════════════════════════════════════════════════════════ */

function MarketAnalysis({ client, accent }: { client: Client; accent: string }) {
  const updateClient = useClientStore((s) => s.updateClient);
  const [loading, setLoading] = useState(false);
  const [showAiFlow, setShowAiFlow] = useState(false);
  const brain = client.aiBrainData;
  const competition = client.onboardingData.competition as Record<string, unknown> | undefined;

  const regenerate = async () => {
    setLoading(true);
    try {
      const patch = await regenerateBrainSection({
        section: 'market',
        current: brain,
        identity: {
          businessName: client.name,
          industry: client.industry,
          founderName: client.onboardingData.identity?.founderName,
        },
      });
      updateClient(client.id, {
        aiBrainData: { ...brain, ...patch, generatedAt: new Date().toISOString() },
      });
      toast.success('Análisis de mercado regenerado');
    } catch {
      toast.error('No pudimos regenerar el análisis');
    } finally {
      setLoading(false);
    }
  };

  if (!brain.executiveSummary) {
    return (
      <EmptyState
        message="Aún no se ha generado el análisis de mercado con IA."
        accent={accent}
        action={
          <Button size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={regenerate} loading={loading}>
            Generar con IA
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="Resumen ejecutivo" accent={accent} subtitle="Generado por IA" />
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => setShowAiFlow(!showAiFlow)}>
              {showAiFlow ? 'Cerrar IA' : 'Generar en 3 pasos'}
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={regenerate} loading={loading}>
              Regenerar
            </Button>
          </div>
        </div>
        {showAiFlow ? (
          <AIOptionsFlow
            accent={accent}
            section="market"
            context={{ businessName: client.name, industry: client.industry, founderName: client.onboardingData.identity?.founderName }}
            initialContent={brain.executiveSummary}
            onSave={(content) => updateClient(client.id, { aiBrainData: { ...brain, executiveSummary: content, generatedAt: new Date().toISOString() } })}
          />
        ) : (
          <p className="text-sm text-text-primary leading-relaxed">{brain.executiveSummary}</p>
        )}
        {brain.generatedAt && !showAiFlow && (
          <div className="text-[10px] text-text-muted mt-3 flex items-center gap-1">
            <Check className="h-3 w-3" /> Última generación: {new Date(brain.generatedAt).toLocaleString('es')}
          </div>
        )}
      </div>

      {brain.gapAnalysis && (
        <div className="surface p-5">
          <SectionTitle icon={<Target className="h-4 w-4" />} title="Análisis de brechas" accent={accent} />
          <p className="text-sm text-text-secondary leading-relaxed mt-3">{brain.gapAnalysis}</p>
        </div>
      )}

      {competition && (
        <div className="surface p-5">
          <SectionTitle icon={<Users2 className="h-4 w-4" />} title="Competencia identificada" accent={accent} />
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {(['competitor1', 'competitor2', 'competitor3'] as const).map((k, i) => (
              <div key={k} className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  Competidor #{i + 1}
                </div>
                <div className="text-sm text-text-primary mt-1">
                  {(competition[k] as string) ?? '—'}
                </div>
              </div>
            ))}
          </div>
          {(competition.differentiator as string) && (
            <div className="mt-3 rounded-[10px] p-3" style={{ background: withAlpha(accent, 0.08), border: `1px solid ${withAlpha(accent, 0.25)}` }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: accent }}>
                Diferenciador real
              </div>
              <div className="text-sm text-text-primary">{competition.differentiator as string}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1C — Oferta Irresistible (editable + regenerar)
   ═══════════════════════════════════════════════════════════════════════════ */

function IrresistibleOffer({ client, accent }: { client: Client; accent: string }) {
  const updateClient = useClientStore((s) => s.updateClient);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(client.aiBrainData.irresistibleOffer ?? '');
  const [loading, setLoading] = useState(false);
  const [showAiFlow, setShowAiFlow] = useState(false);
  const goals = client.onboardingData.goals as Record<string, unknown> | undefined;

  useEffect(() => { setDraft(client.aiBrainData.irresistibleOffer ?? ''); setEditing(false); }, [client.id]);

  const save = () => {
    updateClient(client.id, { aiBrainData: { ...client.aiBrainData, irresistibleOffer: draft.trim() } });
    setEditing(false);
    toast.success('Propuesta de valor actualizada');
  };

  const regenerate = async () => {
    setLoading(true);
    try {
      const patch = await regenerateBrainSection({
        section: 'offer',
        current: client.aiBrainData,
        identity: { businessName: client.name, founderName: client.onboardingData.identity?.founderName },
      });
      updateClient(client.id, { aiBrainData: { ...client.aiBrainData, ...patch } });
      setDraft(patch.irresistibleOffer ?? '');
      toast.success('Oferta irresistible regenerada');
    } catch {
      toast.error('No pudimos regenerar la oferta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface p-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl opacity-25" style={{ background: accent }} />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle icon={<Gem className="h-4 w-4" />} title="Propuesta de valor v1" accent={accent} subtitle="Editable por el estratega" />
            {editing ? (
              <EditActions
                onCancel={() => { setDraft(client.aiBrainData.irresistibleOffer ?? ''); setEditing(false); }}
                onSave={save}
              />
            ) : (
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => setShowAiFlow(!showAiFlow)}>
                  {showAiFlow ? 'Cerrar IA' : 'Generar en 3 pasos'}
                </Button>
                <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
                  Editar
                </Button>
                <Button size="sm" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={regenerate} loading={loading}>
                  Regenerar
                </Button>
              </div>
            )}
          </div>

          {showAiFlow ? (
            <div className="mt-4">
              <AIOptionsFlow
                accent={accent}
                section="offer"
                context={{ businessName: client.name, industry: client.industry, founderName: client.onboardingData.identity?.founderName }}
                initialContent={client.aiBrainData.irresistibleOffer}
                onSave={(content) => {
                  updateClient(client.id, { aiBrainData: { ...client.aiBrainData, irresistibleOffer: content } });
                  setDraft(content);
                }}
              />
            </div>
          ) : editing ? (
            <textarea
              rows={5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-4 w-full rounded-[10px] border bg-bg-elevated/40 px-4 py-3 text-base leading-relaxed text-text-primary outline-none resize-y"
              style={{ borderColor: withAlpha(accent, 0.4), caretColor: accent }}
            />
          ) : (
            <blockquote
              className="mt-4 text-lg leading-relaxed border-l-4 pl-4 italic"
              style={{ borderColor: accent }}
            >
              {client.aiBrainData.irresistibleOffer || 'Aún no se ha construido la propuesta de valor.'}
            </blockquote>
          )}
        </div>
      </div>

      {goals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Goal label="Meta 3 meses" value={`$${formatNum(goals.revenue3m)}`} accent={accent} />
          <Goal label="Meta 6 meses" value={`$${formatNum(goals.revenue6m)}`} accent={accent} />
          <Goal label="Meta 12 meses" value={`$${formatNum(goals.revenue12m)}`} accent={accent} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1D — Narrativa de Marca (editable + regenerar)
   ═══════════════════════════════════════════════════════════════════════════ */

interface NarrativeDraft {
  tone: string;
  clientLanguage: string;
  authorityTopics: string;
  forbiddenTopics: string;
}

function BrandNarrative({ client, accent }: { client: Client; accent: string }) {
  const updateClient = useClientStore((s) => s.updateClient);
  const content = (client.onboardingData.content as Record<string, unknown>) ?? {};
  const audience = (client.onboardingData.audience as Record<string, unknown>) ?? {};

  const initial = useMemo<NarrativeDraft>(() => ({
    tone: Array.isArray(content.tone) ? (content.tone as string[]).join(', ') : '',
    clientLanguage: (audience.clientLanguage as string) ?? '',
    authorityTopics: (content.authorityTopics as string) ?? '',
    forbiddenTopics: (content.forbiddenTopics as string) ?? '',
  }), [client.id]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NarrativeDraft>(initial);
  const [loading, setLoading] = useState(false);
  const [showAiFlow, setShowAiFlow] = useState(false);

  useEffect(() => { setDraft(initial); setEditing(false); }, [initial]);

  const save = () => {
    updateClient(client.id, {
      onboardingData: {
        ...client.onboardingData,
        content: {
          ...content,
          tone: draft.tone.split(',').map((t) => t.trim()).filter(Boolean),
          authorityTopics: draft.authorityTopics,
          forbiddenTopics: draft.forbiddenTopics,
        },
        audience: {
          ...audience,
          clientLanguage: draft.clientLanguage,
        },
      },
    });
    setEditing(false);
    toast.success('Narrativa de marca actualizada');
  };

  const regenerate = async () => {
    setLoading(true);
    try {
      await regenerateBrainSection({
        section: 'narrative',
        current: client.aiBrainData,
        identity: { businessName: client.name, industry: client.industry },
      });
      toast.success('Sugerencias de narrativa regeneradas');
    } catch {
      toast.error('No pudimos regenerar la narrativa');
    } finally {
      setLoading(false);
    }
  };

  const tones = Array.isArray(content.tone) ? (content.tone as string[]) : [];

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <div className="flex items-start justify-between gap-3">
          <SectionTitle icon={<BookOpen className="h-4 w-4" />} title="Narrativa de marca" accent={accent} subtitle="Tono, lenguaje y temas" />
          {editing ? (
            <EditActions onCancel={() => { setDraft(initial); setEditing(false); }} onSave={save} />
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => setShowAiFlow(!showAiFlow)}>
                {showAiFlow ? 'Cerrar IA' : 'Generar en 3 pasos'}
              </Button>
              <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button size="sm" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={regenerate} loading={loading}>
                Regenerar
              </Button>
            </div>
          )}
        </div>

        {showAiFlow && (
          <div className="mt-4">
            <AIOptionsFlow
              accent={accent}
              section="narrative"
              context={{ businessName: client.name, industry: client.industry }}
              onSave={(content) => {
                setDraft({ ...draft, clientLanguage: content });
                updateClient(client.id, {
                  onboardingData: { ...client.onboardingData, audience: { ...audience, clientLanguage: content } },
                });
              }}
            />
          </div>
        )}

        <div className="mt-4 space-y-4">
          <NarrativeRow label="Tono de comunicación" editing={editing} accent={accent}>
            {editing ? (
              <input
                value={draft.tone}
                onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
                placeholder="empathic, educational, premium…"
                className="w-full bg-transparent text-sm text-text-primary outline-none"
                style={{ caretColor: accent }}
              />
            ) : tones.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tones.map((t) => <Badge key={t} tone="accent" className="capitalize">{t}</Badge>)}
              </div>
            ) : <span className="text-text-muted text-sm">Sin definir aún.</span>}
          </NarrativeRow>

          <NarrativeRow label="Lenguaje del cliente" editing={editing} accent={accent}>
            {editing ? (
              <textarea
                rows={3}
                value={draft.clientLanguage}
                onChange={(e) => setDraft({ ...draft, clientLanguage: e.target.value })}
                className="w-full bg-transparent text-sm text-text-primary outline-none resize-y"
                style={{ caretColor: accent }}
              />
            ) : draft.clientLanguage ? (
              <p className="text-sm text-text-primary italic">"{draft.clientLanguage}"</p>
            ) : <span className="text-text-muted text-sm">Sin registrar.</span>}
          </NarrativeRow>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NarrativeRow label="Temas con autoridad" editing={editing} accent={accent}>
              {editing ? (
                <textarea
                  rows={3}
                  value={draft.authorityTopics}
                  onChange={(e) => setDraft({ ...draft, authorityTopics: e.target.value })}
                  className="w-full bg-transparent text-sm text-text-primary outline-none resize-y"
                  style={{ caretColor: accent }}
                />
              ) : (
                <p className="text-sm text-text-secondary">{draft.authorityTopics || 'Pendiente definir'}</p>
              )}
            </NarrativeRow>
            <NarrativeRow label="Temas vetados" editing={editing} accent="#EF4444">
              {editing ? (
                <textarea
                  rows={3}
                  value={draft.forbiddenTopics}
                  onChange={(e) => setDraft({ ...draft, forbiddenTopics: e.target.value })}
                  className="w-full bg-transparent text-sm text-text-primary outline-none resize-y"
                />
              ) : (
                <p className="text-sm text-text-secondary">{draft.forbiddenTopics || 'No hay restricciones registradas'}</p>
              )}
            </NarrativeRow>
          </div>
        </div>
      </div>
    </div>
  );
}

function NarrativeRow({
  label, editing, accent, children,
}: {
  label: string;
  editing: boolean;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[10px] border bg-bg-base/30 p-3"
      style={{ borderColor: editing ? withAlpha(accent, 0.4) : 'rgba(255,255,255,0.06)' }}
    >
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">{label}</div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1E — Buyer Personas (editar c/u + regenerar todos)
   ═══════════════════════════════════════════════════════════════════════════ */

function BuyerPersonas({ client, accent }: { client: Client; accent: string }) {
  const updateClient = useClientStore((s) => s.updateClient);
  const personas = client.aiBrainData.buyerPersonas ?? [];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<NonNullable<AIBrainData['buyerPersonas']>[number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAiFlow, setShowAiFlow] = useState(false);
  const [aiOptions, setAiOptions] = useState<Array<{ id: string; title: string; content: string; selected: boolean }>>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { setEditingIdx(null); setDraft(null); }, [client.id]);

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setDraft({ ...personas[i] });
  };
  const cancel = () => { setEditingIdx(null); setDraft(null); };
  const save = () => {
    if (editingIdx === null || !draft) return;
    const next = personas.map((p, i) => (i === editingIdx ? draft : p));
    updateClient(client.id, { aiBrainData: { ...client.aiBrainData, buyerPersonas: next } });
    toast.success(`"${draft.name}" actualizado`);
    cancel();
  };

  const regenerateAll = async () => {
    setLoading(true);
    try {
      const patch = await regenerateBrainSection({
        section: 'personas',
        current: client.aiBrainData,
        identity: { businessName: client.name, industry: client.industry },
      });
      updateClient(client.id, { aiBrainData: { ...client.aiBrainData, ...patch } });
      toast.success('Buyer personas regenerados');
    } catch {
      toast.error('No pudimos regenerar los personas');
    } finally {
      setLoading(false);
    }
  };

  if (personas.length === 0) {
    return <EmptyState message="Aún no se han generado buyer personas con IA." accent={accent} />;
  }

  const generatePersonaOptions = async () => {
    setAiLoading(true);
    try {
      const { generateThreeOptions } = await import('@/services/claudeApi');
      const opts = await generateThreeOptions({
        section: 'personas',
        client: { businessName: client.name, industry: client.industry, founderName: client.onboardingData.identity?.founderName },
      });
      setAiOptions(opts.map((o) => ({ ...o, selected: false })));
    } finally {
      setAiLoading(false);
    }
  };

  const addSelectedPersonas = () => {
    const sel = aiOptions.filter((o) => o.selected);
    if (sel.length === 0) {
      toast.info('Selecciona al menos una persona.');
      return;
    }
    const newPersonas = sel.map((o) => ({
      name: o.title,
      description: o.content,
      pains: ['Pendiente refinar dolores'],
      desires: ['Pendiente refinar deseos'],
    }));
    const combined = [...personas, ...newPersonas].slice(0, 5);
    updateClient(client.id, { aiBrainData: { ...client.aiBrainData, buyerPersonas: combined } });
    toast.success(`${sel.length} persona${sel.length === 1 ? '' : 's'} agregada${sel.length === 1 ? '' : 's'}`);
    setShowAiFlow(false);
    setAiOptions([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Sparkles className="h-3.5 w-3.5" />}
          onClick={() => { setShowAiFlow(!showAiFlow); if (!showAiFlow && aiOptions.length === 0) generatePersonaOptions(); }}
        >
          {showAiFlow ? 'Cerrar IA' : 'Generar opciones (multi-select)'}
        </Button>
        <Button
          size="sm"
          leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />}
          onClick={regenerateAll}
          loading={loading}
        >
          Regenerar todos
        </Button>
      </div>

      {showAiFlow && (
        <div className="surface p-4 space-y-3" style={{ borderColor: withAlpha(accent, 0.3) }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-text-secondary">
              Selecciona hasta {5 - personas.length} persona{(5 - personas.length) === 1 ? '' : 's'} para agregar
            </div>
            <Button size="sm" variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', aiLoading && 'animate-spin')} />} onClick={generatePersonaOptions} loading={aiLoading}>
              Regenerar
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {aiOptions.map((o) => (
              <button
                key={o.id}
                onClick={() => setAiOptions(aiOptions.map((x) => x.id === o.id ? { ...x, selected: !x.selected } : x))}
                className={cn(
                  'rounded-md border p-3 text-left transition',
                  o.selected ? 'border-accent-violet/50 bg-accent-violet/10' : 'border-border-subtle bg-bg-elevated/30 hover:bg-bg-elevated',
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-text-primary">{o.title}</span>
                  {o.selected && <Check className="h-3.5 w-3.5" style={{ color: accent }} />}
                </div>
                <p className="text-[11px] text-text-secondary leading-snug">{o.content}</p>
              </button>
            ))}
          </div>
          <Button size="sm" onClick={addSelectedPersonas}>
            Agregar seleccionadas ({aiOptions.filter((o) => o.selected).length})
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {personas.map((p, i) => {
          const isEdit = editingIdx === i && draft !== null;
          return (
            <motion.div
              key={`${p.name}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="surface p-5 relative overflow-hidden"
              style={isEdit ? { boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.4)}` } : undefined}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
                  >
                    {(isEdit ? draft.name : p.name)[0]}
                  </div>
                  <div className="min-w-0">
                    {isEdit ? (
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="bg-transparent text-base heading font-bold text-text-primary outline-none border-b w-full"
                        style={{ borderColor: withAlpha(accent, 0.4), caretColor: accent }}
                      />
                    ) : (
                      <h3 className="heading text-base font-bold truncate">{p.name}</h3>
                    )}
                    <div className="text-[10px] uppercase tracking-wider text-text-muted">Avatar #{i + 1}</div>
                  </div>
                </div>
                {isEdit ? (
                  <div className="flex gap-1">
                    <button onClick={cancel} className="h-7 w-7 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated" aria-label="Cancelar">
                      <X className="h-3.5 w-3.5 mx-auto" />
                    </button>
                    <button onClick={save} className="h-7 w-7 rounded-md text-status-success hover:bg-status-success/15" aria-label="Guardar">
                      <Save className="h-3.5 w-3.5 mx-auto" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(i)}
                    className="text-[11px] text-text-muted hover:text-text-primary inline-flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
              </div>

              {isEdit ? (
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full text-sm text-text-secondary bg-bg-elevated/40 rounded-md border outline-none p-2 mb-3 resize-y"
                  style={{ borderColor: withAlpha(accent, 0.4), caretColor: accent }}
                />
              ) : (
                <p className="text-sm text-text-secondary leading-relaxed mb-4">{p.description}</p>
              )}

              <PersonaList
                label="Dolores"
                color="#EF4444"
                marker="—"
                items={isEdit ? draft.pains : p.pains}
                editing={isEdit}
                onChange={(items) => isEdit && setDraft({ ...draft, pains: items })}
              />
              <PersonaList
                label="Deseos"
                color="#10B981"
                marker="+"
                items={isEdit ? draft.desires : p.desires}
                editing={isEdit}
                onChange={(items) => isEdit && setDraft({ ...draft, desires: items })}
                className="mt-3"
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function PersonaList({
  label, color, marker, items, editing, onChange, className,
}: {
  label: string;
  color: string;
  marker: string;
  items: string[];
  editing: boolean;
  onChange: (next: string[]) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color }}>{label}</div>
      {editing ? (
        <textarea
          rows={3}
          value={items.join('\n')}
          onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
          className="w-full text-xs text-text-secondary bg-bg-elevated/40 rounded-md outline-none p-2 resize-y border border-border-subtle"
          placeholder="Uno por línea"
        />
      ) : (
        <ul className="space-y-1 text-xs text-text-secondary">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-1.5">
              <span style={{ color }}>{marker}</span> {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────── Helpers compartidos ───────── */

function SectionTitle({
  icon, title, subtitle, accent,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-[8px] flex items-center justify-center" style={{ background: withAlpha(accent, 0.15), color: accent }}>
        {icon}
      </div>
      <div>
        <h3 className="heading text-base font-bold leading-tight">{title}</h3>
        {subtitle && <div className="text-[10px] uppercase tracking-wider text-text-muted">{subtitle}</div>}
      </div>
    </div>
  );
}

function SectionTitleRow({
  icon, title, accent, action,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <SectionTitle icon={icon} title={title} accent={accent} />
      {action}
    </div>
  );
}

function Goal({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="surface p-4">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="kpi-number mt-1.5" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function EmptyState({ message, accent, action }: { message: string; accent: string; action?: React.ReactNode }) {
  return (
    <div className="surface p-10 text-center">
      <div
        className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: withAlpha(accent, 0.15), color: accent }}
      >
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="text-sm text-text-secondary mb-4">{message}</p>
      {action}
    </div>
  );
}

function formatNum(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}
