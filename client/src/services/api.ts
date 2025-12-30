import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response Interceptor für Fehlerbehandlung
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || 'Ein Fehler ist aufgetreten';

    // Bei 401 zur Login-Seite weiterleiten (außer wenn wir bereits auf /login sind oder /auth/me aufrufen)
    if (error.response?.status === 401) {
      const isAuthMeRequest = error.config?.url === '/auth/me';
      const isOnLoginPage = window.location.pathname === '/login';
      const isOnCallbackPage = window.location.pathname === '/auth/callback';

      // Nur weiterleiten wenn wir nicht bereits auf Login/Callback sind und es kein /auth/me Request ist
      if (!isAuthMeRequest && !isOnLoginPage && !isOnCallbackPage) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Bei 403 Berechtigungsfehler anzeigen
    if (error.response?.status === 403) {
      toast.error('Keine Berechtigung für diese Aktion');
      return Promise.reject(error);
    }

    // Sonstige Fehler anzeigen (außer bei auth/me - das ist erwartetes Verhalten)
    if (error.response?.status >= 400 && error.config?.url !== '/auth/me') {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  getDiscordUrl: () => api.get<{ url: string }>('/auth/discord'),
  callback: (code: string) => api.post('/auth/discord/callback', { code }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Users API
export const usersApi = {
  getAll: (params?: Record<string, string>) => api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// Employees API
export const employeesApi = {
  getAll: (params?: Record<string, string>) => api.get('/employees', { params }),
  getById: (id: string) => api.get(`/employees/${id}`),
  create: (data: Record<string, unknown>) => api.post('/employees', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
  getStats: () => api.get('/employees/stats/overview'),
  uprank: (id: string) => api.post(`/employees/${id}/uprank`),
  downrank: (id: string) => api.post(`/employees/${id}/downrank`),
  getUnits: (id: string) => api.get(`/employees/${id}/units`),
  setUnits: (id: string, unitRoleIds: string[]) => api.post(`/employees/${id}/units`, { unitRoleIds }),
  terminate: (id: string, reason?: string) => api.post(`/employees/${id}/terminate`, { reason }),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getActivity: (limit?: number) => api.get('/dashboard/activity', { params: { limit } }),
  getOnlineUsers: () => api.get('/dashboard/online-users'),
  getMyOverview: () => api.get('/dashboard/my-overview'),
};

// Admin API
export const adminApi = {
  // Roles
  getRoles: () => api.get('/admin/roles'),
  createRole: (data: Record<string, unknown>) => api.post('/admin/roles', data),
  updateRole: (id: string, data: Record<string, unknown>) => api.put(`/admin/roles/${id}`, data),
  deleteRole: (id: string) => api.delete(`/admin/roles/${id}`),

  // Permissions
  getPermissions: () => api.get('/admin/permissions'),
  seedPermissions: () => api.post('/admin/permissions/seed'),

  // Discord
  getDiscordInfo: () => api.get('/admin/discord/info'),
  syncRoles: () => api.post('/admin/discord/sync-roles'),
  syncMembers: () => api.post('/admin/discord/sync-members'),

  // Audit Logs
  getAuditLogs: (params?: Record<string, string>) => api.get('/admin/audit-logs', { params }),

  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data: Record<string, string>) => api.put('/admin/settings', data),

  // Backups
  getBackups: (params?: Record<string, string>) => api.get('/admin/backups', { params }),

  // Stats
  getStats: () => api.get('/admin/stats'),
};

// Absences API
export const absencesApi = {
  getAll: (params?: Record<string, string>) => api.get('/absences', { params }),
  getActive: () => api.get('/absences/active'),
  getByEmployee: (employeeId: string, limit?: number) =>
    api.get(`/absences/employee/${employeeId}`, { params: { limit } }),
  create: (data: { type: string; reason?: string; startDate: string; endDate: string }) =>
    api.post('/absences', data),
  delete: (id: string) => api.delete(`/absences/${id}`),
};

// Tasks API
export const tasksApi = {
  getAll: (params?: Record<string, string>) => api.get('/tasks', { params }),
  create: (data: { title: string; description?: string; assigneeId?: string; priority?: string; dueDate?: string }) =>
    api.post('/tasks', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/tasks/${id}`, data),
  updateStatus: (id: string, status: string) => api.put(`/tasks/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// Sanctions API
export const sanctionsApi = {
  getAll: (params?: Record<string, string>) => api.get('/sanctions', { params }),
  getByEmployee: (employeeId: string) => api.get(`/sanctions/employee/${employeeId}`),
  create: (data: { employeeId: string; hasWarning: boolean; hasFine: boolean; hasMeasure: boolean; reason: string; amount?: number; measure?: string; expiresAt?: string }) =>
    api.post('/sanctions', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/sanctions/${id}`, data),
  revoke: (id: string) => api.put(`/sanctions/${id}/revoke`),
  delete: (id: string) => api.delete(`/sanctions/${id}`),
};

// Treasury API
export const treasuryApi = {
  get: () => api.get('/treasury'),
  getTransactions: (params?: Record<string, string>) => api.get('/treasury/transactions', { params }),
  deposit: (data: { moneyType: string; amount: number; reason: string }) =>
    api.post('/treasury/deposit', data),
  withdraw: (data: { moneyType: string; amount: number; reason: string }) =>
    api.post('/treasury/withdraw', data),
};

// Notes API
export const notesApi = {
  getAll: (params?: Record<string, string>) => api.get('/notes', { params }),
  create: (data: { title: string; content: string; category?: string }) =>
    api.post('/notes', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/notes/${id}`, data),
  togglePin: (id: string) => api.put(`/notes/${id}/pin`),
  delete: (id: string) => api.delete(`/notes/${id}`),
};

// Announcements API
export const announcementsApi = {
  getAll: () => api.get('/announcements'),
  getChannels: () => api.get('/announcements/channels'),
  create: (data: { title: string; content: string; channelId?: string }) =>
    api.post('/announcements', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/announcements/${id}`, data),
  send: (id: string) => api.post(`/announcements/${id}/send`),
  sendDirect: (data: { title: string; content: string; channelId: string }) =>
    api.post('/announcements/send-direct', data),
  delete: (id: string) => api.delete(`/announcements/${id}`),
};

// Evidence API (Asservate)
export const evidenceApi = {
  getAll: (params?: Record<string, string>) => api.get('/evidence', { params }),
  getStats: () => api.get('/evidence/stats'),
  create: (data: { name: string; description?: string; category?: string; quantity?: number; location?: string; caseNumber?: string }) =>
    api.post('/evidence', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/evidence/${id}`, data),
  release: (id: string, data: { status: string; releaseReason?: string }) => api.put(`/evidence/${id}/release`, data),
  restore: (id: string) => api.put(`/evidence/${id}/restore`),
  destroyBulk: (ids: string[]) => api.put('/evidence/destroy-bulk', { ids }),
  delete: (id: string) => api.delete(`/evidence/${id}`),
};

// Tuning API
export const tuningApi = {
  getAll: () => api.get('/tuning'),
  getStats: () => api.get('/tuning/stats'),
  getImageUrl: (filename: string) => `/api/tuning/image/${filename}`,
  create: (formData: FormData) => api.post('/tuning', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  complete: (id: string) => api.put(`/tuning/${id}/complete`),
  delete: (id: string) => api.delete(`/tuning/${id}`),
};

// Robbery API (Räube)
export const robberyApi = {
  getAll: () => api.get('/robbery'),
  getStats: () => api.get('/robbery/stats'),
  getEmployees: () => api.get('/robbery/employees'),
  getImageUrl: (filename: string) => `/api/robbery/image/${filename}`,
  create: (formData: FormData) => api.post('/robbery', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id: string) => api.delete(`/robbery/${id}`),
};

// Blacklist API
export const blacklistApi = {
  getAll: () => api.get('/blacklist'),
  getStats: () => api.get('/blacklist/stats'),
  check: (discordId: string) => api.get(`/blacklist/check/${discordId}`),
  create: (data: { discordId: string; username: string; reason: string; expiresAt?: string }) =>
    api.post('/blacklist', data),
  update: (id: string, data: { reason?: string; expiresAt?: string }) =>
    api.put(`/blacklist/${id}`, data),
  delete: (id: string) => api.delete(`/blacklist/${id}`),
};

// Uprank-Sperren API
export const uprankLockApi = {
  getAll: () => api.get('/uprank-locks'),
  getStats: () => api.get('/uprank-locks/stats'),
  getByEmployee: (employeeId: string) => api.get(`/uprank-locks/employee/${employeeId}`),
  createAuto: (data: { employeeId: string; team: string }) =>
    api.post('/uprank-locks/auto', data),
  create: (data: { employeeId: string; reason: string; lockedUntil: string }) =>
    api.post('/uprank-locks', data),
  revoke: (id: string) => api.put(`/uprank-locks/${id}/revoke`),
  delete: (id: string) => api.delete(`/uprank-locks/${id}`),
};

// Bewerbungen API
export const applicationApi = {
  getAll: (params?: Record<string, string>) => api.get('/applications', { params }),
  getStats: () => api.get('/applications/stats'),
  checkBlacklist: (discordId: string) => api.get(`/applications/check-blacklist/${discordId}`),
  create: (data: { discordId: string; discordUsername: string; notes?: string }) =>
    api.post('/applications', data),
  update: (id: string, data: { notes?: string; interviewDate?: string; interviewNotes?: string }) =>
    api.put(`/applications/${id}`, data),
  scheduleInterview: (id: string, interviewDate: string) =>
    api.put(`/applications/${id}/schedule-interview`, { interviewDate }),
  accept: (id: string, interviewNotes?: string) =>
    api.put(`/applications/${id}/accept`, { interviewNotes }),
  reject: (id: string, data: { rejectionReason: string; addToBlacklist?: boolean; blacklistReason?: string; blacklistExpires?: string }) =>
    api.put(`/applications/${id}/reject`, data),
  delete: (id: string) => api.delete(`/applications/${id}`),
};

// Ermittlungsakten API (Detectives)
export const casesApi = {
  getAll: (params?: Record<string, string>) => api.get('/cases', { params }),
  getStats: () => api.get('/cases/stats'),
  getById: (id: string) => api.get(`/cases/${id}`),
  getEmployees: () => api.get('/cases/employees'),
  getImageUrl: (filename: string) => `/api/cases/image/${filename}`,
  create: (data: { title: string; description?: string; priority?: string; suspects?: string; notes?: string; leadInvestigatorId?: string }) =>
    api.post('/cases', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/cases/${id}`, data),
  uploadImage: (id: string, formData: FormData) => api.post(`/cases/${id}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteImage: (imageId: string) => api.delete(`/cases/images/${imageId}`),
  delete: (id: string) => api.delete(`/cases/${id}`),
};

// Trainings API (Police Academy)
export const trainingsApi = {
  // Training Types
  getTypes: () => api.get('/trainings/types'),
  createType: (data: { name: string; description?: string; duration?: number }) =>
    api.post('/trainings/types', data),
  updateType: (id: string, data: Record<string, unknown>) =>
    api.put(`/trainings/types/${id}`, data),
  deleteType: (id: string) => api.delete(`/trainings/types/${id}`),

  // Trainings
  getAll: (params?: Record<string, string>) => api.get('/trainings', { params }),
  getStats: () => api.get('/trainings/stats'),
  getById: (id: string) => api.get(`/trainings/${id}`),
  getEmployees: () => api.get('/trainings/employees'),
  create: (data: { typeId: string; title: string; description?: string; scheduledAt: string; location?: string; maxParticipants?: number; notes?: string }) =>
    api.post('/trainings', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/trainings/${id}`, data),
  delete: (id: string) => api.delete(`/trainings/${id}`),

  // Participants
  addParticipant: (trainingId: string, employeeId: string) =>
    api.post(`/trainings/${trainingId}/participants`, { employeeId }),
  updateParticipant: (trainingId: string, participantId: string, data: { status?: string; grade?: string; feedback?: string }) =>
    api.put(`/trainings/${trainingId}/participants/${participantId}`, data),
  removeParticipant: (trainingId: string, participantId: string) =>
    api.delete(`/trainings/${trainingId}/participants/${participantId}`),

  // My trainings
  getMyUpcoming: () => api.get('/trainings/my/upcoming'),
  getMyHistory: () => api.get('/trainings/my/history'),
};

// Investigations API (Internal Affairs)
export const investigationsApi = {
  getAll: (params?: Record<string, string>) => api.get('/investigations', { params }),
  getStats: () => api.get('/investigations/stats'),
  getById: (id: string) => api.get(`/investigations/${id}`),
  getEmployees: () => api.get('/investigations/employees'),
  create: (data: { title: string; description?: string; priority?: string; category?: string; accusedId?: string; complainant?: string }) =>
    api.post('/investigations', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/investigations/${id}`, data),
  delete: (id: string) => api.delete(`/investigations/${id}`),

  // Notes
  addNote: (investigationId: string, data: { content: string; isConfidential?: boolean }) =>
    api.post(`/investigations/${investigationId}/notes`, data),
  deleteNote: (noteId: string) => api.delete(`/investigations/notes/${noteId}`),

  // Witnesses
  addWitness: (investigationId: string, data: { employeeId?: string; externalName?: string; statement?: string }) =>
    api.post(`/investigations/${investigationId}/witnesses`, data),
  updateWitness: (witnessId: string, data: { statement?: string; interviewedAt?: string }) =>
    api.put(`/investigations/witnesses/${witnessId}`, data),
  deleteWitness: (witnessId: string) => api.delete(`/investigations/witnesses/${witnessId}`),
};

// Unit Reviews API (Quality Assurance)
export const unitReviewsApi = {
  getUnits: () => api.get('/unit-reviews/units'),
  getAll: (params?: Record<string, string>) => api.get('/unit-reviews', { params }),
  getStats: () => api.get('/unit-reviews/stats'),
  getById: (id: string) => api.get(`/unit-reviews/${id}`),
  getByUnit: (unit: string) => api.get(`/unit-reviews/by-unit/${encodeURIComponent(unit)}`),
  create: (data: { unit: string; reviewDate: string; rating?: number; findings?: string; recommendations?: string }) =>
    api.post('/unit-reviews', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/unit-reviews/${id}`, data),
  delete: (id: string) => api.delete(`/unit-reviews/${id}`),
};

// Uprank Requests API (Teamleitung)
export const uprankRequestsApi = {
  getAll: (params?: Record<string, string>) => api.get('/uprank-requests', { params }),
  getStats: () => api.get('/uprank-requests/stats'),
  getById: (id: string) => api.get(`/uprank-requests/${id}`),
  getEmployees: () => api.get('/uprank-requests/employees'),
  getMyRequests: () => api.get('/uprank-requests/my/requests'),
  create: (data: { employeeId: string; targetRank: string; reason: string; achievements?: string }) =>
    api.post('/uprank-requests', data),
  process: (id: string, data: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
    api.put(`/uprank-requests/${id}/process`, data),
  delete: (id: string) => api.delete(`/uprank-requests/${id}`),
};

// Team Change Reports API (Internal Affairs)
export const teamChangeReportsApi = {
  getAll: (params?: Record<string, string>) => api.get('/team-change-reports', { params }),
  getStats: () => api.get('/team-change-reports/stats'),
  getById: (id: string) => api.get(`/team-change-reports/${id}`),
  getByEmployee: (employeeId: string) => api.get(`/team-change-reports/employee/${employeeId}`),
  create: (data: { employeeId: string; previousTeam: string; newTeam: string; notes?: string; uprankLockId?: string }) =>
    api.post('/team-change-reports', data),
  review: (id: string, data: { status: 'REVIEWED' | 'ARCHIVED'; reviewNotes?: string }) =>
    api.put(`/team-change-reports/${id}/review`, data),
  update: (id: string, data: { notes?: string }) =>
    api.put(`/team-change-reports/${id}`, data),
  delete: (id: string) => api.delete(`/team-change-reports/${id}`),
};
