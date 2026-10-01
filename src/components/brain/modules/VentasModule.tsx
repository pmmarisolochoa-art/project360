import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Upload, Search } from 'lucide-react';
import { ImportarLeadsCSVModal } from './ImportarLeadsCSVModal';
import type { Client } from '@/types/client';
import type { Lead, LeadStage, LeadSource } from '@/types/lead';
import { LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_SOURCES, LEAD_SOURCE_LABELS } from '@/types/lead';
import { useLeadsStore } from '@/store/useLeadsStore';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useClientMode } from '@/hooks/useClientMode';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/useToastStore';
import { cn } from '@/utils/cn';
import { withAlpha } from '@/utils/colorGenerator';

const SOURCE_TONE: Record<LeadSource, 'info' | 'success' | 'warning' | 'neutral'> = {
  meta_ads: 'info', reel: 'success', story: 'success', carrusel: 'success', perfil: 'warning', referido: 'warning', otro: 'neutral',
};

/**
 * Color del punto de "banda" en la tarjeta — banda es texto libre por cliente
 * (migración 050), así que solo se reconocen los nombres más comunes de un
 * semáforo de calificación; cualquier otro valor cae al gris neutro.
 */
const BANDA_COLOR: Record<string, string> = {
  verde: '#0CA30C', amarillo: '#D08A00', rojo: '#D03B3B', 'rojo-aviso': '#D03B3B', eliminado: '#D03B3B', parcial: '#8A8F98',
};
function normalizarBanda(b: string): string {
  return b.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

type Period = 'hoy' | '7d' | '15d' | '30d' | '60d' | 'rango';
const PERIOD_LABELS: Record<Period, string> = {
  hoy: 'Hoy', '7d': '7 días', '15d': '15 días', '30d': '30 días', '60d': '60 días', rango: 'Rango',
};

function periodStart(period: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'hoy') return d;
  const days = period === '7d' ? 7 : period === '15d' ? 15 : period === '30d' ? 30 : 60;
  d.setDate(d.getDate() - days);
  return d;
}

