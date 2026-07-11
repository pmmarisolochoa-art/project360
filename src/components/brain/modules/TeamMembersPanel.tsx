import { useMemo, useState } from 'react';
import { Plus, X, Trash2, UserPlus, AlertTriangle, Pencil, KeyRound, Copy, Check } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip as RTooltip } from 'recharts';
import type { Client } from '@/types/client';
import type { TeamRoleSlug } from '@/types/team';
import { ROLE_DEFS } from '@/types/team';
import type { TeamMember, CustomKpiDef, CustomKpiType, KpiMeasure } from '@/types/teamMember';
import { emptyKpis } from '@/types/teamMember';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { useClientStore } from '@/store/useClientStore';
import { DEPARTMENTS, type DepartmentId } from '@/config/departments';
import { inviteMember } from '@/services/inviteMember';
import { useTeamKPIs, type MemberKpiSummary } from '@/hooks/useTeamKPIs';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/useToastStore';
import { genId } from '@/utils/id';
import { resolveRoleLabel } from '@/utils/roleResolver';
import { generateAccentColor, withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';

const ROLE_OPTIONS = ROLE_DEFS.map((r) => ({ value: r.slug, label: r.title }));
const HEALTH_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: '#10B981', yellow: '#F59E0B', red: '#EF4444',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const BAR_COLORS = ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#14B8A6', '#A855F7'];

export function TeamMembersPanel({ client, readOnly = false }: { client: Client; readOnly?: boolean }) {
  const accent = client.primaryColor;
  const add = useTeamMembersStore((s) => s.add);
  const addLocal = useTeamMembersStore((s) => s.addLocal);
  const summaries = useTeamKPIs(client.id);
  const allTasks = useClientStore((s) => s.tasks);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = summaries.find((s) => s.member.id === selectedId) ?? null;

  // Salud del equipo — todo calculado de datos reales (tareas + KPIs).
  const health = useMemo(() => {
    const tasks = allTasks.filter((t) => t.clientId === client.id);
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'completed').length;
    const globalPct = total === 0 ? 0 : Math.round((done / total) * 100);
    const blocked = tasks.filter((t) => t.status !== 'completed' && (t.status === 'blocked' || t.isDelayed));

    const perMember = summaries.map((s) => {
      const mine = tasks.filter((t) => t.assignedTo === s.member.nombre || t.assignedTo === s.member.rol);
      const md = mine.filter((t) => t.status === 'completed').length;
      const active = mine.filter((t) => t.status !== 'completed').length;
      const rate = mine.length ? Math.round((md / mine.length) * 100) : null;
      const roleTitle = ROLE_DEFS.find((r) => r.slug === s.member.rol)?.title ?? s.member.rol;
      return { s, roleTitle, total: mine.length, active, rate };
    });
    const carga = [...perMember].filter((p) => p.active > 0).sort((a, b) => b.active - a.active)[0] ?? null;
    const peor = [...perMember].filter((p) => p.total >= 2 && p.rate != null).sort((a, b) => (a.rate! - b.rate!))[0] ?? null;
    const cuellos = blocked.slice(0, 5).map((t) => ({
      title: t.title,
      role: resolveRoleLabel(t.assignedTo, client.id) ?? t.assignedTo,
      overdue: t.isDelayed,
    }));
    const chart = perMember.filter((p) => p.total > 0).map((p) => ({ name: p.roleTitle, pct: p.rate ?? 0 }));
    return { globalPct, blockedN: blocked.length, carga, peor, cuellos, chart };
  }, [allTasks, summaries, client.id]);

  return (
    <section className="surface p-5">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="heading text-base font-bold flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" /> Salud del equipo · {client.name}
          </h3>
          <p className="text-[11px] text-text-muted">
            {summaries.length} roles · semáforo según KPIs. Clic en un rol para asignar la persona y editar funciones/KPIs.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Cumplimiento global</div>
            <div className="kpi-number" style={{ color: accent }}>{health.globalPct}%</div>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                Agregar persona
              </Button>
              <Button leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
                Invitar miembro
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Mini-stats reales */}
      {(health.carga || health.peor || health.blockedN > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          {health.carga && (
            <div className="rounded-md border border-border-subtle bg-bg-base/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Mayor carga activa</div>
              <div className="text-xs text-text-primary mt-0.5"><strong>{health.carga.s.member.nombre}</strong> · {health.carga.active} tarea{health.carga.active === 1 ? '' : 's'}</div>
            </div>
          )}
          {health.peor && (
            <div className="rounded-md border border-status-danger/30 bg-status-danger/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-status-danger">Peor cumplimiento</div>
              <div className="text-xs text-text-primary mt-0.5"><strong>{health.peor.s.member.nombre}</strong> · {health.peor.rate}% completado</div>
            </div>
          )}
          {health.blockedN > 0 && (
            <div className="rounded-md border border-status-warning/30 bg-status-warning/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-status-warning">Bloqueos activos</div>
              <div className="text-xs text-text-primary mt-0.5"><strong>{health.blockedN}</strong> tarea{health.blockedN === 1 ? '' : 's'} bloqueada{health.blockedN === 1 ? '' : 's'} o vencida{health.blockedN === 1 ? '' : 's'}</div>
            </div>
          )}
        </div>
      )}

      {summaries.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
          Aún no hay roles asignados. Agrega el primero para empezar a medir KPIs.
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
                {s.taskKpis.length > 0 && (
                  <div className="text-[10px] mt-0.5 text-text-muted">
                    🎯 {s.taskKpis.filter((t) => t.health === 'green').length}/{s.taskKpis.length} resultados
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Cuellos de botella + gráfica de cumplimiento por rol */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-subtle">
          <div>
            <header className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Cuellos de botella</h4>
            </header>
            {health.cuellos.length === 0 ? (
              <div className="text-xs text-text-muted italic py-4 text-center">Sin tareas bloqueadas ni vencidas. 🎉</div>
            ) : (
              <ul className="space-y-1.5">
                {health.cuellos.map((c, i) => (
                  <li key={i} className="rounded-md border border-status-warning/30 bg-status-warning/5 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-status-warning mb-0.5">
                      {c.role}{c.overdue ? ' · vencida' : ' · bloqueada'}
                    </div>
                    <div className="text-xs text-text-primary leading-snug line-clamp-2">{c.title}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2">Cumplimiento por rol</h4>
            {health.chart.length === 0 ? (
              <div className="text-xs text-text-muted italic py-4 text-center">Sin tareas asignadas por rol todavía.</div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={health.chart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#6B6B80" fontSize={9} interval={0} angle={-15} textAnchor="end" height={40} />
                    <YAxis stroke="#6B6B80" fontSize={10} domain={[0, 100]} />
                    <RTooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 10, fontSize: 12 }} />
                    <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                      {health.chart.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
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

      {inviteOpen && (
        <InviteMemberModal
          client={client}
          onClose={() => setInviteOpen(false)}
          onInvited={(member) => {
            addLocal(member);
            setInviteOpen(false);
          }}
        />
      )}

      {selected && (
        <MemberDetailModal summary={selected} onClose={() => setSelectedId(null)} readOnly={readOnly} />
      )}
    </section>
  );
}

/* ───────────────────────── Modal: invitar miembro (login + acceso) ───────────────────────── */

function genTempPassword(): string {
  // Contraseña temporal legible: 3 sílabas + 3 dígitos (fácil de dictar).
  const syl = ['ka', 'lo', 'mi', 'ru', 'sa', 'te', 'vo', 'zi', 'ne', 'pa', 'du', 'fe'];
  let base = '';
  for (let i = 0; i < 3; i++) base += syl[Math.floor(Math.random() * syl.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return base.charAt(0).toUpperCase() + base.slice(1) + num + '!';
}

const DEPT_HINT: Record<DepartmentId, string> = {
  pm: 'Perfil, Tareas, ROPRE, Agenda, Programas, Equipo',
  finanzas: 'Planeación, Proyección, Métricas',
  content: 'Contenido, Perfil, Tareas, Equipo',
};

function InviteMemberModal({
  client, onClose, onInvited,
}: {
  client: Client;
  onClose: () => void;
  onInvited: (m: TeamMember) => void;
}) {
  const accent = client.primaryColor;
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState<TeamRoleSlug>('project_manager');
  const [accessLevel, setAccessLevel] = useState<'editor' | 'viewer'>('editor');
  const [departamentos, setDepartamentos] = useState<DepartmentId[]>(['pm']);
  const [password, setPassword] = useState(genTempPassword());
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleDept = (id: DepartmentId) => {
    setDepartamentos((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const copyPass = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const submit = async () => {
    if (!nombre.trim()) { toast.error('Escribe el nombre de la persona'); return; }
    if (!email.trim()) { toast.error('Escribe el correo de acceso'); return; }
    if (departamentos.length === 0) { toast.error('Elige al menos un departamento'); return; }
    if (password.length < 8) { toast.error('La contraseña temporal debe tener al menos 8 caracteres'); return; }

    setSaving(true);
    try {
      const roleDef = ROLE_DEFS.find((r) => r.slug === rol);
      const avatarColor = generateAccentColor(nombre.trim());
      const funciones = [...(roleDef?.functions ?? [])];
      const result = await inviteMember({
        clientId: client.id,
        email: email.trim(),
        nombre: nombre.trim(),
        rol,
        telefono: telefono.trim() || undefined,
        accessLevel,
        departamentos,
        password,
        avatarColor,
        funciones,
      });

      const member: TeamMember = {
        id: result.memberId,
        clientId: client.id,
        nombre: nombre.trim(),
        rol,
        email: email.trim(),
        telefono: telefono.trim() || undefined,
        avatarColor,
        funciones,
        kpis: emptyKpis(),
        createdAt: new Date().toISOString(),
      };
      toast.success(`${member.nombre} ya puede entrar. Comparte su correo y contraseña temporal.`);
      onInvited(member);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo invitar al miembro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Invitar miembro"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" leftIcon={<KeyRound className="h-3.5 w-3.5" />} onClick={submit} disabled={saving}>
            {saving ? 'Creando acceso…' : 'Crear acceso'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[11px] text-text-muted">
          Crea el login de la persona y define qué puede ver. Le compartes su correo y la contraseña temporal;
          él la cambia al entrar.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Laura Gómez" autoFocus />
          <Input label="Correo de acceso" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="laura@agencia.com" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="WhatsApp (opcional)"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+57 300 123 4567"
          />
          <div />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Rol" value={rol} options={ROLE_OPTIONS} onChange={(e) => setRol(e.target.value as TeamRoleSlug)} />
          <Select
            label="Puede editar"
            value={accessLevel}
            options={[{ value: 'editor', label: 'Editor — ejecuta y edita' }, { value: 'viewer', label: 'Viewer — solo lectura' }]}
            onChange={(e) => setAccessLevel(e.target.value as 'editor' | 'viewer')}
          />
        </div>

        {/* Departamentos = qué módulos ve */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
            Accesos permitidos (departamentos)
          </label>
          <div className="space-y-1.5">
            {DEPARTMENTS.map((d) => {
              const on = departamentos.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDept(d.id)}
                  className={cn(
                    'w-full flex items-start gap-2.5 rounded-[8px] border px-3 py-2 text-left transition',
                    on ? 'border-transparent bg-bg-elevated' : 'border-border-subtle bg-bg-base/30 hover:bg-bg-elevated/60',
                  )}
                  style={on ? { boxShadow: `inset 0 0 0 1.5px ${accent}` } : undefined}
                >
                  <span
                    className="mt-0.5 h-4 w-4 rounded flex items-center justify-center shrink-0"
                    style={{ background: on ? accent : 'transparent', border: on ? 'none' : '1.5px solid var(--border-default)' }}
                  >
                    {on && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="min-w-0">
                    <span className="text-xs font-semibold text-text-primary">{d.label}</span>
                    <span className="block text-[10px] text-text-muted truncate">{DEPT_HINT[d.id]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contraseña temporal */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Contraseña temporal</label>
          <div className="flex items-center gap-2">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-bg-elevated/60 border border-border-subtle rounded-md px-2.5 py-1.5 text-sm font-mono text-text-primary outline-none"
            />
            <Button variant="ghost" size="sm" onClick={copyPass} leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}>
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPassword(genTempPassword())}>Otra</Button>
          </div>
          <p className="text-[10px] text-text-muted mt-1">Cópiala antes de crear el acceso — se la pasas por WhatsApp.</p>
        </div>
      </div>
    </Modal>
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

function MemberDetailModal({ summary, onClose, readOnly = false }: { summary: MemberKpiSummary; onClose: () => void; readOnly?: boolean }) {
  const update = useTeamMembersStore((s) => s.update);
  const remove = useTeamMembersStore((s) => s.remove);
  const member = summary.member;
  const roleTitle = ROLE_DEFS.find((r) => r.slug === member.rol)?.title ?? member.rol;
  const [newFn, setNewFn] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);

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
  const setKpiTarget = (key: string, val: string) => {
    const m = live();
    const targets = { ...(m.kpis.targets ?? {}) };
    const clean = val.trim();
    if (clean === '') delete targets[key];
    else targets[key] = clean;
    update(member.id, { kpis: { ...m.kpis, targets } });
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
              onBlur={(e) => { if (readOnly) return; const v = e.target.value.trim(); if (v && v !== member.nombre) update(member.id, { nombre: v }); }}
              disabled={readOnly}
              placeholder="Asignar persona…"
              className="w-full bg-bg-elevated/60 border border-border-subtle rounded-md px-2.5 py-1.5 text-sm text-text-primary outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">Email (opcional)</label>
            <input
              defaultValue={member.email ?? ''}
              onBlur={(e) => { if (readOnly) return; const v = e.target.value.trim(); if (v !== (member.email ?? '')) update(member.id, { email: v || undefined }); }}
              disabled={readOnly}
              placeholder="persona@agencia.com"
              className="w-full bg-bg-elevated/60 border border-border-subtle rounded-md px-2.5 py-1.5 text-sm text-text-primary outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* WhatsApp — para recordatorios y post-reunión vía GHL */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">WhatsApp (opcional)</label>
          <input
            defaultValue={member.telefono ?? ''}
            onBlur={(e) => { if (readOnly) return; const v = e.target.value.trim(); if (v !== (member.telefono ?? '')) update(member.id, { telefono: v || undefined }); }}
            disabled={readOnly}
            placeholder="+57 300 123 4567"
            className="w-full bg-bg-elevated/60 border border-border-subtle rounded-md px-2.5 py-1.5 text-sm text-text-primary outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <p className="text-[10px] text-text-muted mt-1">En formato internacional (con +57). Se usa para los recordatorios y tareas por WhatsApp.</p>
        </div>

        {/* Funciones */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Funciones del rol</div>
          <div className="flex flex-wrap gap-1.5">
            {live().funciones.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-base/40 pl-2.5 pr-1 py-1 text-[11px] text-text-secondary">
                {f}
                {!readOnly && (
                  <button onClick={() => removeFunction(i)} className="h-4 w-4 rounded-full hover:bg-status-danger/15 hover:text-status-danger inline-flex items-center justify-center">
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
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
          )}
        </div>

        {/* KPIs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">KPIs del rol</div>
            {!readOnly && (
              <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3 w-3" />} onClick={() => setCustomOpen(true)}>
                KPI personalizado
              </Button>
            )}
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
                  <div className="text-[10px] text-text-muted flex items-center gap-1">
                    {editTarget === row.key && !readOnly ? (
                      <input
                        type="number"
                        defaultValue={row.target ?? ''}
                        autoFocus
                        onBlur={(e) => { setKpiTarget(row.key, e.target.value); setEditTarget(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
                        className="w-16 bg-bg-elevated/60 border border-border-subtle rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none"
                      />
                    ) : (
                      <>
                        <span>{row.target != null ? `Meta: ${row.target}${row.unit ?? ''}` : 'Sin meta numérica'}</span>
                        {!readOnly && !row.custom && row.target != null && (
                          <button
                            onClick={() => setEditTarget(row.key)}
                            className="text-text-muted hover:text-accent-violet"
                            title="Editar meta para este cliente"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        )}
                        {row.targetOverridden && <span className="text-[8px] uppercase tracking-wide text-accent-violet">editada</span>}
                      </>
                    )}
                  </div>
                </div>
                {row.textValue !== undefined ? (
                  <input
                    defaultValue={row.textValue}
                    onBlur={(e) => { if (!readOnly) setKpiValue(row.key, e.target.value); }}
                    disabled={readOnly}
                    placeholder="—"
                    className="w-40 bg-bg-elevated/60 border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                ) : row.measure === 'auto' ? (
                  <div className="text-sm font-semibold text-text-primary text-right w-20">
                    {row.value != null ? `${row.value}${row.unit ?? ''}` : '—'}
                  </div>
                ) : (
                  <input
                    type="number"
                    defaultValue={row.value ?? ''}
                    onBlur={(e) => { if (!readOnly) setKpiValue(row.key, e.target.value); }}
                    disabled={readOnly}
                    placeholder="—"
                    className="w-20 bg-bg-elevated/60 border border-border-subtle rounded-md px-2 py-1 text-sm text-right text-text-primary outline-none disabled:opacity-60 disabled:cursor-not-allowed"
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

        {/* Resultados de tareas — KPIs capturados al completar tareas de la persona */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Resultados de tareas
            <span className="ml-1 normal-case tracking-normal text-text-muted/70">· se llenan al completar tareas con KPI</span>
          </div>
          {summary.taskKpis.length === 0 ? (
            <div className="text-xs text-text-muted italic rounded-[8px] border border-border-subtle bg-bg-base/30 px-3 py-2.5">
              Aún sin resultados. Cuando esta persona complete una tarea que tenga KPI de resultado, aparecerá aquí.
            </div>
          ) : (
            <div className="space-y-1.5">
              {summary.taskKpis.map((tk, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center rounded-[8px] border border-border-subtle bg-bg-base/30 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs text-text-primary truncate">{tk.nombre}</div>
                    <div className="text-[10px] text-text-muted truncate">{tk.taskTitle}</div>
                  </div>
                  <div className="text-sm font-semibold text-text-primary text-right whitespace-nowrap">
                    {tk.resultado}
                    {tk.meta && <span className="text-[10px] text-text-muted font-normal"> / {tk.meta}</span>}
                  </div>
                  <span
                    className="h-2.5 w-2.5 rounded-full justify-self-end"
                    style={{ background: tk.health ? HEALTH_COLOR[tk.health] : '#4B5563' }}
                    title={tk.health ?? 'sin dato'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          {!readOnly ? (
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
          ) : <span />}
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
