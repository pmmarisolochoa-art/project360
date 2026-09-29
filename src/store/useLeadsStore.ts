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
   * Mueve el lead a una nueva etapa Y agrega la fila del historial en un solo
   * gesto — mover una tarjeta ES el registro, no hay paso extra para el setter.
   */
  moveStage: (lead: Lead, nuevaEtapa: LeadStage, actor: { id?: string; nombre?: string }, nota?: string) => void;
  addEvent: (event: LeadEvent) => void;
  byClient: (clientId: string) => Lead[];
  eventsForLead: (leadId: string) => LeadEvent[];
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  events: [],
  hydrate: (leads, events) => set({ leads, events }),
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
  moveStage: (lead, nuevaEtapa, actor, nota) => {
    if (lead.etapa === nuevaEtapa) return;
    get().update(lead.id, {
      etapa: nuevaEtapa,
      closedAt: nuevaEtapa === 'ganado' || nuevaEtapa === 'perdido' ? new Date().toISOString() : undefined,
    });
    const event: LeadEvent = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      etapaAnterior: lead.etapa,
      etapaNueva: nuevaEtapa,
      nota,
      actorId: actor.id,
      actorNombre: actor.nombre,
      createdAt: new Date().toISOString(),
    };
    get().addEvent(event);
  },
  addEvent: (event) => {
    const revertir = altaOptimista(() => get().events, (events) => set({ events }), event);
    void LeadEventsRepo.add(event).catch(onWriteError('leadEvents.add', 'No se pudo guardar el movimiento en el historial del lead.', revertir));
  },
  byClient: (clientId) => get().leads.filter((l) => l.clientId === clientId),
  eventsForLead: (leadId) => get().events.filter((e) => e.leadId === leadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
}));
