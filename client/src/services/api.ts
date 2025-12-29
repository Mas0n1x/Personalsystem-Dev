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

    // Bei 401 zur Login-Seite weiterleiten
    if (error.response?.status === 401) {
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Bei 403 Berechtigungsfehler anzeigen
    if (error.response?.status === 403) {
      toast.error('Keine Berechtigung für diese Aktion');
      return Promise.reject(error);
    }

    // Sonstige Fehler anzeigen
    if (error.response?.status >= 400) {
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
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getActivity: (limit?: number) => api.get('/dashboard/activity', { params: { limit } }),
  getOnlineUsers: () => api.get('/dashboard/online-users'),
  getMyOverview: () => api.get('/dashboard/my-overview'),
};

// HR API
export const hrApi = {
  getApplications: (params?: Record<string, string>) => api.get('/hr/applications', { params }),
  createApplication: (data: Record<string, unknown>) => api.post('/hr/applications', data),
  updateApplication: (id: string, data: Record<string, unknown>) => api.put(`/hr/applications/${id}`, data),
  acceptApplication: (id: string, data: Record<string, unknown>) => api.post(`/hr/applications/${id}/accept`, data),
  rejectApplication: (id: string, reason: string) => api.post(`/hr/applications/${id}/reject`, { reason }),
  deleteApplication: (id: string) => api.delete(`/hr/applications/${id}`),
  getStats: () => api.get('/hr/stats'),
};

// IA API
export const iaApi = {
  getEvaluations: (params?: Record<string, string>) => api.get('/ia/evaluations', { params }),
  getEmployeeEvaluations: (userId: string) => api.get(`/ia/evaluations/employee/${userId}`),
  createEvaluation: (data: Record<string, unknown>) => api.post('/ia/evaluations', data),
  createWarning: (data: Record<string, unknown>) => api.post('/ia/warnings', data),
  createCommendation: (data: Record<string, unknown>) => api.post('/ia/commendations', data),
  updateEvaluation: (id: string, data: Record<string, unknown>) => api.put(`/ia/evaluations/${id}`, data),
  deleteEvaluation: (id: string) => api.delete(`/ia/evaluations/${id}`),
  getStats: () => api.get('/ia/stats'),
};

// Academy API
export const academyApi = {
  getTrainings: (params?: Record<string, string>) => api.get('/academy/trainings', { params }),
  getTraining: (id: string) => api.get(`/academy/trainings/${id}`),
  createTraining: (data: Record<string, unknown>) => api.post('/academy/trainings', data),
  updateTraining: (id: string, data: Record<string, unknown>) => api.put(`/academy/trainings/${id}`, data),
  deleteTraining: (id: string) => api.delete(`/academy/trainings/${id}`),
  addParticipant: (trainingId: string, userId: string) => api.post(`/academy/trainings/${trainingId}/participants`, { userId }),
  removeParticipant: (trainingId: string, participantId: string) => api.delete(`/academy/trainings/${trainingId}/participants/${participantId}`),
  updateParticipant: (trainingId: string, participantId: string, data: Record<string, unknown>) => api.put(`/academy/trainings/${trainingId}/participants/${participantId}`, data),
  completeTraining: (id: string) => api.post(`/academy/trainings/${id}/complete`),
  getMyTrainings: () => api.get('/academy/my-trainings'),
  getStats: () => api.get('/academy/stats'),
};

// QA API
export const qaApi = {
  getReports: (params?: Record<string, string>) => api.get('/qa/reports', { params }),
  getReport: (id: string) => api.get(`/qa/reports/${id}`),
  createReport: (data: Record<string, unknown>) => api.post('/qa/reports', data),
  updateReport: (id: string, data: Record<string, unknown>) => api.put(`/qa/reports/${id}`, data),
  deleteReport: (id: string) => api.delete(`/qa/reports/${id}`),
  getUnits: () => api.get('/qa/units'),
  getUnitReports: (unit: string) => api.get(`/qa/units/${unit}`),
  getStats: () => api.get('/qa/stats'),
};

// Finance API
export const financeApi = {
  // Transactions
  getTransactions: (params?: Record<string, string>) => api.get('/finance/transactions', { params }),
  createTransaction: (data: Record<string, unknown>) => api.post('/finance/transactions', data),

  // Evidence
  getEvidence: (params?: Record<string, string>) => api.get('/finance/evidence', { params }),
  createEvidence: (data: Record<string, unknown>) => api.post('/finance/evidence', data),
  addEvidenceLog: (id: string, data: Record<string, unknown>) => api.post(`/finance/evidence/${id}/log`, data),

  // Robberies
  getRobberies: (params?: Record<string, string>) => api.get('/finance/robberies', { params }),
  createRobbery: (data: Record<string, unknown>) => api.post('/finance/robberies', data),
  updateRobbery: (id: string, data: Record<string, unknown>) => api.put(`/finance/robberies/${id}`, data),

  // Special Payments
  getSpecialPayments: (params?: Record<string, string>) => api.get('/finance/special-payments', { params }),
  createSpecialPayment: (data: Record<string, unknown>) => api.post('/finance/special-payments', data),
  approvePayment: (id: string) => api.post(`/finance/special-payments/${id}/approve`),

  // Absences
  getAbsences: (params?: Record<string, string>) => api.get('/finance/absences', { params }),
  createAbsence: (data: Record<string, unknown>) => api.post('/finance/absences', data),
  approveAbsence: (id: string) => api.post(`/finance/absences/${id}/approve`),

  // Tuning Invoices
  getTuningInvoices: (params?: Record<string, string>) => api.get('/finance/tuning-invoices', { params }),
  createTuningInvoice: (data: Record<string, unknown>) => api.post('/finance/tuning-invoices', data),

  // Stats
  getStats: () => api.get('/finance/stats'),
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

  // Announcements
  getAnnouncements: (params?: Record<string, string>) => api.get('/admin/announcements', { params }),
  createAnnouncement: (data: Record<string, unknown>) => api.post('/admin/announcements', data),
  publishAnnouncement: (id: string) => api.post(`/admin/announcements/${id}/publish`),
  deleteAnnouncement: (id: string) => api.delete(`/admin/announcements/${id}`),

  // Discord
  getDiscordInfo: () => api.get('/admin/discord/info'),
  syncRoles: () => api.post('/admin/discord/sync-roles'),

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
