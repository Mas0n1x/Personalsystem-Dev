import { useQuery } from '@tanstack/react-query';
import { dashboardApi, absencesApi, bonusApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { usePermissions } from '../hooks/usePermissions';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserMinus,
  CalendarOff,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Award,
  Shield,
  Clock,
  AlertCircle,
  ChevronRight,
  Activity,
  Star,
  Briefcase,
  UserPlus,
  Ban,
  FileText,
  Sparkles,
} from 'lucide-react';

interface ActiveAbsence {
  id: string;
  type: 'ABSENCE' | 'DAY_OFF';
  reason: string | null;
  startDate: string;
  endDate: string;
  employee: {
    id: string;
    badgeNumber: string | null;
    rank: string;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  };
}

interface BonusPayment {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  createdAt: string;
  config: {
    displayName: string;
    category: string;
  };
}

interface MyBonusData {
  payments: BonusPayment[];
  summary: {
    total: number;
    pending: number;
    paid: number;
    count: number;
  };
  weekStart: string;
  weekEnd: string;
}

interface RecentActivity {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  };
}

interface TeamDistribution {
  team: string;
  count: number;
}

interface DashboardStats {
  stats: {
    totalEmployees: number;
    activeEmployees: number;
    onLeaveEmployees: number;
    suspendedEmployees: number;
    terminatedThisMonth: number;
    newHiresThisMonth: number;
    newHiresTrend: number;
    promotionsThisWeek: number;
    promotionsThisMonth: number;
    activeAbsences: number;
    pendingApplications: number;
    pendingUprankRequests: number;
    pendingUnitReviews: number;
    totalPending: number;
    totalUnits: number;
    activeUnitsCount: number;
  };
  recentActivity: RecentActivity[];
  teamDistribution: TeamDistribution[];
}

