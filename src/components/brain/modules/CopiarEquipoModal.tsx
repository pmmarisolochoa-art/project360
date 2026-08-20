/**
 * Copiar el equipo desde otro cliente.
 *
 * Las fichas de equipo son POR CLIENTE, así que la misma persona necesita una
 * ficha en cada cliente donde trabaja. Con 13 personas y 3 clientes eso son 39
 * altas a mano, y hasta hoy no había otra forma.
 *
 * QUÉ SE COPIA: nombre, rol, correo, teléfono y funciones. Lo que identifica a
 * la persona y permite contactarla.
 *
 * QUÉ NO SE COPIA, y es deliberado:
 *   - EL ACCESO (`user_id`, nivel, departamentos). Que alguien trabaje en un
 *     cliente no significa que pueda entrar a otro. Dar acceso es una decisión
 *     por cliente y se toma invitando, con su aviso — no de rebote al copiar.
 *   - LOS KPIs. Son el desempeño de esa persona EN ese cliente. Copiarlos
 *     mostraría resultados de un trabajo que aún no ha hecho.
 *
 * Es idempotente (R-44): quien ya está en el destino aparece marcado como tal y
 * no se puede volver a copiar. Copiar dos veces no duplica a nadie.
 */

import { useMemo, useState } from 'react';
import { Users, Check } from 'lucide-react';
import type { Client } from '@/types/client';
import type { TeamMember } from '@/types/teamMember';
import { emptyKpis } from '@/types/teamMember';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useClientStore } from '@/store/useClientStore';
import { useTeamMembersStore, teamMembersForClient } from '@/store/useTeamMembersStore';
import { toast } from '@/store/useToastStore';
import { genId } from '@/utils/id';
import { ROLE_DEFS } from '@/types/team';

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function CopiarEquipoModal({ destino, onClose }: { destino: Client; onClose: () => void }) {
  const clients = useClientStore((s) => s.clients);
  const members = useTeamMembersStore((s) => s.members);
  const add = useTeamMembersStore((s) => s.add);

  const origenes = clients.filter((c) => c.id !== destino.id);
  const [origenId, setOrigenId] = useState(origenes[0]?.id ?? '');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [copiando, setCopiando] = useState(false);

  const yaEstan = useMemo(
    () => new Set(teamMembersForClient(destino.id).map((m) => norm(m.nombre))),
    // `members` entra en las dependencias aunque no se use directamente: es lo
    // que hace que la lista se refresque al copiar.
    [destino.id, members],
  );

  const candidatos = useMemo(
    () => members.filter((m) => m.clientId === origenId),
    [members, origenId],
  );

  const copiables = candidatos.filter((m) => !yaEstan.has(norm(m.nombre)));

  const alternar = (id: string) =>
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copiar = async () => {
    const aCopiar = copiables.filter((m) => marcados.has(m.id));
    if (!aCopiar.length) return;
    setCopiando(true);
    try {
      for (const m of aCopiar) {
        const nueva: TeamMember = {
          id: genId(),
          clientId: destino.id,
          nombre: m.nombre,
          rol: m.rol,
          email: m.email,
          telefono: m.telefono,
          avatarColor: m.avatarColor,
          funciones: [...(m.funciones ?? [])],
          kpis: emptyKpis(),
          createdAt: new Date().toISOString(),
        };
        add(nueva);
      }
      const sinCorreo = aCopiar.filter((m) => !m.email).length;
      toast.success(
        `${aCopiar.length} persona${aCopiar.length === 1 ? '' : 's'} copiada${aCopiar.length === 1 ? '' : 's'} a ${destino.name}.` +
          (sinCorreo ? ` ${sinCorreo} sin correo — complétalos para que reciban los reportes.` : ''),
      );
      onClose();
    } finally {
      setCopiando(false);
    }
  };

  const etiquetaRol = (slug: string) => ROLE_DEFS.find((r) => r.slug === slug)?.title ?? slug;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Copiar equipo a ${destino.name}`}
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <div className="text-xs text-text-muted">
            {marcados.size > 0 ? `${marcados.size} seleccionada${marcados.size === 1 ? '' : 's'}` : 'Nadie seleccionado'}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={copiando}>
              Cancelar
            </Button>
            <Button onClick={copiar} disabled={copiando || marcados.size === 0}>
              <Users className="h-4 w-4" /> {copiando ? 'Copiando…' : 'Copiar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-text-secondary">
          Se copian nombre, rol, correo, teléfono y funciones. <b>No se copia el acceso</b> — que
          alguien trabaje aquí no le da entrada a la app; eso se hace invitando. Tampoco los KPIs,
          que son del trabajo hecho en el otro cliente.
        </p>

        <Select
          value={origenId}
          onChange={(e) => {
            setOrigenId(e.target.value);
            setMarcados(new Set());
          }}
          options={origenes.map((c) => ({ value: c.id, label: `Copiar desde ${c.name}` }))}
        />

        {candidatos.length === 0 && (
          <div className="surface p-6 text-center text-sm text-text-muted">
            Ese cliente no tiene equipo registrado.
          </div>
        )}

        {copiables.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setMarcados(marcados.size === copiables.length ? new Set() : new Set(copiables.map((m) => m.id)))
              }
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              {marcados.size === copiables.length ? 'Quitar todos' : 'Seleccionar todos'}
            </button>
          </div>
        )}

        <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
          {candidatos.map((m) => {
            const yaEsta = yaEstan.has(norm(m.nombre));
            return (
              <label
                key={m.id}
                className={`flex items-center gap-3 rounded-[10px] border px-3 py-2.5 ${
                  yaEsta
                    ? 'border-border-subtle opacity-55'
                    : marcados.has(m.id)
                      ? 'border-accent/50 bg-accent/5 cursor-pointer'
                      : 'border-border-subtle cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={yaEsta}
                  checked={marcados.has(m.id)}
                  onChange={() => alternar(m.id)}
                  className="h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text-primary">{m.nombre}</div>
                  <div className="text-[11px] text-text-muted">
                    {etiquetaRol(m.rol)}
                    {m.email ? ` · ${m.email}` : ' · sin correo'}
                    {m.telefono ? ` · ${m.telefono}` : ''}
                  </div>
                </div>
                {yaEsta ? (
                  <Badge tone="success">
                    <Check className="h-3 w-3" /> Ya está
                  </Badge>
                ) : (
                  !m.email && <Badge tone="warning">sin correo</Badge>
                )}
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
