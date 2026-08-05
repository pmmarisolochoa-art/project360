import { supabase } from './supabase';

/** Un link/entregable que el equipo sube a una tarea (tabla task_links, migración 019). */
export type TaskLinkTipo = 'entregable' | 'referencia' | 'drive' | 'notion' | 'loom' | 'web' | 'otro';
/** Revisión del PM. */
export type TaskLinkEstado = 'pendiente' | 'aprobado' | 'correcciones';
/** De dónde salió el link. */
export type TaskLinkFuente = 'tarea' | 'manual';

export interface TaskLink {
  id: string;
  /** Null en los links manuales, que no nacen de una tarea. */
  taskId: string | null;
  clientId: string;
  nombre: string;
  url: string;
  tipo: TaskLinkTipo;
  createdBy: string | null;
  /** Nombre visible de quien lo subió (copiado al insertar). */
  createdByNombre: string | null;
  createdAt: string;
  /* ── Trazabilidad (migración 031) ─────────────────────────────────────── */
  fuente: TaskLinkFuente;
  estado: TaskLinkEstado;
  /** Reunión de la que venía la tarea que originó el entregable. */
  meetingId: string | null;
  notas?: string;
}

export const TASK_LINK_ESTADO_LABEL: Record<TaskLinkEstado, string> = {
  pendiente: 'Pendiente revisión',
  aprobado: 'Aprobado',
  correcciones: 'Con correcciones',
};

export const TASK_LINK_ESTADO_TONE: Record<TaskLinkEstado, 'neutral' | 'success' | 'warning'> = {
  pendiente: 'neutral',
  aprobado: 'success',
  correcciones: 'warning',
};

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
    createdByNombre: x.created_by_nombre ?? null,
    createdAt: x.created_at,
    fuente: x.fuente ?? 'tarea',
    estado: x.estado ?? 'pendiente',
    meetingId: x.meeting_id ?? null,
    notas: x.notas ?? undefined,
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
    /** Null solo en links manuales del PM. */
    taskId: string | null;
    clientId: string;
    nombre: string;
    url: string;
    tipo?: TaskLinkTipo;
    fuente?: TaskLinkFuente;
    /** Reunión de origen. Si no se pasa y hay tarea, se hereda de la tarea. */
    meetingId?: string | null;
    notas?: string;
    /** Nombre visible de quien sube. Se copia para no depender de un join. */
    createdByNombre?: string;
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
        fuente: input.fuente ?? (input.taskId ? 'tarea' : 'manual'),
        meeting_id: input.meetingId ?? null,
        notas: input.notas ?? null,
        created_by_nombre: input.createdByNombre ?? null,
      })
      .select('*')
      .single();
    if (error) {
      console.warn('[taskLinks.create]', error);
      throw new Error(error.message);
    }
    return rowToLink(data);
  },

  /** Revisión del PM: aprobar o pedir correcciones (policy nueva de la 031). */
  async setEstado(id: string, estado: TaskLinkEstado): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('task_links').update({ estado }).eq('id', id);
    if (error) {
      console.warn('[taskLinks.setEstado]', error);
      throw new Error(error.message);
    }
  },

  async remove(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('task_links').delete().eq('id', id);
    if (error) console.warn('[taskLinks.remove]', error);
  },
};
