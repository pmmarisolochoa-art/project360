import { useState } from 'react';
import { ChevronDown, ChevronUp, Save } from 'lucide-react';
import type { Client, OnboardingData } from '@/types/client';
import { useClientStore } from '@/store/useClientStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/useToastStore';

/**
 * Editor de la información del cliente (Sprint E · Sección 2).
 * Muestra las 8 secciones del onboarding como bloques colapsables editables.
 * Guardar cualquier sección hace UPDATE inmediato en Supabase (vía updateClient).
 * Los cambios se reflejan en el cerebro, informes, ROPRE y fechas de embudo
 * porque todos leen de client.onboardingData / client.
 */

type SectionKey = keyof OnboardingData;

const SECTIONS: Array<{ key: SectionKey; title: string }> = [
  { key: 'identity',    title: 'Paso 1 — Información general' },
  { key: 'business',    title: 'Paso 2 — Modelo de negocio' },
  { key: 'current',     title: 'Paso 3 — Situación actual' },
  { key: 'audience',    title: 'Paso 4 — Audiencia / Buyer persona' },
  { key: 'goals',       title: 'Paso 5 — Objetivos, presupuesto y fechas' },
  { key: 'competition', title: 'Paso 6 — Competencia' },
  { key: 'content',     title: 'Paso 7 — Contenido' },
  { key: 'team',        title: 'Paso 8 — Equipo asignado' },
];

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function ClientInfoEditor({ client, onClose }: { client: Client; onClose: () => void }) {
  const [open, setOpen] = useState<SectionKey | null>('identity');

  return (
    <Modal open onClose={onClose} size="lg" title="✏️ Editar información del cliente">
      <div className="space-y-2">
        <p className="text-[11px] text-text-muted mb-2">
          Edita cualquier sección y guarda. Los cambios se reflejan en el cerebro,
          los informes y las fechas del proyecto.
        </p>
        {SECTIONS.map((s) => (
          <SectionBlock
            key={s.key}
            client={client}
            sectionKey={s.key}
            title={s.title}
            expanded={open === s.key}
            onToggle={() => setOpen(open === s.key ? null : s.key)}
          />
        ))}
      </div>
    </Modal>
  );
}

function SectionBlock({
  client, sectionKey, title, expanded, onToggle,
}: {
  client: Client;
  sectionKey: SectionKey;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const updateClient = useClientStore((s) => s.updateClient);
  const initial = (client.onboardingData[sectionKey] as Record<string, unknown>) ?? {};
  const [draft, setDraft] = useState<Record<string, unknown>>(() => structuredCloneSafe(initial));

  const entries = Object.entries(draft);
  const hasFields = entries.length > 0;

  const setField = (path: string[], value: unknown) => {
    setDraft((prev) => {
      const next = structuredCloneSafe(prev);
      let obj: Record<string, unknown> = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] as Record<string, unknown>;
      obj[path[path.length - 1]] = value;
      return next;
    });
  };

  const save = () => {
    const prevIdentity = client.onboardingData.identity;
    const merged: Partial<OnboardingData> = { ...client.onboardingData, [sectionKey]: draft };
    const patch: Partial<Client> = { onboardingData: merged };

    // Sincroniza datos top-level del Client si cambian en Identidad
    // (para que el cerebro, header e informes los reflejen).
    if (sectionKey === 'identity') {
      const id = draft as Partial<NonNullable<OnboardingData['identity']>>;
      if (id.businessName && id.businessName !== client.name) patch.name = id.businessName as string;
      if (id.industry && id.industry !== client.industry) patch.industry = id.industry as string;
      void prevIdentity;
    }

    updateClient(client.id, patch);
    toast.success('Información actualizada ✓');
  };

  return (
    <div className="rounded-[10px] border border-border-subtle bg-bg-base/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        {expanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-border-subtle p-3 space-y-2.5">
          {!hasFields && (
            <div className="text-xs text-text-muted italic">Sin datos en esta sección todavía.</div>
          )}
          {entries.map(([key, value]) => (
            <FieldRow key={key} label={humanize(key)} value={value} onChange={(v) => setField([key], v)} />
          ))}
          {hasFields && (
            <div className="flex justify-end pt-1">
              <Button size="sm" leftIcon={<Save className="h-3.5 w-3.5" />} onClick={save}>
                Guardar sección
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, onChange }: { label: string; value: unknown; onChange: (v: unknown) => void }) {
  // Escalares
  if (typeof value === 'string' || typeof value === 'number') {
    const isNum = typeof value === 'number';
    return (
      <label className="grid grid-cols-[1fr_1.4fr] gap-2 items-center">
        <span className="text-[11px] text-text-secondary">{label}</span>
        <input
          type={isNum ? 'number' : 'text'}
          defaultValue={value as string | number}
          onBlur={(e) => onChange(isNum ? Number(e.target.value) : e.target.value)}
          className="bg-bg-elevated/60 border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary outline-none"
        />
      </label>
    );
  }
  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" defaultChecked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-accent-violet" />
        <span className="text-[11px] text-text-secondary">{label}</span>
      </label>
    );
  }
  // Arrays de escalares → input separado por comas
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
    return (
      <label className="grid grid-cols-[1fr_1.4fr] gap-2 items-start">
        <span className="text-[11px] text-text-secondary">{label}</span>
        <input
          defaultValue={(value as Array<string | number>).join(', ')}
          onBlur={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          className="bg-bg-elevated/60 border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary outline-none"
          placeholder="separar con comas"
        />
      </label>
    );
  }
  // Objeto de un nivel (ej. redes sociales) → escalares anidados
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return (
      <div className="rounded-md border border-border-subtle/60 p-2">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{label}</div>
        <div className="space-y-2">
          {Object.entries(obj).map(([k, v]) => (
            <FieldRow
              key={k}
              label={humanize(k)}
              value={typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : String(v ?? '')}
              onChange={(nv) => onChange({ ...obj, [k]: nv })}
            />
          ))}
        </div>
      </div>
    );
  }
  // Fallback: no editable (estructura compleja) — solo lectura compacta.
  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-2 items-center">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <span className="text-[11px] text-text-muted truncate">{JSON.stringify(value)}</span>
    </div>
  );
}

function structuredCloneSafe<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}
