import { useState } from 'react';
import { Plus, X, Trash2, UserPlus } from 'lucide-react';
import type { Client } from '@/types/client';
import type { TeamRoleSlug } from '@/types/team';
import { ROLE_DEFS } from '@/types/team';
import type { TeamMember, CustomKpiDef, CustomKpiType, KpiMeasure } from '@/types/teamMember';
import { emptyKpis } from '@/types/teamMember';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { useTeamKPIs, type MemberKpiSummary } from '@/hooks/useTeamKPIs';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/useToastStore';
import { genId } from '@/utils/id';
import { generateAccentColor, withAlpha } from '@/utils/colorGenerator';

const ROLE_OPTIONS = ROLE_DEFS.map((r) => ({ value: r.slug, label: r.title }));
const HEALTH_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: '#10B981', yellow: '#F59E0B', red: '#EF4444',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function TeamMembersPanel({ client }: { client: Client }) {
  const add = useTeamMembersStore((s) => s.add);
  const summaries = useTeamKPIs(client.id);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = summaries.find((s) => s.member.id === selectedId) ?? null;

  return (
    <section className="surface p-5">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="heading text-base font-bold flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" /> Personas del equipo
          </h3>
          <p className="text-[11px] text-text-muted">
            Agrega a tu equipo real con nombre y rol. Cada persona tiene funciones y KPIs editables.
          </p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
          Agregar persona al equipo
        </Button>
      </header>

      {summaries.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
          Aún no hay personas asignadas. Agrega la primera para empezar a medir KPIs.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {summaries.map((s) => {
            const m = s.member;
            const roleTitle = ROLE_DEFS.find((r) => r.slug === m.rol)?.title ?? m.rol;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 text-center hover:bg-bg-elevated transition"
              >
                <div className="relative mx-auto h-11 w-11 mb-2">
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: `linear-gradient(135deg, ${m.avatarColor}, ${withAlpha(m.avatarColor, 0.6)})` }}
                  >
                    {initials(m.nombre)}
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-surface"
                    style={{ background: HEALTH_COLOR[s.health], boxShadow: `0 0 8px ${HEALTH_COLOR[s.health]}` }}
                  />
                </div>
                <div className="text-xs font-semibold text-text-primary truncate">{m.nombre}</div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted truncate">{roleTitle}</div>
                <div className="text-[10px] mt-1" style={{ color: HEALTH_COLOR[s.health] }}>
                  {s.score}% KPIs ✓
                </div>
              </button>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AddMemberModal
          client={client}
          onClose={() => setAddOpen(false)}
          onCreate={(member) => {
            add(member);
            toast.success(`${member.nombre} agregada al equipo ✓`);
            setAddOpen(false);
          }}
        />
      )}

      {selected && (
        <MemberDetailModal summary={selected} onClose={() => setSelectedId(null)} />
      )}
    </section>
  );
}

/* ───────────────────────── Modal: agregar persona ───────────────────────── */

