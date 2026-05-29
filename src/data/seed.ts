import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import type { Task } from '@/types/task';
import type { User } from '@/types/user';
import { generateAccentColor } from '@/utils/colorGenerator';
import { isoFromNow } from '@/utils/dateHelpers';

export const seedUser: User = {
  id: 'u_owner',
  email: 'estratega@salesbrain.os',
  name: 'Marisol Ochoa',
  role: 'owner',
  timezone: 'America/Bogota',
  createdAt: new Date().toISOString(),
};

export const seedClients: Client[] = [
  {
    id: 'c_fitmind',
    agencyId: 'a_1',
    name: 'FitMind Colombia',
    industry: 'Salud & Bienestar',
    businessType: 'Coaching / Mentoría',
    primaryColor: generateAccentColor('FitMind Colombia'),
    status: 'active',
    projectType: 'personal_brand',
    monthlyAdsBudget: 1200,
    adsConnected: { meta: true, google: false, tiktok: false, ga4: true },
    metrics: {
      roas: 3.4,
      pendingTasksToday: 4,
      nextMeetingAt: isoFromNow(0, 5),
      progressPercent: 62,
      bottleneck: null,
      invertedThisMonth: 1180,
      salesCount: 18,
      revenueAccumulated: 4860,
      monthlyRevenueTarget: 4500, // ratio = 1.08 → verde
    },
    onboardingData: {
      identity: {
        businessName: 'FitMind Colombia',
        founderName: 'Laura Restrepo',
        email: 'laura@fitmind.co',
        whatsapp: '+57 300 123 4567',
        industry: 'Salud & Bienestar',
        yearsInMarket: 4,
        country: 'Colombia',
        city: 'Medellín',
        website: 'https://fitmind.co',
        socials: { instagram: '@fitmind.co', tiktok: '@fitmind' },
      },
    },
    aiBrainData: {
      executiveSummary:
        'FitMind es una marca personal de coaching en nutrición consciente y regulación del sistema nervioso, con 4 años de trayectoria. Su fundadora Laura posiciona la marca con tono empático y educativo, atrayendo mujeres profesionales de 28-45 años que buscan bienestar sostenible sin dietas restrictivas.',
    },
    createdAt: isoFromNow(-14),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c_kuroko',
    agencyId: 'a_1',
    name: 'Kuroko Studio',
    industry: 'Moda & Streetwear',
    businessType: 'D2C Ecommerce',
    primaryColor: generateAccentColor('Kuroko Studio'),
    status: 'planning',
    projectType: 'ecommerce',
    monthlyAdsBudget: 800,
    adsConnected: { meta: false, google: false, tiktok: false, ga4: false },
    metrics: {
      roas: null,
      pendingTasksToday: 2,
      nextMeetingAt: isoFromNow(1, 3),
      progressPercent: 18,
      bottleneck: { role: 'Media Buyer', reason: 'Pendiente acceso a Business Manager' },
      invertedThisMonth: 540,
      salesCount: 6,
      revenueAccumulated: 1620,
      monthlyRevenueTarget: 2000, // ratio = 0.81 → amarillo
    },
    onboardingData: {
      identity: {
        businessName: 'Kuroko Studio',
        founderName: 'Andrés Salazar',
        email: 'andres@kuroko.studio',
        whatsapp: '+57 320 987 6543',
        industry: 'Moda & Streetwear',
        yearsInMarket: 2,
        country: 'Colombia',
        city: 'Bogotá',
        website: 'https://kuroko.studio',
        socials: { instagram: '@kuroko.studio', tiktok: '@kurokostudio' },
      },
    },
    aiBrainData: {},
    createdAt: isoFromNow(-7),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c_escueladigital',
    agencyId: 'a_1',
    name: 'Escuela Digital Pro',
    industry: 'EdTech',
    businessType: 'Infoproducto / Curso',
    primaryColor: generateAccentColor('Escuela Digital Pro'),
    status: 'onboarding',
    projectType: 'launch',
    monthlyAdsBudget: 3500,
    adsConnected: { meta: false, google: false, tiktok: false, ga4: false },
    metrics: {
      roas: null,
      pendingTasksToday: 6,
      nextMeetingAt: isoFromNow(0, 26),
      progressPercent: 8,
      bottleneck: { role: 'Estratega', reason: 'Falta validar oferta principal' },
      invertedThisMonth: 0,
      salesCount: 0,
      revenueAccumulated: 0,
      monthlyRevenueTarget: null, // sin target → sin color
    },
    onboardingData: {
      identity: {
        businessName: 'Escuela Digital Pro',
        founderName: 'Camila Torres',
        email: 'camila@escueladigital.pro',
        whatsapp: '+52 55 8123 9090',
        industry: 'EdTech / Marketing',
        yearsInMarket: 3,
        country: 'México',
        city: 'CDMX',
        socials: { instagram: '@escueladigital.pro', youtube: 'EscuelaDigitalPro' },
      },
    },
    aiBrainData: {},
    createdAt: isoFromNow(-1),
    updatedAt: new Date().toISOString(),
  },
];

