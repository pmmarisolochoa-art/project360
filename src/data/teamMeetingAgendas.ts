import type { MeetingType } from '@/types/meeting';

/**
 * Agendas estándar de los rituales internos del equipo (Ikigai).
 * Se pre-cargan al crear la reunión para que dejen de improvisarse y se
 * controle la duración. Editables después en el drawer.
 */
export const TEAM_MEETING_AGENDAS: Partial<Record<MeetingType, { label: string; durationMin: number; agenda: string }>> = {
  daily: {
    label: 'Daily del equipo',
    durationMin: 30,
    agenda: [
      '🌅 DAILY DEL EQUIPO · meta 30 min',
      '',
      '1. Wins (5 min) — una noticia ganadora por persona',
      '2. Números del mes (10 min) — cash collected vs meta',
      '3. Ronda por área (10 min) — tráfico · ventas · ops · contenido',
      '4. Bloqueos del día (5 min)',
      '5. Compromisos (5 min) — cada uno con responsable Y fecha',
    ].join('\n'),
  },
  weekly_planning: {
    label: 'Planeación semanal',
    durationMin: 60,
    agenda: [
      '🗓️ PLANEACIÓN SEMANAL',
      '',
      '1. Objetivos de la semana',
      '2. Prioridades por área',
      '3. Responsables y dependencias',
      '4. Riesgos',
      '5. Compromisos de la semana (responsable + fecha)',
    ].join('\n'),
  },
  sprint_cierre: {
    label: 'Sprint de cierre',
    durationMin: 60,
    agenda: [
      '🏁 SPRINT DE CIERRE',
      '',
      '1. Resultados vs meta',
      '2. Qué funcionó / qué no',
      '3. Aprendizajes',
      '4. Ajustes para el próximo sprint',
      '5. Wins y reconocimientos',
    ].join('\n'),
  },
};
