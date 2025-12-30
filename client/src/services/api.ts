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
