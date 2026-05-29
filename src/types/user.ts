export type UserRole = 'owner' | 'pm' | 'team' | 'client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  whatsapp?: string;
  timezone: string;
  createdAt: string;
}

export type TeamRole =
  | 'estratega'
  | 'media_buyer'
  | 'copywriter'
  | 'designer'
  | 'community_manager'
  | 'funnel_developer';

export interface TeamMember {
  id: string;
  userId: string;
  clientId: string;
  role: TeamRole;
  kpis: Record<string, { target: number; current: number; unit: string }>;
}
