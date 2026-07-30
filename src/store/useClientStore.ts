import { create } from 'zustand';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import type { Task } from '@/types/task';
import { seedClients, seedMeetings, seedTasks } from '@/data/seed';
import { ClientsRepo, TasksRepo, MeetingsRepo } from '@/services/repositories';
import { toast } from '@/store/useToastStore';

/**
 * Handler de error para escrituras optimistas a Supabase.
 *
 * La UI ya pintó el cambio antes de que la BD confirmara, así que si la
 * escritura falla y solo lo logueamos, el usuario se queda creyendo que guardó
 * y pierde el trabajo al recargar. (Así pasó inadvertido durante días que
 * `tasks.update` devolvía 400 por la columna `updated_at` inexistente.)
 * Siempre avisar, además de loguear.
 */
const onWriteError = (label: string, message: string) => (e: unknown) => {
  console.warn(`[${label}]`, e);
  toast.error(message);
};

interface ClientState {
  clients: Client[];
  meetings: Meeting[];
  tasks: Task[];
  /** true cuando el bootstrap ya cargó (o falló). Antes de eso `clients` es el
   *  seed, así que buscar un cliente real fallaría — hay que esperar. */
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  currentClientId: string | null;
  setCurrentClient: (id: string | null) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;
  // Tasks CRUD
  addTask: (t: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  tasksByClient: (clientId: string) => Task[];
  // Meetings CRUD
  addMeeting: (m: Meeting) => void;
  updateMeeting: (id: string, patch: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  meetingsByClient: (clientId: string) => Meeting[];
}

export const useClientStore = create<ClientState>((set, get) => ({
  clients: seedClients,
  meetings: seedMeetings,
  tasks: seedTasks,
  // NOTA: todas las escrituras de abajo son optimistas — la UI pinta el cambio
  // antes de que Supabase confirme. Por eso un fallo NUNCA puede quedarse solo
  // en la consola: el usuario creería que guardó. Usar siempre `onWriteError`.
  hydrated: false,
  setHydrated: (v) => set({ hydrated: v }),
  currentClientId: null,
  setCurrentClient: (id) => set({ currentClientId: id }),
  addClient: (c) => {
    set((s) => ({ clients: [c, ...s.clients] }));
    void ClientsRepo.create(c).catch(
      onWriteError('clients.create', 'No se pudo crear el cliente. Recarga e inténtalo de nuevo.'),
    );
  },
  updateClient: (id, patch) => {
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
      ),
    }));
    void ClientsRepo.update(id, patch).catch(
      onWriteError('clients.update', 'No se pudieron guardar los cambios del cliente.'),
    );
  },
  deleteClient: (id) => {
    // Limpia también todo lo relacionado en memoria (Supabase cascadeará por FK).
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
      tasks: s.tasks.filter((t) => t.clientId !== id),
      meetings: s.meetings.filter((m) => m.clientId !== id),
      currentClientId: s.currentClientId === id ? null : s.currentClientId,
    }));
    void ClientsRepo.remove(id).catch(
      onWriteError('clients.remove', 'No se pudo eliminar el cliente. Recarga: puede seguir ahí.'),
    );
  },
  getClient: (id) => get().clients.find((c) => c.id === id),
  addTask: (t) => {
    set((s) => ({ tasks: [t, ...s.tasks] }));
    void TasksRepo.create(t).catch(
      onWriteError('tasks.create', 'No se pudo crear la tarea. El equipo no la verá hasta que se guarde.'),
    );
  },
  updateTask: (id, patch) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    void TasksRepo.update(id, patch).catch(
      onWriteError('tasks.update', 'No se pudo guardar el cambio en la tarea. Recarga para ver el estado real.'),
    );
  },
  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    void TasksRepo.remove(id).catch(
      onWriteError('tasks.remove', 'No se pudo eliminar la tarea. Recarga: puede seguir ahí.'),
    );
  },
  tasksByClient: (clientId) => get().tasks.filter((t) => t.clientId === clientId),
  addMeeting: (m) => {
    set((s) => ({ meetings: [m, ...s.meetings] }));
    void MeetingsRepo.create(m).catch(
      onWriteError(
        'meetings.create',
        'No se pudo guardar la reunión. Recarga e inténtalo de nuevo — el equipo no la verá hasta que se guarde.',
      ),
    );
  },
  updateMeeting: (id, patch) => {
    set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    void MeetingsRepo.update(id, patch).catch(
      onWriteError('meetings.update', 'No se pudieron guardar los cambios de la reunión.'),
    );
  },
  deleteMeeting: (id) => {
    set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }));
    void MeetingsRepo.remove(id).catch(
      onWriteError('meetings.remove', 'No se pudo eliminar la reunión. Recarga: puede seguir ahí.'),
    );
  },
  meetingsByClient: (clientId) => get().meetings.filter((m) => m.clientId === clientId),
}));
