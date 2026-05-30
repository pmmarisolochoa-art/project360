/**
 * Genera un UUID v4 válido para usar como ID de row en Supabase.
 * Usa crypto.randomUUID() del browser/node nativo cuando está disponible
 * (siempre lo está en navegadores modernos y Node 19+).
 *
 * Importante: Supabase tiene columnas `uuid` que rechazan formatos como
 * `ct_abc123` con error 22P02 "invalid input syntax for type uuid".
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (no debería ejecutarse en runtimes modernos)
  const hex = (n: number) => Math.floor(Math.random() * n).toString(16);
  return `${hex(0x100000000).padStart(8, '0')}-${hex(0x10000).padStart(4, '0')}-4${hex(0x1000).padStart(3, '0')}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(0x1000).padStart(3, '0')}-${hex(0x1000000000000).padStart(12, '0')}`;
}
