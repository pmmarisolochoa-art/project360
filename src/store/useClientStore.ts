import { create } from 'zustand';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import type { Task } from '@/types/task';
import { seedClients, seedMeetings, seedTasks } from '@/data/seed';
import { ClientsRepo, TasksRepo, MeetingsRepo } from '@/services/repositories';
import { onWriteError } from './onWriteError';
import { altaOptimista, cambioOptimista, bajaOptimista } from './escrituraOptimista';

/**
 * Handler de error para escrituras optimistas a Supabase.
 *
 * La UI ya pintó el cambio antes de que la BD confirmara, así que si la
 * escritura falla y solo lo logueamos, el usuario se queda creyendo que guardó
 * y pierde el trabajo al recargar. (Así pasó inadvertido durante días que
 * `tasks.update` devolvía 400 por la columna `updated_at` inexistente.)
 * Siempre avisar, además de loguear.
 */

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
  /**
   * Mete en memoria clientes que YA quedaron guardados en Supabase.
   *
   * Existe aparte de `addClient` por la importación por CSV: allí se escribe
   * fila por fila esperando la confirmación de cada una, para poder decir
   * cuáles entraron y cuáles no (R-33). Escribir optimista y deshacer, como
   * hace `addClient`, dejaría un lote a medias sin manera de contarlo.
   * No escribe nada: quien la llama ya escribió.
   */
  registrarClientesGuardados: (cs: Client[]) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;
  // Tasks CRUD
  /**
   * Crea la tarea. Devuelve `true` si quedó guardada en Supabase.
   *
   * Devuelve algo (antes era `void`) porque quien crea desde un formulario
   * necesita saber si de verdad se guardó ANTES de decirle "listo" al usuario.
   * Los demás sitios pueden seguir ignorando el resultado: el toast de error
   * salta igual.
   */
  addTask: (t: Task) => Promise<boolean>;
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
    const revertir = altaOptimista(() => get().clients, (clients) => set({ clients }), c);
    void ClientsRepo.create(c).catch(
      onWriteError('clients.create', 'No se pudo crear el cliente. Se quitó de la lista: vuelve a intentarlo.', revertir),
    );
  },
  registrarClientesGuardados: (cs) => {
    if (cs.length === 0) return;
    // Idempotente también aquí: si una fila ya está en la lista no se repite.
    // Un duplicado que solo vive en el navegador es peor que uno en la base,
    // porque desaparece al recargar y parece que la base se rompió (R-44).
    set((s) => {
      const ids = new Set(s.clients.map((c) => c.id));
      return { clients: [...s.clients, ...cs.filter((c) => !ids.has(c.id))] };
    });
  },
  updateClient: (id, patch) => {
    const revertir = cambioOptimista(
      () => get().clients,
      (clients) => set({ clients }),
      id,
      { ...patch, updatedAt: new Date().toISOString() },
    );
    void ClientsRepo.update(id, patch).catch(
      onWriteError('clients.update', 'No se pudieron guardar los cambios del cliente. Se deshicieron en pantalla.', revertir),
    );
  },
  deleteClient: (id) => {
    /**
     * ÚNICO caso donde revertir restaura las listas ENTERAS en vez de una fila.
     *
     * Borrar un cliente arrastra sus tareas y sus reuniones (Supabase cascadea
     * por clave foránea, y aquí se refleja). Deshacer eso fila por fila sería
     * frágil, y el riesgo que evitamos en los demás casos —pisar una edición
     * hecha mientras tanto— aquí no aplica: si el borrado del cliente falla,
     * nadie ha podido editar sus tareas, porque acaban de desaparecer de la
     * pantalla.
     */
    const antes = { clients: get().clients, tasks: get().tasks, meetings: get().meetings };
    // Limpia también todo lo relacionado en memoria (Supabase cascadeará por FK).
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
      tasks: s.tasks.filter((t) => t.clientId !== id),
      meetings: s.meetings.filter((m) => m.clientId !== id),
      currentClientId: s.currentClientId === id ? null : s.currentClientId,
    }));
    const revertir = () => set(antes);
    void ClientsRepo.remove(id).catch(
      onWriteError('clients.remove', 'No se pudo eliminar el cliente. Vuelve a aparecer porque sigue ahí.', revertir),
    );
  },
  getClient: (id) => get().clients.find((c) => c.id === id),
  addTask: (t) => {
    // Esta fue la primera escritura que aprendió a deshacerse, el 1 de agosto.
    // Durante tres semanas fue la ÚNICA de treinta; ahora usa la misma pieza
    // que el resto, para que no queden dos maneras de hacer lo mismo.
    const revertir = altaOptimista(() => get().tasks, (tasks) => set({ tasks }), t);
    return TasksRepo.create(t)
      .then(() => true)
      .catch((e) => {
        onWriteError(
          'tasks.create',
          'No se pudo crear la tarea. Se quitó de la lista: vuelve a intentarlo.',
          revertir,
        )(e);
        return false;
      });
  },
  updateTask: (id, patch) => {
    const revertir = cambioOptimista(() => get().tasks, (tasks) => set({ tasks }), id, patch);
    void TasksRepo.update(id, patch).catch(
      onWriteError('tasks.update', 'No se pudo guardar el cambio en la tarea. Se deshizo en pantalla.', revertir),
    );
  },
  deleteTask: (id) => {
    const revertir = bajaOptimista(() => get().tasks, (tasks) => set({ tasks }), id);
    void TasksRepo.remove(id).catch(
      onWriteError('tasks.remove', 'No se pudo eliminar la tarea. Vuelve a aparecer porque sigue ahí.', revertir),
    );
  },
  tasksByClient: (clientId) => get().tasks.filter((t) => t.clientId === clientId),
  addMeeting: (m) => {
    const revertir = altaOptimista(() => get().meetings, (meetings) => set({ meetings }), m);
    void MeetingsRepo.create(m).catch(
      onWriteError(
        'meetings.create',
        'No se pudo guardar la reunión. Se quitó de la agenda: vuelve a intentarlo.',
        revertir,
      ),
    );
  },
  updateMeeting: (id, patch) => {
    const revertir = cambioOptimista(() => get().meetings, (meetings) => set({ meetings }), id, patch);
    void MeetingsRepo.update(id, patch).catch(
      onWriteError('meetings.update', 'No se pudieron guardar los cambios de la reunión. Se deshicieron en pantalla.', revertir),
    );
  },
  deleteMeeting: (id) => {
    const revertir = bajaOptimista(() => get().meetings, (meetings) => set({ meetings }), id);
    void MeetingsRepo.remove(id).catch(
      onWriteError('meetings.remove', 'No se pudo eliminar la reunión. Vuelve a aparecer porque sigue ahí.', revertir),
    );
  },
  meetingsByClient: (clientId) => get().meetings.filter((m) => m.clientId === clientId),
}));
