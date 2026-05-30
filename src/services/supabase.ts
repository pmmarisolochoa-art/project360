import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Sanitiza agresivamente: quita TODO whitespace (incluido \r, \n, espacios)
// que Vercel/Vite pueden colar al copiar JWTs largos.
function sanitize(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const cleaned = v.replace(/\s+/g, '');
  return cleaned.length > 0 ? cleaned : undefined;
}

const url = sanitize(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const anonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (typeof window !== 'undefined') {
  // Debug: estado de las env vars (sin imprimir secretos)
  // eslint-disable-next-line no-console
  console.info(
    '[supabase] init',
    JSON.stringify({
      hasUrl: !!url,
      urlOk: url?.startsWith('https://') ?? false,
      hasKey: !!anonKey,
      keyLen: anonKey?.length ?? 0,
      keyStartsEyJ: anonKey?.startsWith('eyJ') ?? false,
    }),
  );
}

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null;

export const usingRemote = !!supabase;
