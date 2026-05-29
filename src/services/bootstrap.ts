import { ClientsRepo } from './repositories';
import { usingRemote } from './supabase';
import { useClientStore } from '@/store/useClientStore';

/**
 * Llamado al iniciar la app. Si hay Supabase configurado, hidrata los stores
 * con datos remotos; si no, deja el seed in-memory intacto.
 *
 * Para escenarios reales, expandir para precargar agencia activa, equipo, etc.
 */
export async function bootstrapFromRemote(): Promise<{ source: 'remote' | 'local' }> {
  if (!usingRemote) return { source: 'local' };
  try {
    const clients = await ClientsRepo.list();
    if (clients.length > 0) {
      useClientStore.setState({ clients });
    }
    return { source: 'remote' };
  } catch (e) {
    console.warn('[bootstrap] Supabase fetch failed — usando seed local.', e);
    return { source: 'local' };
  }
}
