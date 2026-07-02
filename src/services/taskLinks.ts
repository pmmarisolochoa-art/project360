import { supabase } from './supabase';

/** Un link/entregable que el equipo sube a una tarea (tabla task_links, migración 019). */
export interface TaskLink {
  id: string;
  taskId: string;
  clientId: string;
  nombre: string;
  url: string;
  tipo: 'entregable' | 'referencia' | 'drive' | 'notion' | 'loom' | 'web' | 'otro';
  createdBy: string | null;
  createdAt: string;
}

function rowToLink(r: Record<string, unknown>): TaskLink {
  const x = r as Record<string, any>;
  return {
    id: x.id,
    taskId: x.task_id,
    clientId: x.client_id,
    nombre: x.nombre,
    url: x.url,
    tipo: x.tipo ?? 'entregable',
    createdBy: x.created_by ?? null,
    createdAt: x.created_at,
  };
}

export const TaskLinksRepo = {
  /** Links de las tareas de un conjunto de clientes (para dashboards / repo). */
  async listByClientIds(clientIds: string[]): Promise<TaskLink[]> {
    if (!supabase || clientIds.length === 0) return [];
    const { data, error } = await supabase
      .from('task_links')
      .select('*')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[taskLinks.listByClientIds]', error);
      return [];
    }
    return (data ?? []).map(rowToLink);
  },

  /** Links de una tarea concreta. */
  async listByTask(taskId: string): Promise<TaskLink[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('task_links')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[taskLinks.listByTask]', error);
      return [];
    }
    return (data ?? []).map(rowToLink);
  },

  /**
   * Crea un link/entregable. created_by lo asigna el servidor (DEFAULT
   * auth.uid(), migración 019b). Lanza si falla, para que la UI lo muestre.
   */
  async create(input: {
    taskId: string;
    clientId: string;
    nombre: string;
    url: string;
    tipo?: TaskLink['tipo'];
  }): Promise<TaskLink | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('task_links')
      .insert({
        task_id: input.taskId,
        client_id: input.clientId,
        nombre: input.nombre,
        url: input.url,
        tipo: input.tipo ?? 'entregable',
      })
      .select('*')
      .single();
    if (error) {
      console.warn('[taskLinks.create]', error);
      throw new Error(error.message);
    }
    return rowToLink(data);
  },

  async remove(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('task_links').delete().eq('id', id);
    if (error) console.warn('[taskLinks.remove]', error);
  },
};
