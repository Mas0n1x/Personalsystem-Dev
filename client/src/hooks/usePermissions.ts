import { useAuth } from '../context/AuthContext';

export function usePermissions() {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  const isAdmin = hasPermission('admin.full');

  // Users
  const canViewUsers = hasAnyPermission('users.view', 'admin.full');
  const canEditUsers = hasAnyPermission('users.edit', 'admin.full');
  const canDeleteUsers = hasAnyPermission('users.delete', 'admin.full');

  // Employees
  const canViewEmployees = hasAnyPermission('employees.view', 'admin.full');
  const canEditEmployees = hasAnyPermission('employees.edit', 'admin.full');
  const canRankEmployees = hasAnyPermission('employees.rank', 'admin.full');
  const canDeleteEmployees = hasAnyPermission('employees.delete', 'admin.full');

  // HR
  const canViewHR = hasAnyPermission('hr.view', 'admin.full');
  const canManageHR = hasAnyPermission('hr.manage', 'admin.full');

  // Blacklist
  const canViewBlacklist = hasAnyPermission('blacklist.view', 'admin.full');
  const canManageBlacklist = hasAnyPermission('blacklist.manage', 'admin.full');

  // IA (Internal Affairs)
  const canViewIA = hasAnyPermission('ia.view', 'admin.full');
  const canManageIA = hasAnyPermission('ia.manage', 'admin.full');
  const canInvestigate = hasAnyPermission('ia.investigate', 'ia.manage', 'admin.full');

  // Academy
  const canViewAcademy = hasAnyPermission('academy.view', 'admin.full');
  const canManageAcademy = hasAnyPermission('academy.manage', 'admin.full');
  const canTeach = hasAnyPermission('academy.teach', 'academy.manage', 'admin.full');

  // QA (Quality Assurance)
  const canViewQA = hasAnyPermission('qa.view', 'admin.full');
  const canManageQA = hasAnyPermission('qa.manage', 'admin.full');

  // Detectives
  const canViewDetectives = hasAnyPermission('detectives.view', 'admin.full');
  const canManageDetectives = hasAnyPermission('detectives.manage', 'admin.full');

  // Treasury/Finance
  const canViewTreasury = hasAnyPermission('treasury.view', 'admin.full');
  const canManageTreasury = hasAnyPermission('treasury.manage', 'admin.full');

  // Sanctions
  const canViewSanctions = hasAnyPermission('sanctions.view', 'admin.full');
  const canManageSanctions = hasAnyPermission('sanctions.manage', 'admin.full');

  // Evidence/Asservate
  const canViewEvidence = hasAnyPermission('evidence.view', 'admin.full');
  const canManageEvidence = hasAnyPermission('evidence.manage', 'admin.full');

  // Tuning
  const canViewTuning = hasAnyPermission('tuning.view', 'admin.full');
  const canManageTuning = hasAnyPermission('tuning.manage', 'admin.full');

  // Robbery
  const canViewRobbery = hasAnyPermission('robbery.view', 'admin.full');
  const canCreateRobbery = hasAnyPermission('robbery.create', 'admin.full');
  const canManageRobbery = hasAnyPermission('robbery.manage', 'admin.full');

  // Calendar
  const canViewCalendar = hasAnyPermission('calendar.view', 'admin.full');
  const canManageCalendar = hasAnyPermission('calendar.manage', 'admin.full');

  // Uprank/Uprank-Locks
  const canViewUprank = hasAnyPermission('uprank.view', 'admin.full');
  const canManageUprank = hasAnyPermission('uprank.manage', 'admin.full');

  // Teamlead
  const canViewTeamlead = hasAnyPermission('teamlead.view', 'admin.full');
  const canManageTeamlead = hasAnyPermission('teamlead.manage', 'admin.full');

  // Management
  const canViewManagement = hasAnyPermission('management.view', 'admin.full');
  const canProcessUprank = hasAnyPermission('management.uprank', 'admin.full');

  // Bonus/Sonderzahlungen
  const canViewBonus = hasAnyPermission('bonus.view', 'admin.full');
  const canManageBonus = hasAnyPermission('bonus.manage', 'admin.full');
  const canPayBonus = hasAnyPermission('bonus.pay', 'admin.full');

  // Leadership
  const canViewLeadership = hasAnyPermission('leadership.view', 'admin.full');
  const canManageLeadership = hasAnyPermission('leadership.manage', 'admin.full');
  const canViewTasks = hasAnyPermission('leadership.tasks', 'admin.full');

  // Announcements
  const canViewAnnouncements = hasAnyPermission('announcements.view', 'leadership.view', 'admin.full');
  const canCreateAnnouncements = hasAnyPermission('announcements.create', 'leadership.manage', 'admin.full');
  const canPublishAnnouncements = hasAnyPermission('announcements.publish', 'leadership.manage', 'admin.full');

  // Audit & Backup
  const canViewAudit = hasAnyPermission('audit.view', 'admin.full');
  const canManageBackups = hasAnyPermission('backup.manage', 'admin.full');

  // Admin Settings
  const canManageSettings = hasAnyPermission('admin.settings', 'admin.full');

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
    canRankEmployees,
    canDeleteEmployees,

    // HR
    canViewHR,
    canManageHR,

    // Blacklist
    canViewBlacklist,
    canManageBlacklist,

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

    // Detectives
    canViewDetectives,
    canManageDetectives,

    // Treasury/Finance
    canViewTreasury,
    canManageTreasury,

    // Sanctions
    canViewSanctions,
    canManageSanctions,

    // Evidence
    canViewEvidence,
    canManageEvidence,

    // Tuning
    canViewTuning,
    canManageTuning,

    // Robbery
    canViewRobbery,
    canCreateRobbery,
    canManageRobbery,

    // Calendar
    canViewCalendar,
    canManageCalendar,

    // Uprank
    canViewUprank,
    canManageUprank,

    // Teamlead
    canViewTeamlead,
    canManageTeamlead,

    // Management
    canViewManagement,
    canProcessUprank,

    // Bonus
    canViewBonus,
    canManageBonus,
    canPayBonus,

    // Leadership
    canViewLeadership,
    canManageLeadership,
    canViewTasks,

    // Announcements
    canViewAnnouncements,
    canCreateAnnouncements,
    canPublishAnnouncements,

    // Audit & Backup
    canViewAudit,
    canManageBackups,

    // Admin Settings
    canManageSettings,

    // Helper
    hasPermission,
    hasAnyPermission,
  };
}