function AddMemberModal({
  client, onClose, onCreate,
}: {
  client: Client;
  onClose: () => void;
  onCreate: (m: TeamMember) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<TeamRoleSlug>('project_manager');
  const [email, setEmail] = useState('');

  const submit = () => {
    if (!nombre.trim()) { toast.error('Escribe el nombre de la persona'); return; }
    const roleDef = ROLE_DEFS.find((r) => r.slug === rol);
    const member: TeamMember = {
      id: genId(),
      clientId: client.id,
      nombre: nombre.trim(),
      rol,
      email: email.trim() || undefined,
      avatarColor: generateAccentColor(nombre.trim()),
      funciones: [...(roleDef?.functions ?? [])],
      kpis: emptyKpis(),
      createdAt: new Date().toISOString(),
    };
    onCreate(member);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Agregar persona al equipo"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" leftIcon={<UserPlus className="h-3.5 w-3.5" />} onClick={submit}>Agregar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Laura Gómez" autoFocus />
        <Select
          label="Rol"
          value={rol}
          options={ROLE_OPTIONS}
          onChange={(e) => setRol(e.target.value as TeamRoleSlug)}
        />
        <Input label="Email (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="laura@agencia.com" />
        <div className="flex items-center gap-2 pt-1">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs"
            style={{ background: generateAccentColor(nombre || 'NN') }}
          >
            {initials(nombre || 'NN')}
          </div>
          <span className="text-[11px] text-text-muted">El avatar se genera con las iniciales y un color por nombre.</span>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Modal: detalle de la persona ───────────────────────── */

function MemberDetailModal({ summary, onClose }: { summary: MemberKpiSummary; onClose: () => void }) {
  const update = useTeamMembersStore((s) => s.update);
  const remove = useTeamMembersStore((s) => s.remove);
  const member = summary.member;
  const roleTitle = ROLE_DEFS.find((r) => r.slug === member.rol)?.title ?? member.rol;
  const [newFn, setNewFn] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

  const live = () => useTeamMembersStore.getState().members.find((m) => m.id === member.id) ?? member;

  const addFunction = () => {
    const text = newFn.trim();
    if (!text) return;
    update(member.id, { funciones: [...live().funciones, text] });
    setNewFn('');
  };
  const removeFunction = (idx: number) => {
    update(member.id, { funciones: live().funciones.filter((_, i) => i !== idx) });
  };
  const setKpiValue = (key: string, val: string) => {
    const m = live();
    const prev = m.kpis.values[key];
    if (prev === val) return;
    const history = { ...(m.kpis.history ?? {}) };
    if (prev) history[key] = [prev, ...(history[key] ?? [])].slice(0, 4);
    update(member.id, { kpis: { ...m.kpis, values: { ...m.kpis.values, [key]: val }, history } });
  };
  const addCustomKpi = (def: CustomKpiDef) => {
    update(member.id, { kpis: { ...live().kpis, custom: [...live().kpis.custom, def] } });
    setCustomOpen(false);
    toast.success('KPI personalizado agregado');
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <span
            className="h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-[11px]"
            style={{ background: member.avatarColor }}
          >
            {initials(member.nombre)}
          </span>
          {member.nombre} · <span className="text-text-muted font-normal">{roleTitle}</span>
        </span>
      }
    >
      <div className="space-y-5">
        {/* Nombre + email — para asignar la persona real al rol */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Nombre</label>
            <input
              defaultValue={member.nombre}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== member.nombre) update(member.id, { nombre: v }); }}
              placeholder="Asignar persona…"
              className="w-full bg-bg-elevated/60 border border-border-subtle rounded-md px-2.5 py-1.5 text-sm text-text-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Email (opcional)</label>
            <input
              defaultValue={member.email ?? ''}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== (member.email ?? '')) update(member.id, { email: v || undefined }); }}
              placeholder="persona@agencia.com"
              className="w-full bg-bg-elevated/60 border border-border-subtle rounded-md px-2.5 py-1.5 text-sm text-text-primary outline-none"
            />
          </div>
        </div>

        {/* Funciones */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Funciones del rol</div>
          <div className="flex flex-wrap gap-1.5">
            {live().funciones.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-base/40 pl-2.5 pr-1 py-1 text-[11px] text-text-secondary">
                {f}
                <button onClick={() => removeFunction(i)} className="h-4 w-4 rounded-full hover:bg-status-danger/15 hover:text-status-danger inline-flex items-center justify-center">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              value={newFn}
              onChange={(e) => setNewFn(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFunction()}
              placeholder="+ Agregar función"
              className="flex-1 bg-bg-elevated/60 border border-border-subtle rounded-md px-2.5 py-1.5 text-xs text-text-primary outline-none"
            />
            <Button size="sm" variant="ghost" onClick={addFunction}>Agregar</Button>
          </div>
        </div>

        {/* KPIs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">KPIs del rol</div>
            <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3 w-3" />} onClick={() => setCustomOpen(true)}>
              KPI personalizado
            </Button>
          </div>
          <div className="space-y-1.5">
            {summary.rows.map((row) => (
              <div key={row.key} className="grid grid-cols-[1.4fr_auto_auto] gap-2 items-center rounded-[8px] border border-border-subtle bg-bg-base/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs text-text-primary truncate flex items-center gap-1.5">
                    {row.label}
                    {row.custom && <span className="text-[9px] uppercase text-text-muted">custom</span>}
                    {row.measure === 'auto' && <span className="text-[9px] uppercase text-accent-violet">auto</span>}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {row.target != null ? `Meta: ${row.target}${row.unit ?? ''}` : 'Sin meta numérica'}
                  </div>
                </div>
                {row.textValue !== undefined ? (
                  <input
                    defaultValue={row.textValue}
                    onBlur={(e) => setKpiValue(row.key, e.target.value)}
                    placeholder="—"
                    className="w-40 bg-bg-elevated/60 border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary outline-none"
                  />
                ) : row.measure === 'auto' ? (
                  <div className="text-sm font-semibold text-text-primary text-right w-20">
                    {row.value != null ? `${row.value}${row.unit ?? ''}` : '—'}
                  </div>
                ) : (
                  <input
                    type="number"
                    defaultValue={row.value ?? ''}
                    onBlur={(e) => setKpiValue(row.key, e.target.value)}
                    placeholder="—"
                    className="w-20 bg-bg-elevated/60 border border-border-subtle rounded-md px-2 py-1 text-sm text-right text-text-primary outline-none"
                  />
                )}
                <span
                  className="h-2.5 w-2.5 rounded-full justify-self-end"
                  style={{ background: row.health ? HEALTH_COLOR[row.health] : '#4B5563' }}
                  title={row.health ?? 'sin dato'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          <button
            onClick={() => {
              remove(member.id);
              toast.success('Persona eliminada del equipo');
              onClose();
            }}
            className="inline-flex items-center gap-1 text-xs text-status-danger hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" /> Quitar del equipo
          </button>
          <Button size="sm" onClick={onClose}>Listo</Button>
        </div>
      </div>

      {customOpen && <CustomKpiForm onClose={() => setCustomOpen(false)} onAdd={addCustomKpi} />}
    </Modal>
  );
}

function CustomKpiForm({ onClose, onAdd }: { onClose: () => void; onAdd: (def: CustomKpiDef) => void }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomKpiType>('percent');
  const [target, setTarget] = useState('');
  const [measure, setMeasure] = useState<KpiMeasure>('manual');

  const submit = () => {
    if (!label.trim()) { toast.error('Escribe el nombre del KPI'); return; }
    onAdd({
      key: `custom_${genId().slice(0, 6)}`,
      label: label.trim(),
      type,
      target: target.trim(),
      measure,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="KPI personalizado"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit}>Agregar KPI</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Nombre del KPI" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Leads captados" autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Tipo"
            value={type}
            options={[{ value: 'percent', label: 'Porcentaje' }, { value: 'number', label: 'Número' }, { value: 'text', label: 'Texto' }]}
            onChange={(e) => setType(e.target.value as CustomKpiType)}
          />
          <Select
            label="Cómo se mide"
            value={measure}
            options={[{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Automático (tareas)' }]}
            onChange={(e) => setMeasure(e.target.value as KpiMeasure)}
          />
        </div>
        {type !== 'text' && (
          <Input label="Meta" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Ej. 500" />
        )}
      </div>
    </Modal>
  );
}
