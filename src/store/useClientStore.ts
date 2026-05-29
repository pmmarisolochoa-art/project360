import { create } from 'zustand';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import type { Task } from '@/types/task';
import { seedClients, seedMeetings, seedTasks } from '@/data/seed';
import { ClientsRepo, TasksRepo, MeetingsRepo } from '@/services/repositories';

interface ClientState {
  clients: Client[];
  meetings: Meeting[];
  tasks: Task[];
  currentClientId: string | null;
  setCurrentClient: (id: string | null) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
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
  currentClientId: null,
  setCurrentClient: (id) => set({ currentClientId: id }),
  addClient: (c) => {
    set((s) => ({ clients: [c, ...s.clients] }));
    void ClientsRepo.create(c).catch((e) => console.warn('[clients.create]', e));
  },
  updateClient: (id, patch) => {
    set((s) => ({
      clients: s.clients.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
      ),
    }));
    void ClientsRepo.update(id, patch).catch((e) => console.warn('[clients.update]', e));
  },
  getClient: (id) => get().clients.find((c) => c.id === id),
  addTask: (t) => {
    set((s) => ({ tasks: [t, ...s.tasks] }));
    void TasksRepo.create(t).catch((e) => console.warn('[tasks.create]', e));
  },
  updateTask: (id, patch) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    void TasksRepo.update(id, patch).catch((e) => console.warn('[tasks.update]', e));
  },
  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    void TasksRepo.remove(id).catch((e) => console.warn('[tasks.remove]', e));
  },
  tasksByClient: (clientId) => get().tasks.filter((t) => t.clientId === clientId),
  addMeeting: (m) => {
    set((s) => ({ meetings: [m, ...s.meetings] }));
    void MeetingsRepo.create(m).catch((e) => console.warn('[meetings.create]', e));
  },
  updateMeeting: (id, patch) => {
    set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    void MeetingsRepo.update(id, patch).catch((e) => console.warn('[meetings.update]', e));
  },
  deleteMeeting: (id) => {
    set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }));
    void MeetingsRepo.remove(id).catch((e) => console.warn('[meetings.remove]', e));
  },
  meetingsByClient: (clientId) => get().meetings.filter((m) => m.clientId === clientId),
}));