export function VentasModule({ client, readOnly = false }: { client: Client; readOnly?: boolean }) {
  const allLeads = useLeadsStore((s) => s.leads);
  const leads = useMemo(() => allLeads.filter((l) => l.clientId === client.id), [allLeads, client.id]);
  const addLead = useLeadsStore((s) => s.add);
  const updateLead = useLeadsStore((s) => s.update);
  const moveStage = useLeadsStore((s) => s.moveStage);
  const { isMember } = useClientMode(client.id);
  const authUser = useAuthStore((s) => s.user);
  const clientAccess = useAuthStore((s) => s.clientAccess);
  const actor = { nombre: (isMember ? clientAccess?.nombre : undefined) ?? authUser?.email ?? 'Equipo' };
  const allMembers = useTeamMembersStore((s) => s.members);
  const members = useMemo(() => allMembers.filter((m) => m.clientId === client.id), [allMembers, client.id]);
  const setters = useMemo(() => members.filter((m) => m.rol === 'setter'), [members]);
  const closers = useMemo(() => members.filter((m) => m.rol === 'closer'), [members]);

  const [tab, setTab] = useState<'pipeline' | 'kpis'>('pipeline');
  const [busqueda, setBusqueda] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  /** Lead a punto de marcarse "Perdido" — pide el motivo antes de confirmar el movimiento. */
  const [lostPending, setLostPending] = useState<Lead | null>(null);

  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const accent = client.primaryColor;

  // Búsqueda del Pipeline — filtra las tarjetas del Kanban sin tocar los
  // KPIs/gráficas, que siguen sobre el universo completo del período.
  const termino = busqueda.trim().toLowerCase();
  const leadsKanban = useMemo(() => {
    if (!termino) return leads;
    return leads.filter((l) =>
      [l.nombre, l.telefono, l.email, l.perfilRol].some((v) => v?.toLowerCase().includes(termino)),
    );
  }, [leads, termino]);

  // El Pipeline (Kanban) siempre muestra el estado VIVO — el filtro de período
  // solo acota qué leads entran a los KPIs y las gráficas, no esconde tarjetas.
  const leadsPeriodo = useMemo(() => {
    if (period === 'rango') {
      if (!rangeStart && !rangeEnd) return leads;
      const start = rangeStart ? new Date(rangeStart) : null;
      const end = rangeEnd ? new Date(rangeEnd + 'T23:59:59') : null;
      return leads.filter((l) => {
        const t = new Date(l.createdAt);
        return (!start || t >= start) && (!end || t <= end);
      });
    }
    const start = periodStart(period);
    return leads.filter((l) => new Date(l.createdAt) >= start);
  }, [leads, period, rangeStart, rangeEnd]);

  // ── Dashboard: embudo por etapa, leads por fuente (sobre el período) ──
  const porEtapa = LEAD_STAGES.map((etapa) => ({ etapa, n: leadsPeriodo.filter((l) => l.etapa === etapa).length }));
  const maxEtapa = Math.max(1, ...porEtapa.map((p) => p.n));
  const porFuente = LEAD_SOURCES
    .map((fuente) => ({ fuente, n: leadsPeriodo.filter((l) => l.fuente === fuente).length }))
    .filter((f) => f.n > 0);
  const totalFuente = porFuente.reduce((s, f) => s + f.n, 0) || 1;
  const ganados = leadsPeriodo.filter((l) => l.etapa === 'ganado');
  const valorContratado = ganados.reduce((s, l) => s + (l.programValue ?? 0), 0);
  const cashCollected = ganados.reduce((s, l) => s + (l.cashCollected ?? 0), 0);
  const pendienteCobro = Math.max(0, valorContratado - cashCollected);

  function handleDrop(stage: LeadStage) {
    if (readOnly || !draggedId) return;
    const lead = leads.find((l) => l.id === draggedId);
    setDraggedId(null);
    setDragOverStage(null);
    if (!lead || lead.etapa === stage) return;
    if (stage === 'perdido') {
      // El motivo se pide ANTES de mover — un lead perdido sin motivo no le
      // sirve a nadie que revise el embudo después.
      setLostPending(lead);
      return;
    }
    moveStage(lead, stage, actor);
    toast.success(`Movido a ${LEAD_STAGE_LABELS[stage]}`);
  }

  return (
    <div className="space-y-6">
      {/* Tabs internos + filtro de período */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-[10px] border border-border-default bg-bg-surface p-1">
          {(['pipeline', 'kpis'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-[12px] font-semibold rounded-[7px] px-3.5 py-1.5 transition-colors"
              style={tab === t ? { background: withAlpha(accent, 0.16), color: accent } : { color: 'var(--text-secondary)' }}
            >
              {t === 'pipeline' ? 'Pipeline' : 'KPIs'}
            </button>
          ))}
        </div>
        <PeriodFilter period={period} setPeriod={setPeriod} rangeStart={rangeStart} rangeEnd={rangeEnd} setRangeStart={setRangeStart} setRangeEnd={setRangeEnd} accent={accent} />
      </div>

      {/* KPIs generales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label={`Leads (${PERIOD_LABELS[period]})`} value={String(leadsPeriodo.length)} />
        <KpiTile label="Valor contratado" value={`$${valorContratado.toLocaleString('es-CO')}`} />
        <KpiTile label="Cash collected" value={`$${cashCollected.toLocaleString('es-CO')}`} tone="good" />
        <KpiTile label="Pendiente de cobro" value={`$${pendienteCobro.toLocaleString('es-CO')}`} tone={pendienteCobro > 0 ? 'warn' : undefined} />
      </div>

      {tab === 'pipeline' ? (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-text-primary">Pipeline</h3>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar lead por nombre, teléfono, email…"
                  className="w-[240px] rounded-[8px] border border-border-default bg-bg-base pl-8 pr-2.5 py-1.5 text-[12px] focus-ring"
                />
              </div>
              {termino && (
                <span className="text-[11px] text-text-muted">
                  {leadsKanban.length} de {leads.length}
                </span>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-[8px] px-3 py-1.5 focus-ring text-text-secondary hover:bg-bg-hover border border-border-default"
                >
                  <Upload className="h-3.5 w-3.5" /> Importar
                </button>
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-[8px] px-3 py-1.5 focus-ring"
                  style={{ background: withAlpha(accent, 0.16), color: accent }}
                >
                  <Plus className="h-3.5 w-3.5" /> Nuevo lead
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2.5 min-w-max">
              {LEAD_STAGES.map((stage) => {
                const stageLeads = leadsKanban.filter((l) => l.etapa === stage);
                const isDropTarget = dragOverStage === stage;
                return (
                  <div
                    key={stage}
                    className="w-[220px] flex-none rounded-[12px] p-2.5 min-h-[320px] border transition-colors"
                    style={{
                      background: 'var(--kanban-column-bg)',
                      borderColor: isDropTarget ? accent : 'var(--border-subtle)',
                      boxShadow: isDropTarget ? `inset 0 0 0 1px ${accent}` : undefined,
                    }}
                    onDragOver={(e) => {
                      if (readOnly || !draggedId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverStage !== stage) setDragOverStage(stage);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dragOverStage === stage) setDragOverStage(null);
                    }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(stage); }}
                  >
                    <header className="flex items-center justify-between mb-2 px-0.5">
                      <span className="text-[11px] font-semibold text-text-secondary">{LEAD_STAGE_LABELS[stage]}</span>
                      <span className="text-[10px] font-mono text-text-muted">{stageLeads.length}</span>
                    </header>
                    <div className="space-y-1.5">
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable={!readOnly}
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', lead.id); e.dataTransfer.effectAllowed = 'move'; setDraggedId(lead.id); }}
                          onDragEnd={() => { setDraggedId(null); setDragOverStage(null); }}
                          onClick={() => setSelectedId(lead.id)}
                          className={cn(
                            'rounded-[10px] border p-2.5 cursor-pointer transition-colors bg-bg-surface',
                            draggedId === lead.id ? 'opacity-50' : 'hover:border-border-strong',
                          )}
                          style={{ borderColor: 'var(--border-default)' }}
                        >
                          <div className="flex items-center gap-1.5">
                            {lead.banda && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: BANDA_COLOR[normalizarBanda(lead.banda)] ?? '#8A8F98' }} title={lead.banda} />}
                            <div className="text-[12px] font-semibold text-text-primary truncate">{lead.nombre}</div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge tone={SOURCE_TONE[lead.fuente]} className="text-[8.5px] px-1.5 py-0">{LEAD_SOURCE_LABELS[lead.fuente]}</Badge>
                            {lead.score !== undefined && <span className="text-[9.5px] font-mono text-text-muted">{lead.score}</span>}
                          </div>
                          {stage === 'ganado' && (
                            <div className="text-[10px] text-text-muted mt-1.5 font-mono">
                              {lead.programValue ? `$${lead.programValue.toLocaleString('es-CO')}` : '—'}
                              {lead.cashCollected ? ` · cobrado $${lead.cashCollected.toLocaleString('es-CO')}` : ''}
                            </div>
                          )}
                          {stage === 'perdido' && lead.lostReason && (
                            <div className="text-[10px] text-red-400/80 mt-1.5">{lead.lostReason}</div>
                          )}
                        </div>
                      ))}
                      {stageLeads.length === 0 && (
                        <div className="text-[10px] text-text-muted text-center py-6 italic">
                          {isDropTarget ? 'Soltar aquí' : termino ? 'Sin resultados' : 'Vacío'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[12px] border border-border-default bg-bg-surface p-4">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Leads por etapa</h4>
              <div className="space-y-1.5">
                {porEtapa.map(({ etapa, n }) => (
                  <div key={etapa} className="grid grid-cols-[100px_1fr_28px] gap-2 items-center text-[11px]">
                    <span className="text-text-secondary truncate">{LEAD_STAGE_LABELS[etapa]}</span>
                    <div className="h-3.5 rounded bg-bg-elevated overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${(n / maxEtapa) * 100}%`,
                          background: etapa === 'ganado' ? '#0CA30C' : etapa === 'perdido' ? '#D03B3B' : accent,
                        }}
                      />
                    </div>
                    <span className="text-right font-mono text-text-primary">{n}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[12px] border border-border-default bg-bg-surface p-4">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Leads por fuente</h4>
              {porFuente.length === 0 ? (
                <p className="text-[11px] text-text-muted">Sin leads en este período.</p>
              ) : (
                <div className="space-y-1.5">
                  {porFuente.map(({ fuente, n }) => (
                    <div key={fuente} className="grid grid-cols-[80px_1fr_28px] gap-2 items-center text-[11px]">
                      <span className="text-text-secondary">{LEAD_SOURCE_LABELS[fuente]}</span>
                      <div className="h-3.5 rounded bg-bg-elevated overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${(n / totalFuente) * 100}%`, background: accent }} />
                      </div>
                      <span className="text-right font-mono text-text-primary">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <KpisTab leadsPeriodo={leadsPeriodo} setters={setters} closers={closers} accent={accent} />
      )}

      <AnimatePresence>
        {selected && (
          <LeadDrawer
            lead={selected}
            client={client}
            setters={setters}
            closers={closers}
            readOnly={readOnly}
            onClose={() => setSelectedId(null)}
            onUpdate={(patch) => updateLead(selected.id, patch)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lostPending && (
          <LostReasonModal
            lead={lostPending}
            onClose={() => setLostPending(null)}
            onConfirm={(motivo) => {
              updateLead(lostPending.id, { lostReason: motivo });
              moveStage(lostPending, 'perdido', actor, motivo);
              toast.success('Marcado como perdido');
              setLostPending(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addOpen && (
          <AddLeadModal
            client={client}
            setters={setters}
            closers={closers}
            onClose={() => setAddOpen(false)}
            onCreate={(data) => {
              const lead: Lead = {
                id: crypto.randomUUID(),
                clientId: client.id,
                nombre: data.nombre,
                telefono: data.telefono || undefined,
                fuente: data.fuente,
                setterId: data.setterId || undefined,
                closerId: data.closerId || undefined,
                etapa: 'nuevo',
                cashCollected: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              addLead(lead);
              moveStage({ ...lead, etapa: 'nuevo' }, 'nuevo', actor, 'Lead registrado');
              toast.success('Lead registrado');
              setAddOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <ImportarLeadsCSVModal open={importOpen} clientId={client.id} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function PeriodFilter({
  period, setPeriod, rangeStart, rangeEnd, setRangeStart, setRangeEnd, accent,
}: {
  period: Period; setPeriod: (p: Period) => void;
  rangeStart: string; rangeEnd: string; setRangeStart: (v: string) => void; setRangeEnd: (v: string) => void;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 rounded-[10px] border border-border-default bg-bg-surface p-1">
        {(['hoy', '7d', '15d', '30d', '60d', 'rango'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="text-[11px] font-semibold rounded-[6px] px-2.5 py-1 transition-colors"
            style={period === p ? { background: withAlpha(accent, 0.16), color: accent } : { color: 'var(--text-muted)' }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {period === 'rango' && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-base px-2 py-1 text-[11px]" />
          <span className="text-text-muted text-[11px]">–</span>
          <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)}
            className="rounded-lg border border-border-default bg-bg-base px-2 py-1 text-[11px]" />
        </div>
      )}
    </div>
  );
}

function KpisTab({
  leadsPeriodo, setters, closers, accent,
}: {
  leadsPeriodo: Lead[];
  setters: TeamOption[];
  closers: TeamOption[];
  accent: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2.5">Por Setter</h4>
        {setters.length === 0 ? (
          <p className="text-[11px] text-text-muted">Sin setters asignados a este cliente.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {setters.map((s) => (
              <PersonKpiCard key={s.id} nombre={s.nombre} leads={leadsPeriodo.filter((l) => l.setterId === s.id)} accent={accent} rolLabel="Setter" />
            ))}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2.5">Por Closer</h4>
        {closers.length === 0 ? (
          <p className="text-[11px] text-text-muted">Sin closers asignados a este cliente.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {closers.map((c) => (
              <PersonKpiCard key={c.id} nombre={c.nombre} leads={leadsPeriodo.filter((l) => l.closerId === c.id)} accent={accent} rolLabel="Closer" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PersonKpiCard({ nombre, leads, accent, rolLabel }: { nombre: string; leads: Lead[]; accent: string; rolLabel: string }) {
  const ganados = leads.filter((l) => l.etapa === 'ganado');
  const perdidos = leads.filter((l) => l.etapa === 'perdido');
  const cerrados = ganados.length + perdidos.length;
  const tasaCierre = cerrados > 0 ? Math.round((ganados.length / cerrados) * 100) : 0;
  const cashCollected = ganados.reduce((s, l) => s + (l.cashCollected ?? 0), 0);
  return (
    <div className="rounded-[12px] border border-border-default bg-bg-surface p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12.5px] font-semibold text-text-primary truncate">{nombre}</span>
        <Badge tone="neutral" className="text-[8.5px] px-1.5 py-0">{rolLabel}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-text-muted text-[9.5px] uppercase tracking-wide">Leads</div>
          <div className="font-mono font-semibold text-text-primary">{leads.length}</div>
        </div>
        <div>
          <div className="text-text-muted text-[9.5px] uppercase tracking-wide">Ganados</div>
          <div className="font-mono font-semibold" style={{ color: '#0CA30C' }}>{ganados.length}</div>
        </div>
        <div>
          <div className="text-text-muted text-[9.5px] uppercase tracking-wide">Tasa de cierre</div>
          <div className="font-mono font-semibold text-text-primary">{tasaCierre}%</div>
        </div>
        <div>
          <div className="text-text-muted text-[9.5px] uppercase tracking-wide">Cash collected</div>
          <div className="font-mono font-semibold" style={{ color: accent }}>${cashCollected.toLocaleString('es-CO')}</div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-[10px] border border-border-default bg-bg-surface p-3">
      <div className="text-[9.5px] uppercase tracking-wide text-text-muted font-semibold">{label}</div>
      <div className={cn('text-lg font-bold mt-1 font-mono', tone === 'good' && 'text-green-500', tone === 'warn' && 'text-amber-500')}>
        {value}
      </div>
    </div>
  );
}

interface TeamOption { id: string; nombre: string }

function LeadDrawer({
  lead, client, setters, closers, readOnly, onClose, onUpdate,
}: {
  lead: Lead;
  client: Client;
  setters: TeamOption[];
  closers: TeamOption[];
  readOnly: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<Lead>) => void;
}) {
  // `eventsForLead` arma un array nuevo (filter+sort) en cada llamada — si se
  // selecciona así directo de Zustand, cada render produce una referencia
  // distinta y dispara un loop infinito (mismo bug documentado el 27-sep en
  // el pipeline). Se selecciona el array crudo `events` y se filtra/ordena
  // en un useMemo propio, memoizado por lead.id y por la lista cruda.
  const allEvents = useLeadsStore((s) => s.events);
  const events = useMemo(
    () => allEvents.filter((e) => e.leadId === lead.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [allEvents, lead.id],
  );
  const [programValue, setProgramValue] = useState(lead.programValue?.toString() ?? '');
  const [cashCollected, setCashCollected] = useState(lead.cashCollected?.toString() ?? '0');
  const [nombre, setNombre] = useState(lead.nombre);
  const [telefono, setTelefono] = useState(lead.telefono ?? '');
  const [email, setEmail] = useState(lead.email ?? '');
  const [perfilRol, setPerfilRol] = useState(lead.perfilRol ?? '');

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-bg-base/70 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.25 }}
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg-surface border-l border-border-default flex flex-col"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border-subtle gap-3">
          <div className="min-w-0 flex-1">
            {readOnly ? (
              <h3 className="text-sm font-bold text-text-primary truncate">{lead.nombre}</h3>
            ) : (
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onBlur={() => nombre.trim() && nombre !== lead.nombre && onUpdate({ nombre: nombre.trim() })}
                className="text-sm font-bold text-text-primary bg-transparent border-none outline-none w-full focus:underline"
              />
            )}
            <p className="text-[11px] text-text-muted mt-0.5">{LEAD_STAGE_LABELS[lead.etapa]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-hover focus-ring shrink-0">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Teléfono</span>
              <input
                disabled={readOnly} value={telefono} placeholder="—"
                onChange={(e) => setTelefono(e.target.value)}
                onBlur={() => onUpdate({ telefono: telefono.trim() || undefined })}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Email</span>
              <input
                disabled={readOnly} value={email} placeholder="—"
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => onUpdate({ email: email.trim() || undefined })}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Fuente</span>
              <select
                disabled={readOnly} value={lead.fuente}
                onChange={(e) => onUpdate({ fuente: e.target.value as Lead['fuente'] })}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-[12px]"
              >
                {LEAD_SOURCES.map((f) => <option key={f} value={f}>{LEAD_SOURCE_LABELS[f]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Perfil (quién decide)</span>
              <input
                disabled={readOnly} value={perfilRol} placeholder="—"
                onChange={(e) => setPerfilRol(e.target.value)}
                onBlur={() => onUpdate({ perfilRol: perfilRol.trim() || undefined })}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-[12px]"
              />
            </label>
          </div>

          {(lead.banda || lead.score !== undefined || lead.ruta) && (
            <div className="rounded-[10px] border border-border-default p-3">
              <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Calificación del formulario</div>
              <div className="grid grid-cols-3 gap-2 text-[12px]">
                {lead.banda && (
                  <div>
                    <div className="text-[10px] text-text-muted">Banda</div>
                    <div className="font-medium flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: BANDA_COLOR[normalizarBanda(lead.banda)] ?? '#8A8F98' }} />
                      {lead.banda}
                    </div>
                  </div>
                )}
                {lead.score !== undefined && (
                  <div>
                    <div className="text-[10px] text-text-muted">Score</div>
                    <div className="font-mono font-medium mt-0.5">{lead.score}</div>
                  </div>
                )}
                {lead.ruta && (
                  <div>
                    <div className="text-[10px] text-text-muted">Ruta</div>
                    <div className="font-medium mt-0.5">{lead.ruta}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Setter</span>
              <select
                disabled={readOnly} value={lead.setterId ?? ''}
                onChange={(e) => onUpdate({ setterId: e.target.value || undefined })}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-[12px]"
              >
                <option value="">Sin asignar</option>
                {setters.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Closer</span>
              <select
                disabled={readOnly} value={lead.closerId ?? ''}
                onChange={(e) => onUpdate({ closerId: e.target.value || undefined })}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-[12px]"
              >
                <option value="">Sin asignar</option>
                {closers.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
          </div>

          {lead.etapa === 'perdido' && lead.lostReason && (
            <div className="rounded-[10px] border border-red-500/25 bg-red-500/5 p-3">
              <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Motivo de pérdida</div>
              <p className="text-[12px] text-text-primary mt-1">{lead.lostReason}</p>
            </div>
          )}

          {lead.etapa === 'ganado' && (
            <div className="rounded-[10px] border border-border-default p-3 space-y-2.5">
              <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Después del cierre</div>
              <label className="block">
                <span className="text-[10.5px] text-text-muted">Valor del programa</span>
                <input
                  type="number" disabled={readOnly} value={programValue}
                  onChange={(e) => setProgramValue(e.target.value)}
                  onBlur={() => onUpdate({ programValue: programValue ? Number(programValue) : undefined })}
                  className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] font-mono"
                />
              </label>
              <label className="block">
                <span className="text-[10.5px] text-text-muted">Cash collected (manual)</span>
                <input
                  type="number" disabled={readOnly} value={cashCollected}
                  onChange={(e) => setCashCollected(e.target.value)}
                  onBlur={() => onUpdate({ cashCollected: Number(cashCollected) || 0 })}
                  className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] font-mono"
                />
              </label>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Campo manual — lo actualiza quien confirma el pago, no se calcula solo.
              </p>
            </div>
          )}

          <div>
            <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2.5">Viaje del lead</h4>
            <div className="space-y-0">
              {events.length === 0 && <p className="text-[11px] text-text-muted">Sin movimientos todavía.</p>}
              {events.map((ev, i) => (
                <div key={ev.id} className="grid grid-cols-[16px_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-2 h-2 rounded-full mt-1" style={{ background: client.primaryColor }} />
                    {i < events.length - 1 && <span className="w-px flex-1 bg-border-default mt-1" />}
                  </div>
                  <div className="pb-4">
                    <div className="text-[11.5px] font-medium text-text-primary">
                      {ev.etapaAnterior ? `${LEAD_STAGE_LABELS[ev.etapaAnterior]} → ${LEAD_STAGE_LABELS[ev.etapaNueva]}` : `Registrado — ${LEAD_STAGE_LABELS[ev.etapaNueva]}`}
                    </div>
                    {ev.nota && <div className="text-[11px] text-text-secondary mt-0.5">{ev.nota}</div>}
                    <div className="text-[10px] text-text-muted mt-1">
                      {new Date(ev.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                      {ev.actorNombre ? ` · ${ev.actorNombre}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function AddLeadModal({
  client, setters, closers, onClose, onCreate,
}: {
  client: Client;
  setters: TeamOption[];
  closers: TeamOption[];
  onClose: () => void;
  onCreate: (data: { nombre: string; telefono: string; fuente: LeadSource; setterId: string; closerId: string }) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fuente, setFuente] = useState<LeadSource>('meta_ads');
  const [setterId, setSetterId] = useState('');
  const [closerId, setCloserId] = useState('');

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-bg-base/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-sm rounded-[14px] border border-border-default bg-bg-surface p-5" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-bold text-text-primary mb-4">Nuevo lead</h3>
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] text-text-muted">Nombre</span>
              <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2.5 py-1.5 text-[13px]" placeholder="Nombre del lead" />
            </label>
            <label className="block">
              <span className="text-[11px] text-text-muted">Teléfono</span>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2.5 py-1.5 text-[13px]" placeholder="+57 300 000 0000" />
            </label>
            <label className="block">
              <span className="text-[11px] text-text-muted">Fuente</span>
              <select value={fuente} onChange={(e) => setFuente(e.target.value as LeadSource)}
                className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2.5 py-1.5 text-[13px]">
                {LEAD_SOURCES.map((f) => (
                  <option key={f} value={f}>{LEAD_SOURCE_LABELS[f]}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="text-[11px] text-text-muted">Setter</span>
                <select value={setterId} onChange={(e) => setSetterId(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2.5 py-1.5 text-[13px]">
                  <option value="">Sin asignar</option>
                  {setters.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-text-muted">Closer</span>
                <select value={closerId} onChange={(e) => setCloserId(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-border-default bg-bg-base px-2.5 py-1.5 text-[13px]">
                  <option value="">Sin asignar</option>
                  {closers.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="text-[12px] font-medium text-text-secondary px-3 py-1.5 rounded-lg hover:bg-bg-hover">Cancelar</button>
            <button
              onClick={() => nombre.trim() && onCreate({ nombre: nombre.trim(), telefono, fuente, setterId, closerId })}
              disabled={!nombre.trim()}
              className="text-[12px] font-semibold text-white px-3.5 py-1.5 rounded-lg disabled:opacity-40"
              style={{ background: client.primaryColor }}
            >
              Registrar
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function LostReasonModal({
  lead, onClose, onConfirm,
}: {
  lead: Lead;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-bg-base/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-sm rounded-[14px] border border-border-default bg-bg-surface p-5" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-bold text-text-primary mb-1">Marcar como perdido</h3>
          <p className="text-[12px] text-text-muted mb-4">{lead.nombre} — ¿por qué se perdió?</p>
          <textarea
            autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. precio, no calificó, se enfrió el lead…"
            rows={3}
            className="w-full rounded-lg border border-border-default bg-bg-base px-2.5 py-1.5 text-[13px] resize-none"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="text-[12px] font-medium text-text-secondary px-3 py-1.5 rounded-lg hover:bg-bg-hover">Cancelar</button>
            <button
              onClick={() => motivo.trim() && onConfirm(motivo.trim())}
              disabled={!motivo.trim()}
              className="text-[12px] font-semibold text-white px-3.5 py-1.5 rounded-lg disabled:opacity-40 bg-red-600"
            >
              Marcar perdido
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
