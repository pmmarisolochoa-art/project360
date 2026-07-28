import type { Client } from '@/types/client';

/**
 * Deriva una sigla corta a partir del nombre del cliente.
 *  - "David Guerrero" → "DG"
 *  - "Andrea Torres"  → "AT"
 *  - "Ikigai"         → "IK"
 * Toma la inicial de las 2 primeras palabras; si es una sola palabra, sus 2
 * primeras letras. En mayúsculas.
 */
export function siglaFromName(name: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Sigla a mostrar: la editada por el usuario o, si no hay, la derivada del nombre. */
export function clientSigla(client: Pick<Client, 'name' | 'sigla'>): string {
  const s = (client.sigla ?? '').trim();
  return s ? s.toUpperCase() : siglaFromName(client.name);
}