export const seedMeetings: Meeting[] = [
  {
    id: 'm_1',
    clientId: 'c_fitmind',
    title: 'Revisión semanal de métricas',
    type: 'weekly_metrics',
    scheduledAt: isoFromNow(0, 5),
    durationMin: 45,
    participants: [{ userId: 'u_owner', name: 'Marisol' }, { userId: 'u_c1', name: 'Laura' }],
    videoCallLink: 'https://meet.google.com/abc-defg-hij',
    agenda: '1. Revisión de métricas de la semana\n2. Análisis de campañas activas\n3. Ajustes de presupuesto\n4. Próximos pasos y compromisos',
    notes: 'Última semana ROAS subió a 3.4x. Pendiente decidir si escalamos el ad set "Regulación nerviosa".',
    notesUpdatedAt: isoFromNow(-1),
  },
  {
    id: 'm_2',
    clientId: 'c_kuroko',
    title: 'Sesión estratégica de contenido',
    type: 'content_strategy',
    scheduledAt: isoFromNow(1, 3),
    durationMin: 60,
    participants: [{ userId: 'u_owner', name: 'Marisol' }, { userId: 'u_c2', name: 'Andrés' }],
  },
  {
    id: 'm_3',
    clientId: 'c_escueladigital',
    title: 'Kickoff de lanzamiento',
    type: 'kickoff',
    scheduledAt: isoFromNow(2, 2),
    durationMin: 90,
    participants: [{ userId: 'u_owner', name: 'Marisol' }, { userId: 'u_c3', name: 'Camila' }],
  },
  {
    id: 'm_4',
    clientId: 'c_fitmind',
    title: 'Revisión de campañas ADS',
    type: 'ads_review',
    scheduledAt: isoFromNow(3, 4),
    durationMin: 30,
    participants: [{ userId: 'u_owner', name: 'Marisol' }],
  },
];

export const seedTasks: Task[] = [
  {
    id: 't_1', clientId: 'c_fitmind', title: 'Optimizar copy del Reel #34',
    description: 'Reescribir hook usando lenguaje del avatar principal.',
    status: 'in_progress', priority: 'P1', assignedTo: 'Laura Mejía',
    dueDate: isoFromNow(0, 6), isDelayed: false, delayDays: 0,
    moduleTag: 'content', createdAt: isoFromNow(-2),
  },
  {
    id: 't_2', clientId: 'c_kuroko', title: 'Solicitar acceso a Business Manager',
    description: 'Sin acceso no podemos lanzar campañas — bloquea fase 1.',
    status: 'blocked', priority: 'P1', assignedTo: 'Diego Ramírez',
    dueDate: isoFromNow(-1), isDelayed: true, delayDays: 1,
    moduleTag: 'ads', createdAt: isoFromNow(-5),
  },
  {
    id: 't_3', clientId: 'c_fitmind', title: 'Revisar performance de campaña Awareness',
    status: 'pending', priority: 'P2', assignedTo: 'Diego Ramírez',
    dueDate: isoFromNow(1, 0), isDelayed: false, delayDays: 0,
    moduleTag: 'ads', createdAt: isoFromNow(-1),
  },
  {
    id: 't_4', clientId: 'c_fitmind', title: 'Aprobar storyboard del Reel "regulación nerviosa"',
    status: 'in_review', priority: 'P2', assignedTo: 'Marisol Ochoa',
    dueDate: isoFromNow(0, 3), isDelayed: false, delayDays: 0,
    moduleTag: 'content', createdAt: isoFromNow(-3),
  },
  {
    id: 't_5', clientId: 'c_fitmind', title: 'Setup tracking conversiones GA4',
    status: 'completed', priority: 'P1', assignedTo: 'Diego Ramírez',
    dueDate: isoFromNow(-2), completedAt: isoFromNow(-1), isDelayed: false, delayDays: 0,
    moduleTag: 'tech', createdAt: isoFromNow(-7),
  },
  {
    id: 't_6', clientId: 'c_kuroko', title: 'Definir 3 ángulos de comunicación iniciales',
    status: 'in_progress', priority: 'P1', assignedTo: 'Camila Mora',
    dueDate: isoFromNow(2), isDelayed: false, delayDays: 0,
    moduleTag: 'strategy', createdAt: isoFromNow(-2),
  },
  {
    id: 't_7', clientId: 'c_escueladigital', title: 'Validar oferta principal con 5 clientes pasados',
    status: 'pending', priority: 'P1', assignedTo: 'Marisol Ochoa',
    dueDate: isoFromNow(3), isDelayed: false, delayDays: 0,
    moduleTag: 'strategy', createdAt: isoFromNow(-1),
  },
  {
    id: 't_8', clientId: 'c_escueladigital', title: 'Definir cuenta regresiva del lanzamiento (45 días)',
    status: 'in_progress', priority: 'P2', assignedTo: 'Marisol Ochoa',
    dueDate: isoFromNow(5), isDelayed: false, delayDays: 0,
    moduleTag: 'launch', createdAt: isoFromNow(-1),
  },
  {
    id: 't_9', clientId: 'c_fitmind', title: 'Cerrar contrato con diseñadora freelance',
    status: 'pending', priority: 'P3', assignedTo: 'Marisol Ochoa',
    dueDate: isoFromNow(7), isDelayed: false, delayDays: 0,
    moduleTag: 'ops', createdAt: isoFromNow(-1),
  },
];
