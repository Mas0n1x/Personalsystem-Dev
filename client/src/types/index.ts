export interface User {
  id: string;
  discordId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  email: string | null;
  role: Role | null;
  employee: Employee | null;
  permissions: string[];
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

export interface Employee {
  id: string;
  userId: string;
  user?: User;
  badgeNumber: string | null;
  rank: string;
  department: string;
  status: EmployeeStatus;
  hireDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_LEAVE' | 'TERMINATED';

export interface Application {
  id: string;
  applicantName: string;
  discordId: string | null;
  discordName: string | null;
  status: ApplicationStatus;
  notes: string | null;
  interviewDate: string | null;
  reviewer: User | null;
  createdBy: User | null;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus = 'PENDING' | 'INTERVIEW_SCHEDULED' | 'INTERVIEW_COMPLETED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export interface Evaluation {
  id: string;
  employeeId: string;
  employee: User;
  evaluatorId: string;
  evaluator: User;
  type: EvaluationType;
  rating: number;
  comment: string | null;
  isPositive: boolean;
  createdAt: string;
}

export type EvaluationType = 'PERFORMANCE' | 'WARNING' | 'COMMENDATION' | 'INVESTIGATION' | 'NOTE';

export interface Training {
  id: string;
  name: string;
  description: string | null;
  type: TrainingType;
  tutor: User;
  scheduledAt: string | null;
  completedAt: string | null;
  status: TrainingStatus;
  maxParticipants: number | null;
  participants: TrainingParticipant[];
  createdAt: string;
}

export type TrainingType = 'BASIC' | 'ADVANCED' | 'SPECIALIZATION' | 'CERTIFICATION' | 'REFRESHER';
export type TrainingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TrainingParticipant {
  id: string;
  trainingId: string;
  userId: string;
  user: User;
  passed: boolean | null;
  grade: string | null;
  notes: string | null;
}

export interface QualityReport {
  id: string;
  unit: string;
  rating: number;
  report: string;
  suggestions: string | null;
  reviewer: User;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  description: string | null;
  reference: string | null;
  user: User;
  createdAt: string;
}

export interface Evidence {
  id: string;
  name: string;
  description: string | null;
  value: number | null;
  status: EvidenceStatus;
  location: string | null;
  caseNumber: string | null;
  logs: EvidenceLog[];
  createdAt: string;
}

export type EvidenceStatus = 'IN_STORAGE' | 'CHECKED_OUT' | 'RELEASED' | 'DESTROYED';

export interface EvidenceLog {
  id: string;
  evidenceId: string;
  action: string;
  user: User;
  notes: string | null;
  createdAt: string;
}

export interface RobberyReport {
  id: string;
  date: string;
  location: string;
  damage: number;
  description: string;
  suspects: string | null;
  status: RobberyStatus;
  reporter: User;
  createdAt: string;
}

export type RobberyStatus = 'OPEN' | 'INVESTIGATING' | 'SOLVED' | 'CLOSED';

export interface SpecialPayment {
  id: string;
  user: User;
  amount: number;
  reason: string;
  status: PaymentStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Absence {
  id: string;
  user: User;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: AbsenceStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export type AbsenceType = 'VACATION' | 'SICK' | 'PERSONAL' | 'TRAINING' | 'OTHER';
export type AbsenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  discordChannelId: string | null;
  discordMessageId: string | null;
  publishedAt: string | null;
  author: User;
  createdAt: string;
}

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

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
  pendingApplications: number;
  upcomingTrainings: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  balance: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
