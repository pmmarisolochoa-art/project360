import { supabase } from '@/services/supabase';

/**
 * El service worker guarda una copia de las lecturas de Supabase (estrategia
 * NetworkFirst, solo para cuando no hay conexión). Esa copia son datos de la
 * persona que inició sesión: al cerrar sesión se borra, para que en un equipo
 * compartido nadie vea sin conexión los datos de otra cuenta.
 *
 * Nombre de la caché: debe coincidir con `cacheName` en vite.config.ts.
 */
const SUPABASE_DATA_CACHE = 'supabase-data';

export function limpiarCacheAlSalir(): void {
  if (!supabase || typeof caches === 'undefined') return;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      caches.delete(SUPABASE_DATA_CACHE).catch(() => {
        /* sin caché que borrar: nada que hacer */
      });
    }
  });
}
