import { NavLink } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import {
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  FileText,
  ChevronDown,
  CalendarOff,
  Briefcase,
  Package,
  Car,
  Crosshair,
  UserX,
  Search,
  GraduationCap,
  ShieldAlert,
  ClipboardCheck,
  TrendingUp,
  Building2,
  Database,
  DollarSign,
  HelpCircle,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

interface NavGroup {
  name: string;
  items: NavItem[];
  permission?: string;
}

export default function Sidebar() {
  const permissions = usePermissions();
  const [openGroups, setOpenGroups] = useState<string[]>(['main']);

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  };

  const navigation: NavGroup[] = [
    {
      name: 'main',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Mitarbeiter', href: '/employees', icon: Users, permission: 'employees.view' },
        { name: 'Abmeldungen', href: '/absences', icon: CalendarOff, permission: 'employees.view' },
        { name: 'Asservaten', href: '/evidence', icon: Package, permission: 'evidence.view' },
        { name: 'Tuning', href: '/tuning', icon: Car, permission: 'tuning.view' },
        { name: 'Räube', href: '/robbery', icon: Crosshair, permission: 'robbery.view' },
        { name: 'Leadership', href: '/leadership', icon: Briefcase, permission: 'leadership.view' },
      ],
    },
    {
      name: 'Units',
      items: [
        { name: 'HR', href: '/hr', icon: UserX, permission: 'blacklist.view' },
        { name: 'Detectives', href: '/detectives', icon: Search, permission: 'detectives.view' },
        { name: 'Academy', href: '/academy', icon: GraduationCap, permission: 'academy.view' },
        { name: 'Internal Affairs', href: '/internal-affairs', icon: ShieldAlert, permission: 'ia.view' },
        { name: 'Quality Assurance', href: '/quality-assurance', icon: ClipboardCheck, permission: 'qa.view' },
        { name: 'Teamleitung', href: '/teamleitung', icon: TrendingUp, permission: 'teamlead.view' },
        { name: 'Management', href: '/management', icon: Building2, permission: 'management.uprank' },
      ],
    },
    {
      name: 'Administration',
      permission: 'admin.full',
      items: [
        { name: 'Rollen', href: '/admin/roles', icon: Shield, permission: 'admin.full' },
        { name: 'Academy Module', href: '/admin/academy-modules', icon: GraduationCap, permission: 'admin.full' },
        { name: 'Fragen & Kriterien', href: '/admin/academy-settings', icon: HelpCircle, permission: 'admin.full' },
        { name: 'Sonderzahlungen', href: '/admin/bonus', icon: DollarSign, permission: 'admin.full' },
        { name: 'Discord Ankündigungen', href: '/admin/discord-announcements', icon: MessageSquare, permission: 'admin.full' },
        { name: 'Audit-Logs', href: '/admin/audit-logs', icon: FileText, permission: 'audit.view' },
        { name: 'Backups', href: '/admin/backups', icon: Database, permission: 'admin.full' },
        { name: 'Einstellungen', href: '/admin/settings', icon: Settings, permission: 'admin.full' },
      ],
    },
  ];

  const canAccessGroup = (group: NavGroup): boolean => {
    if (!group.permission) return true;
    return permissions.hasAnyPermission(group.permission, 'admin.full');
  };

  const canAccessItem = (item: NavItem): boolean => {
    if (!item.permission) return true;
    return permissions.hasAnyPermission(item.permission, 'admin.full');
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-800 border-r border-slate-700 flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-slate-700 bg-lspd-blue">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-lspd-gold" />
          <div>
            <h1 className="text-lg font-bold text-white">LSPD</h1>
            <p className="text-xs text-slate-300">Personalsystem</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navigation.map((group) => {
          if (!canAccessGroup(group)) return null;

          const visibleItems = group.items.filter(canAccessItem);
          if (visibleItems.length === 0) return null;

          const isOpen = openGroups.includes(group.name);

          return (
            <div key={group.name} className="mb-2">
              {group.name !== 'main' && (
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-300 transition-colors"
                >
                  {group.name}
                  <ChevronDown
                    className={clsx(
                      'h-4 w-4 transition-transform',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
              )}

              {(group.name === 'main' || isOpen) && (
                <ul className="space-y-1">
                  {visibleItems.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        className={({ isActive }) =>
                          clsx('sidebar-link', isActive && 'active')
                        }
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          LSPD Personalsystem v1.0
        </p>
        <p className="text-xs text-slate-600 text-center mt-1">
          Made by Mas0n1x
        </p>
      </div>
    </aside>
  );
}
