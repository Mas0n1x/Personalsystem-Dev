import { useAuth } from '../context/AuthContext';

export function usePermissions() {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  const isAdmin = hasPermission('admin.full');

  const canViewUsers = hasAnyPermission('users.view', 'admin.full');
  const canEditUsers = hasAnyPermission('users.edit', 'admin.full');
  const canDeleteUsers = hasAnyPermission('users.delete', 'admin.full');

  const canViewEmployees = hasAnyPermission('employees.view', 'admin.full');
  const canEditEmployees = hasAnyPermission('employees.edit', 'admin.full');
  const canDeleteEmployees = hasAnyPermission('employees.delete', 'admin.full');

  const canViewHR = hasAnyPermission('hr.view', 'admin.full');
  const canManageHR = hasAnyPermission('hr.manage', 'admin.full');
  const canManageApplications = hasAnyPermission('hr.applications', 'hr.manage', 'admin.full');

  const canViewIA = hasAnyPermission('ia.view', 'admin.full');
  const canManageIA = hasAnyPermission('ia.manage', 'admin.full');
  const canInvestigate = hasAnyPermission('ia.investigate', 'admin.full');

  const canViewAcademy = hasAnyPermission('academy.view', 'admin.full');
  const canManageAcademy = hasAnyPermission('academy.manage', 'admin.full');
  const canTeach = hasAnyPermission('academy.teach', 'admin.full');

  const canViewQA = hasAnyPermission('qa.view', 'admin.full');
  const canManageQA = hasAnyPermission('qa.manage', 'admin.full');

  const canViewFinance = hasAnyPermission('finance.view', 'admin.full');
  const canManageFinance = hasAnyPermission('finance.manage', 'admin.full');
  const canApproveFinance = hasAnyPermission('finance.approve', 'admin.full');

  const canViewAnnouncements = hasAnyPermission('announcements.view', 'admin.full');
  const canCreateAnnouncements = hasAnyPermission('announcements.create', 'admin.full');
  const canPublishAnnouncements = hasAnyPermission('announcements.publish', 'admin.full');

  const canViewAudit = hasAnyPermission('audit.view', 'admin.full');
  const canManageBackups = hasAnyPermission('backup.manage', 'admin.full');

  return {
    user,
    isAdmin,

    // Users
    canViewUsers,
    canEditUsers,
    canDeleteUsers,

    // Employees
    canViewEmployees,
    canEditEmployees,
    canDeleteEmployees,

    // HR
    canViewHR,
    canManageHR,
    canManageApplications,

    // IA
    canViewIA,
    canManageIA,
    canInvestigate,

    // Academy
    canViewAcademy,
    canManageAcademy,
    canTeach,

    // QA
    canViewQA,
    canManageQA,

    // Finance
    canViewFinance,
    canManageFinance,
    canApproveFinance,

    // Announcements
    canViewAnnouncements,
    canCreateAnnouncements,
    canPublishAnnouncements,

    // Audit & Backup
    canViewAudit,
    canManageBackups,

    // Helper
    hasPermission,
    hasAnyPermission,
  };
}
