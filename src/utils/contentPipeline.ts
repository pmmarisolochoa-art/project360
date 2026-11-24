import { differenceInDays, parseISO } from 'date-fns';
import type { ContentPiece, ContentStatus } from '@/types/content';

export const DIAS_ATASCADA = 7;

/** Piezas "vivas" — todavía no llegaron a su destino final del pipeline. */
export const ESTADOS_ABIERTOS: ContentStatus[] = [
  'not_started', 'recording', 'editing', 'review', 'sent_to_client', 'rejected', 'approved',
];

export function diasEnPipeline(piece: ContentPiece): number {
  return differenceInDays(new Date(), parseISO(piece.createdAt));
}

export function estaAtascada(piece: ContentPiece): boolean {
  return ESTADOS_ABIERTOS.includes(piece.status) && diasEnPipeline(piece) >= DIAS_ATASCADA;
}
