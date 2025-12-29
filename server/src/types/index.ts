import { User } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  discordId: string;
  username: string;
}

export interface AuthenticatedRequest extends Express.Request {
  user?: User;
  userId?: string;
}

export interface DiscordUserInfo {
  id: string;
  username: string;
  global_name?: string;
  avatar?: string;
  email?: string;
}

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  pendingApplications: number;
  recentTransactions: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  upcomingTrainings: number;
}

export type PermissionName =
  | 'admin.full'
  | 'users.view'
  | 'users.edit'
  | 'users.delete'
  | 'employees.view'
  | 'employees.edit'
  | 'employees.delete'
  | 'hr.view'
  | 'hr.manage'
  | 'hr.applications'
  | 'ia.view'
  | 'ia.manage'
  | 'ia.investigate'
  | 'academy.view'
  | 'academy.manage'
  | 'academy.teach'
  | 'qa.view'
  | 'qa.manage'
  | 'finance.view'
  | 'finance.manage'
  | 'finance.approve'
  | 'announcements.view'
  | 'announcements.create'
  | 'announcements.publish'
  | 'audit.view'
  | 'backup.manage';
