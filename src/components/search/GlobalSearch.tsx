import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, CheckSquare, Calendar, User, LinkIcon } from 'lucide-react';
import { useClientStore } from '@/store/useClientStore';
import { useTeamMembersStore } from '@/store/useTeamMembersStore';
import { useLinksStore } from '@/store/useLinksStore';
import { ROLE_DEFS } from '@/types/team';
import { cn } from '@/utils/cn';

/** Normaliza para buscar sin acentos y sin mayúsculas. */
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type Group = 'Clientes' | 'Tareas' | 'Reuniones' | 'Entregables' | 'Equipo';

interface Result {
  key: string;
  group: Group;
  icon: typeof Search;
  label: string;
  sublabel?: string;
  color?: string;
  onSelect: () => void;
}

const PER_GROUP = 5;

export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const clients = useClientStore((s) => s.clients);
  const tasks = useClientStore((s) => s.tasks);
  const meetings = useClientStore((s) => s.meetings);
  const members = useTeamMembersStore((s) => s.members);
  const links = useLinksStore((s) => s.links);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const results = useMemo<Result[]>(() => {
    const q = norm(query.trim());
    if (q.length < 1) return [];
    const out: Result[] = [];

    // Clientes
    clients
      .filter((c) => norm(c.name).includes(q) || norm(c.industry ?? '').includes(q))
      .slice(0, PER_GROUP)
      .forEach((c) =>
        out.push({
          key: `c-${c.id}`, group: 'Clientes', icon: Users, label: c.name,
          sublabel: c.industry, color: c.primaryColor,
          onSelect: () => navigate(`/client/${c.id}`),
        }),
      );

    // Tareas
    tasks
      .filter((t) => norm(t.title).includes(q))
      .slice(0, PER_GROUP)
      .forEach((t) =>
        out.push({
          key: `t-${t.id}`, group: 'Tareas', icon: CheckSquare, label: t.title,
          sublabel: clientById[t.clientId]?.name, color: clientById[t.clientId]?.primaryColor,
          onSelect: () => navigate(`/client/${t.clientId}/tasks`),
        }),
      );

    // Reuniones
    meetings
      .filter((m) => norm(m.title).includes(q))
      .slice(0, PER_GROUP)
      .forEach((m) =>
        out.push({
          key: `m-${m.id}`, group: 'Reuniones', icon: Calendar, label: m.title,
          sublabel: clientById[m.clientId]?.name, color: clientById[m.clientId]?.primaryColor,
          onSelect: () => navigate(`/client/${m.clientId}/meetings`),
        }),
      );

    // Entregables / links
    links
      .filter((l) => norm(l.nombre).includes(q) || norm(l.tipo).includes(q))
      .slice(0, PER_GROUP)
      .forEach((l) =>
        out.push({
          key: `l-${l.id}`, group: 'Entregables', icon: LinkIcon, label: l.nombre,
          sublabel: `${clientById[l.clientId]?.name ?? ''} · ${l.tipo}`,
          color: clientById[l.clientId]?.primaryColor,
          onSelect: () => window.open(l.url, '_blank', 'noopener'),
        }),
      );

    // Equipo
    members
      .filter((tm) => norm(tm.nombre).includes(q) || norm(tm.rol).includes(q))
      .slice(0, PER_GROUP)
      .forEach((tm) => {
        const roleTitle = ROLE_DEFS.find((r) => r.slug === tm.rol)?.title ?? tm.rol;
        out.push({
          key: `p-${tm.id}`, group: 'Equipo', icon: User, label: tm.nombre,
          sublabel: `${roleTitle} · ${clientById[tm.clientId]?.name ?? ''}`,
          color: tm.avatarColor,
          onSelect: () => navigate(`/client/${tm.clientId}/team`),
        });
      });

    return out;
  }, [query, clients, tasks, meetings, links, members, clientById, navigate]);

  // Reset del resaltado al cambiar resultados.
  useEffect(() => { setActive(0); }, [query]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    r.onSelect();
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); return; }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
      <input
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar cliente, tarea, reunión, entregable, persona…"
        className="w-full h-10 pl-10 pr-3 rounded-[10px] border text-sm text-text-primary focus-ring"
        style={{ background: 'var(--header-search-bg)', borderColor: 'var(--header-search-border)' }}
      />

      {showDropdown && (
        <div className="absolute z-50 mt-2 w-full max-h-[70vh] overflow-y-auto rounded-[12px] border border-border-subtle bg-bg-surface shadow-2xl">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-muted">Sin resultados para “{query.trim()}”.</div>
          ) : (
            (['Clientes', 'Tareas', 'Reuniones', 'Entregables', 'Equipo'] as Group[]).map((group) => {
              const rows = results.filter((r) => r.group === group);
              if (rows.length === 0) return null;
              return (
                <div key={group} className="py-1">
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-text-muted">{group}</div>
                  {rows.map((r) => {
                    const idx = results.indexOf(r);
                    return (
                      <button
                        key={r.key}
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(r)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition',
                          idx === active ? 'bg-bg-elevated' : 'hover:bg-bg-elevated/60',
                        )}
                      >
                        <span className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                          style={{ background: r.color ? `${r.color}22` : 'var(--header-search-bg)' }}>
                          <r.icon className="h-3.5 w-3.5" style={{ color: r.color ?? 'var(--text-muted)' }} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-text-primary truncate">{r.label}</span>
                          {r.sublabel && <span className="block text-[11px] text-text-muted truncate">{r.sublabel}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
