import { z } from 'zod';

// Cada paso tiene su propio schema para validación incremental por paso.
// `OnboardingFormSchema` es la unión completa que se envía a Claude al final.

export const step1Schema = z.object({
  businessName: z.string().min(2, 'Requerido'),
  founderName: z.string().min(2, 'Requerido'),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().min(7, 'Incluye código de país'),
  industry: z.string().min(2, 'Selecciona una industria'),
  industryOther: z.string().optional(),
  yearsInMarket: z.coerce.number().int().min(0).max(150),
  country: z.string().min(2, 'Requerido'),
  city: z.string().min(2, 'Requerido'),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  socials: z.array(z.string()).default([]),
  socialUrls: z.record(z.string(), z.string().optional()).default({}),
  logoUrl: z.string().optional(),
});

export const step2Schema = z.object({
  whatYouSell: z.string().min(20, 'Describe con más detalle'),
  businessType: z.string().min(1, 'Selecciona un tipo'),
  averageTicket: z.coerce.number().min(0),
  currency: z.string().min(3),
  starProduct: z.string().min(2, 'Requerido'),
  otherProducts: z.string().optional(),
  revenueModel: z.string().min(1, 'Selecciona un modelo'),
});

export const step3Schema = z.object({
  monthlyRevenue: z.string().min(1, 'Selecciona un rango'),
  newClientsMonth: z.coerce.number().int().min(0),
  acquisitionChannels: z.array(z.string()).min(1, 'Selecciona al menos uno'),
  hasFunnel: z.enum(['yes', 'no', 'building']),
  funnelDescription: z.string().optional(),
  currentAdsBudget: z.string().min(1, 'Selecciona un rango'),
  top3Channels: z.string().min(3, 'Requerido'),
  closeRate: z.coerce.number().min(0).max(100),
  hasCrm: z.enum(['yes', 'no']),
  crmName: z.string().optional(),
});

export const step4Schema = z.object({
  idealClientDescription: z.string().min(40, 'Necesitamos más contexto (mín 40 caracteres)'),
  ageRange: z.tuple([z.coerce.number(), z.coerce.number()]),
  predominantGender: z.string().min(1),
  socioeconomicLevel: z.string().min(1),
  topPains: z.string().min(10, 'Requerido'),
  topDesires: z.string().min(10, 'Requerido'),
  objections: z.string().min(10, 'Requerido'),
  clientLanguage: z.string().optional(),
  onlineHangouts: z.array(z.string()).default([]),
  consumedBrands: z.string().optional(),
});

export const step5Schema = z.object({
  revenue3m: z.coerce.number().min(0),
  revenue6m: z.coerce.number().min(0),
  revenue12m: z.coerce.number().min(0),
  newClientsNeeded: z.coerce.number().int().min(0),
  primaryObjectives: z.array(z.string()).min(1, 'Selecciona al menos uno'),
  successDefinition: z.string().min(20, 'Requerido'),
  adsBudgetMonthly: z.string().min(1),
  contentBudgetMonthly: z.string().optional(),
  idealStartDate: z.string().min(1, 'Requerido'),
});

export const step6Schema = z.object({
  competitor1: z.string().min(1, 'Requerido'),
  competitor2: z.string().min(1, 'Requerido'),
  competitor3: z.string().min(1, 'Requerido'),
  competitorsStrengths: z.string().optional(),
  competitorsWeaknesses: z.string().optional(),
  differentiator: z.string().min(10, 'Requerido'),
  hasSeasonality: z.enum(['yes', 'no']),
  seasonalityDescription: z.string().optional(),
  marketSize: z.string().min(1),
  externalEvents: z.string().optional(),
});

export const step7Schema = z.object({
  hasVisualIdentity: z.enum(['yes', 'no', 'partial']),
  hasBrandManual: z.enum(['yes', 'no']),
  brandManualUrl: z.string().optional(),
  tone: z.array(z.string()).min(1, 'Selecciona al menos uno'),
  topPerformingContent: z.string().optional(),
  hasTestimonials: z.enum(['yes', 'no']),
  testimonialsDescription: z.string().optional(),
  contentProducer: z.enum(['solo', 'team', 'outsource', 'nobody']),
  videoCapability: z.enum(['studio', 'basic', 'none']),
  authorityTopics: z.string().optional(),
  forbiddenTopics: z.string().optional(),
});

export const step8Schema = z.object({
  teamSize: z.coerce.number().int().min(0),
  teamRoles: z.array(z.string()).default([]),
  projectParticipants: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        email: z.string().email(),
        whatsapp: z.string().min(7),
      }),
    )
    .default([]),
  currentTools: z.array(z.string()).default([]),
  adsAccess: z.array(z.string()).default([]),
  preferredMeetingTime: z.string().min(1),
  timezone: z.string().min(1),
  restrictions: z.string().optional(),
  additionalInfo: z.string().optional(),
});

export const onboardingSchema = z.object({
  step1: step1Schema,
  step2: step2Schema,
  step3: step3Schema,
  step4: step4Schema,
  step5: step5Schema,
  step6: step6Schema,
  step7: step7Schema,
  step8: step8Schema,
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type Step5Data = z.infer<typeof step5Schema>;
export type Step6Data = z.infer<typeof step6Schema>;
export type Step7Data = z.infer<typeof step7Schema>;
export type Step8Data = z.infer<typeof step8Schema>;
export type OnboardingData = z.infer<typeof onboardingSchema>;

export const stepSchemas = [
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  step7Schema,
  step8Schema,
] as const;

export const stepTitles = [
  'Identidad del negocio',
  'El negocio y su modelo',
  'Situación actual',
  'El cliente ideal',
  'Objetivos y metas',
  'Competencia y mercado',
  'Contenido y comunicación',
  'Equipo y operación',
] as const;

export const stepSubtitles = [
  'Quién eres y cómo te encontramos',
  'Qué vendes y a qué precio',
  'De dónde partimos',
  'Para quién es esto realmente',
  'A dónde quieres llegar',
  'Contra quién juegas',
  'Cómo suena tu marca',
  'Con qué cuentas para ejecutar',
] as const;
