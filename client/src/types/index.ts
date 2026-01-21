export interface User {
  id: string;
  discordId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  email: string | null;
  roles: Role[];  // Geändert: User kann mehrere Rollen haben
  employee: Employee | null;
  permissions: string[];  // Zusammengefasste Permissions aus allen Rollen
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  color: string;
  discordRoleId: string | null;
  level: number;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

export interface Absence {
  id: string;
  type: 'ABSENCE' | 'DAY_OFF';
  status?: string;
  reason?: string | null;
  startDate: string;
  endDate: string;
  createdAt?: string;
}

export interface Employee {
  id: string;
  userId: string;
  user?: User;
  badgeNumber: string | null;
  rank: string;
  rankLevel: number;
  department: string;
  status: EmployeeStatus;
  hireDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  absences?: Absence[];
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_LEAVE' | 'TERMINATED';

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  user: User | null;
  createdAt: string;
}

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Evaluation {
  id: string;
  type: string;
  rating: number;
  comment: string | null;
  evaluator: {
    username: string;
    displayName: string | null;
  } | null;
  createdAt: string;
}

