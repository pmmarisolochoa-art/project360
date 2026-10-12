import { onWriteError } from './onWriteError';
import { altaOptimista, cambioOptimista, bajaOptimista } from './escrituraOptimista';
import { create } from 'zustand';
import type { Lead, LeadEvent, LeadStage } from '@/types/lead';
import { LeadsRepo, LeadEventsRepo } from '@/services/repositories';

interface LeadsState {
  leads: Lead[];
  events: LeadEvent[];
  hydrate: (leads: Lead[], events: LeadEvent[]) => void;
  add: (lead: Lead) => void;
  update: (id: string, patch: Partial<Lead>) => void;
  remove: (id: string) => void;
  /**
   * Registra leads ya guardados en Supabase (import CSV) sin volver a
   * escribirlos — mismo patrón que `registrarClientesGuardados`. Idempotente
   * por id: un duplicado que solo vive en el navegador desaparecería al
   * recargar y parecería que la base se rompió.
   */
  registrarImportados: (leads: Lead[]) => void;
  /**
   * Mueve el lead a una nueva etapa Y agrega la fila del historial en un solo
   * gesto — mover una tarjeta ES el registro, no hay paso extra para el setter.
   */
  moveStage: (lead: Lead, nuevaEtapa: LeadStage, actor: { id?: string; nombre?: string }, nota?: string) => Promise<boolean>;
  addEvent: (event: LeadEvent) => void;
  byClient: (clientId: string) => Lead[];
  eventsForLead: (leadId: string) => LeadEvent[];
}

let version = 0;
const movimientos = new Map<string, symbol>();

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  events: [],
  hydrate: (leads, events) => {
    version += 1;
    movimientos.clear();
    set({ leads, events });
  },
  add: (lead) => {
    const revertir = altaOptimista(() => get().leads, (leads) => set({ leads }), lead);
    void LeadsRepo.create(lead).catch(onWriteError('leads.create', 'No se pudo guardar el lead. Se quitó de la lista: vuelve a intentarlo.', revertir));
  },
  update: (id, patch) => {
    const revertir = cambioOptimista(() => get().leads, (leads) => set({ leads }), id, patch);
    void LeadsRepo.update(id, patch).catch(onWriteError('leads.update', 'No se pudieron guardar los cambios del lead. Se deshicieron en pantalla.', revertir));
  },
  remove: (id) => {
    const revertir = bajaOptimista(() => get().leads, (leads) => set({ leads }), id);
    void LeadsRepo.remove(id).catch(onWriteError('leads.remove', 'No se pudo eliminar el lead. Vuelve a aparecer porque sigue ahí.', revertir));
  },
  registrarImportados: (leads) => {
    if (leads.length === 0) return;
    set((s) => {
      const existentes = new Set(s.leads.map((l) => l.id));
      const nuevos = leads.filter((l) => !existentes.has(l.id));
      return nuevos.length === 0 ? s : { leads: [...s.leads, ...nuevos] };
    });
  },
  moveStage: async (lead, nuevaEtapa, actor, nota) => {
    const previo = get().leads.find((l) => l.id === lead.id);
    if (!previo || previo.etapa === nuevaEtapa || movimientos.has(lead.id)) return false;
    const token = Symbol();
    const inicio = version;
    movimientos.set(lead.id, token);
    const event: LeadEvent = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      etapaAnterior: previo.etapa,
      etapaNueva: nuevaEtapa,
      nota,
      actorId: actor.id,
      actorNombre: actor.nombre,
      createdAt: new Date().toISOString(),
    };
    const patch = {
      etapa: nuevaEtapa,
      closedAt: nuevaEtapa === 'ganado' || nuevaEtapa === 'perdido' ? event.createdAt : undefined,
      lostReason: nuevaEtapa === 'perdido' ? nota ?? previo.lostReason : previo.lostReason,
    };
    set((s) => ({ leads: s.leads.map((l) => l.id === lead.id ? { ...l, ...patch } : l), events: [event, ...s.events] }));
    try {
      const saved = await LeadsRepo.moveStage(previo, event);
      if (inicio !== version) return false;
      set((s) => ({
        leads: s.leads.map((l) => l.id === lead.id ? { ...l, etapa: saved.lead.etapa,
          closedAt: saved.lead.closedAt, lostReason: saved.lead.lostReason } : l),
        events: s.events.map((e) => e.id === event.id ? saved.event : e),
      }));
      return true;
    } catch (error) {
      if (inicio !== version) return false;
      onWriteError('leads.moveStage', 'No se guardó el movimiento ni su historial. Recarga antes de volver a intentarlo.', () => {
        set((s) => ({
          leads: s.leads.map((l) => l.id === lead.id ? { ...l, etapa: previo.etapa,
            closedAt: previo.closedAt, lostReason: previo.lostReason } : l),
          events: s.events.filter((e) => e.id !== event.id),
        }));
      })(error);
      return false;
    } finally {
      if (movimientos.get(lead.id) === token) movimientos.delete(lead.id);
    }
  },
  addEvent: (event) => {
    const revertir = altaOptimista(() => get().events, (events) => set({ events }), event);
    void LeadEventsRepo.add(event).catch(onWriteError('leadEvents.add', 'No se pudo guardar el movimiento en el historial del lead.', revertir));
  },
  byClient: (clientId) => get().leads.filter((l) => l.clientId === clientId),
  eventsForLead: (leadId) => get().events.filter((e) => e.leadId === leadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
}));