// Statistik-Karte mit Glasmorphism-Effekt
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  trend,
  trendLabel,
  link,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'indigo' | 'pink';
  trend?: number;
  trendLabel?: string;
  link?: string;
}) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
    green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
    yellow: 'from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-400',
    red: 'from-red-500/20 to-red-600/5 border-red-500/30 text-red-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400',
    orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30 text-orange-400',
    indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 text-indigo-400',
    pink: 'from-pink-500/20 to-pink-600/5 border-pink-500/30 text-pink-400',
  };

  const iconBgClasses = {
    blue: 'bg-blue-500/20',
    green: 'bg-emerald-500/20',
    yellow: 'bg-amber-500/20',
    red: 'bg-red-500/20',
    purple: 'bg-purple-500/20',
    orange: 'bg-orange-500/20',
    indigo: 'bg-indigo-500/20',
    pink: 'bg-pink-500/20',
  };

  const content = (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-sm p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-${color}-500/10 group`}
    >
      {/* Decorative glow */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl group-hover:bg-${color}-500/20 transition-all duration-500`} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
          {trend !== undefined && (
            <div className="flex items-center gap-1.5">
              {trend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && <span className="text-xs text-slate-500">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBgClasses[color]} ring-1 ring-white/10`}>
          <Icon className={`h-6 w-6 ${colorClasses[color].split(' ').pop()}`} />
        </div>
      </div>

      {link && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </div>
      )}
    </div>
  );

  if (link) {
    return <Link to={link}>{content}</Link>;
  }
  return content;
}

// Schnellzugriff-Button
function QuickAction({
  title,
  description,
  icon: Icon,
  href,
  color,
  badge,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  badge?: number;
}) {
  return (
    <Link
      to={href}
      className="group relative flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800 transition-all duration-200"
    >
      <div className={`p-3 rounded-xl ${color} ring-1 ring-white/10`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white group-hover:text-blue-400 transition-colors">{title}</p>
        <p className="text-sm text-slate-400 truncate">{description}</p>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="px-2.5 py-1 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse">
          {badge}
        </span>
      )}
      <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const permissions = usePermissions();
  const canViewAllBonuses = permissions.hasAnyPermission('bonus.view', 'bonus.pay', 'admin.full');
  const canViewPending = permissions.hasAnyPermission('hr.view', 'admin.full');

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await dashboardApi.getStats();
      return res.data as DashboardStats;
    },
    refetchInterval: 30000,
  });

  const { data: activeAbsencesData } = useQuery({
    queryKey: ['active-absences'],
    queryFn: () => absencesApi.getActive(),
    refetchInterval: 60000,
  });

  const { data: myBonusData } = useQuery({
    queryKey: ['my-bonuses'],
    queryFn: async () => {
      const res = await bonusApi.getMyBonuses();
      return res.data as MyBonusData;
    },
    refetchInterval: 60000,
  });

  const stats = statsData?.stats;
  const recentActivity = statsData?.recentActivity || [];
  const teamDistribution = statsData?.teamDistribution || [];
  const activeAbsences = activeAbsencesData?.data as ActiveAbsence[] | undefined;
  const myBonus = myBonusData;

  // Berechne Team-Farben
  const teamColors: Record<string, string> = {
    'White': 'bg-slate-300',
    'Red': 'bg-red-500',
    'Gold': 'bg-amber-500',
    'Silver': 'bg-slate-400',
    'Green': 'bg-emerald-500',
    'Kein Team': 'bg-slate-600',
  };

  const getTeamColor = (team: string) => {
    return teamColors[team] || 'bg-slate-500';
  };

  // Formatiere Aktivitäts-Text
  const formatActivity = (activity: RecentActivity) => {
    const actionMap: Record<string, string> = {
      'CREATE': 'erstellt',
      'UPDATE': 'aktualisiert',
      'DELETE': 'gelöscht',
      'PROMOTE': 'befördert',
      'DEMOTE': 'degradiert',
      'TERMINATE': 'gekündigt',
      'LOGIN': 'eingeloggt',
    };
    return actionMap[activity.action] || activity.action;
  };

  const formatResource = (resource: string) => {
    const resourceMap: Record<string, string> = {
      'EMPLOYEE': 'Mitarbeiter',
      'USER': 'Benutzer',
      'PROMOTION': 'Beförderung',
      'ABSENCE': 'Abmeldung',
      'BONUS': 'Sonderzahlung',
      'APPLICATION': 'Bewerbung',
    };
    return resourceMap[resource] || resource;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 blur-xl opacity-50 animate-pulse" />
          <div className="relative animate-spin rounded-full h-16 w-16 border-4 border-slate-700 border-t-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header mit Begrüßung */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-white/10 p-8">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-amber-400" />
              <h1 className="text-3xl font-bold text-white">
                Willkommen zurück, {user?.displayName || user?.username}!
              </h1>
            </div>
            <p className="text-slate-300 text-lg">
              Hier ist deine Übersicht für heute, {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-400">Online im System</p>
              <p className="text-2xl font-bold text-white">{onlineUsers.length}</p>
            </div>
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 5).map((u) => (
                <img
                  key={u.id}
                  src={u.avatar || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                  alt={u.username}
                  className="h-10 w-10 rounded-full border-2 border-slate-800 ring-2 ring-emerald-500/50"
                  title={u.displayName || u.username}
                />
              ))}
              {onlineUsers.length > 5 && (
                <div className="h-10 w-10 rounded-full border-2 border-slate-800 bg-slate-700 flex items-center justify-center text-sm font-medium text-white">
                  +{onlineUsers.length - 5}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Meine Boni Highlight */}
        {myBonus && myBonus.summary.total > 0 && (
          <div className="relative mt-6 flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="p-3 rounded-xl bg-amber-500/20">
              <DollarSign className="h-6 w-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-amber-200 font-medium">Deine Sonderzahlungen diese Woche</p>
              <p className="text-sm text-amber-300/70">{myBonus.summary.count} Tätigkeiten eingetragen</p>
            </div>
            <p className="text-3xl font-bold text-amber-400">${myBonus.summary.total.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Haupt-Statistiken */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Mitarbeiter Gesamt"
          value={stats?.totalEmployees || 0}
          icon={Users}
          color="blue"
          link="/employees"
        />
        <StatCard
          title="Aktive Mitarbeiter"
          value={stats?.activeEmployees || 0}
          icon={UserCheck}
          color="green"
        />
        <StatCard
          title="Neueinstellungen"
          value={stats?.newHiresThisMonth || 0}
          icon={UserPlus}
          color="indigo"
          trend={stats?.newHiresTrend}
          trendLabel="vs. Vormonat"
        />
        <StatCard
          title="Beförderungen"
          value={stats?.promotionsThisMonth || 0}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Schnellzugriff & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schnellzugriff */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-400" />
              Schnellzugriff
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <QuickAction
              title="Mitarbeiter"
              description="Personal verwalten"
              icon={Users}
              href="/employees"
              color="bg-blue-600"
            />
            <QuickAction
              title="Units-Übersicht"
              description={`${stats?.activeUnitsCount || 0} aktive Units`}
              icon={Shield}
              href="/units"
              color="bg-purple-600"
            />
            {canViewPending && (
              <>
                <QuickAction
                  title="Human Resources"
                  description="Bewerbungen & Kündigungen"
                  icon={FileText}
                  href="/hr"
                  color="bg-emerald-600"
                  badge={stats?.pendingApplications}
                />
                <QuickAction
                  title="Uprank-Anfragen"
                  description="Beförderungsanträge"
                  icon={Award}
                  href="/teamleitung"
                  color="bg-amber-600"
                  badge={stats?.pendingUprankRequests}
                />
              </>
            )}
            <QuickAction
              title="Abmeldungen"
              description={`${stats?.activeAbsences || 0} aktiv`}
              icon={CalendarOff}
              href="/absences"
              color="bg-orange-600"
            />
            <QuickAction
              title="Leadership"
              description="Ankündigungen & Tools"
              icon={Star}
              href="/leadership"
              color="bg-pink-600"
            />
          </div>
        </div>

        {/* Status-Panel */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Status
          </h2>

          <div className="space-y-3">
            {/* Offene Aufgaben */}
            {canViewPending && stats?.totalPending > 0 && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">Offene Aufgaben</p>
                    <p className="text-sm text-slate-400">
                      {stats.pendingApplications > 0 && `${stats.pendingApplications} Bewerbungen`}
                      {stats.pendingApplications > 0 && stats.pendingUprankRequests > 0 && ', '}
                      {stats.pendingUprankRequests > 0 && `${stats.pendingUprankRequests} Uprank-Anfragen`}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-red-400">{stats.totalPending}</span>
                </div>
              </div>
            )}

            {/* Abwesend */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <UserMinus className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Abwesend</p>
                  <p className="text-sm text-slate-400">Mitarbeiter im Urlaub</p>
                </div>
                <span className="text-2xl font-bold text-yellow-400">{stats?.onLeaveEmployees || 0}</span>
              </div>
            </div>

            {/* Suspendiert */}
            {(stats?.suspendedEmployees || 0) > 0 && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <Ban className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">Suspendiert</p>
                    <p className="text-sm text-slate-400">Aktuell suspendiert</p>
                  </div>
                  <span className="text-2xl font-bold text-red-400">{stats?.suspendedEmployees || 0}</span>
                </div>
              </div>
            )}

            {/* Team-Verteilung */}
            {teamDistribution.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="font-medium text-white mb-3">Team-Verteilung</p>
                <div className="space-y-2">
                  {teamDistribution
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map((team) => (
                      <div key={team.team} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getTeamColor(team.team)}`} />
                        <span className="flex-1 text-sm text-slate-300">{team.team}</span>
                        <span className="text-sm font-medium text-white">{team.count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unterer Bereich: Aktivität & Abmeldungen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Letzte Aktivitäten */}
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              Letzte Aktivitäten
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50">
            {recentActivity.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Keine Aktivitäten</p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-slate-750/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <img
                      src={activity.user.avatar || `https://ui-avatars.com/api/?name=${activity.user.username}&background=random`}
                      alt={activity.user.username}
                      className="h-9 w-9 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-medium">{activity.user.displayName || activity.user.username}</span>
                        <span className="text-slate-400"> hat </span>
                        <span className="text-slate-300">{formatResource(activity.resource)}</span>
                        <span className="text-slate-400"> {formatActivity(activity)}</span>
                      </p>
                      {activity.details && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{activity.details}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(activity.createdAt).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Aktive Abmeldungen */}
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-orange-400" />
              Abmeldungen & Dienstfrei
            </h2>
            <span className="px-2.5 py-1 text-xs font-medium bg-orange-500/20 text-orange-400 rounded-full">
              {activeAbsences?.length || 0} Aktiv
            </span>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-[400px] overflow-y-auto">
            {!activeAbsences?.length ? (
              <p className="text-slate-400 text-center py-8">Keine aktiven Abmeldungen</p>
            ) : (
              activeAbsences.map((absence) => (
                <div key={absence.id} className="p-4 hover:bg-slate-750/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <img
                      src={absence.employee.user.avatar || `https://ui-avatars.com/api/?name=${absence.employee.user.username}&background=random`}
                      alt={absence.employee.user.username}
                      className="h-10 w-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {absence.employee.user.displayName || absence.employee.user.username}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            absence.type === 'DAY_OFF'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-orange-500/20 text-orange-400'
                          }`}
                        >
                          {absence.type === 'DAY_OFF' ? 'Dienstfrei' : 'Abmeldung'}
                        </span>
                        <span className="text-xs text-slate-500">
                          bis {new Date(absence.endDate).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sonderzahlungen Übersicht (nur wenn berechtigt) */}
      {canViewAllBonuses && myBonus && myBonus.payments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-400" />
              Meine Sonderzahlungen diese Woche
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {new Date(myBonus.weekStart).toLocaleDateString('de-DE')} - {new Date(myBonus.weekEnd).toLocaleDateString('de-DE')}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 font-bold">
                ${myBonus.summary.total.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {myBonus.payments.slice(0, 6).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{payment.config.displayName}</p>
                    {payment.reason && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{payment.reason}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-amber-400 ml-3">
                    ${payment.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            {myBonus.payments.length > 6 && (
              <p className="text-center text-sm text-slate-400 mt-4">
                +{myBonus.payments.length - 6} weitere Einträge
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
