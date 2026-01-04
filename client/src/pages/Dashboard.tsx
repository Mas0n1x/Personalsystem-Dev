import { useQuery } from '@tanstack/react-query';
import { dashboardApi, absencesApi, bonusApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  Users,
  UserCheck,
  UserMinus,
  CalendarOff,
  DollarSign,
  TrendingUp,
  Award,
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

interface AllBonusPayment {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  createdAt: string;
  config: {
    displayName: string;
    category: string;
  };
  employee: {
    id: string;
    rank: string;
    badgeNumber: string | null;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  };
}

interface BonusSummary {
  weekStart: string;
  weekEnd: string;
  totals: {
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
    paymentCount: number;
    employeeCount: number;
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const permissions = usePermissions();
  const canViewAllBonuses = permissions.hasAnyPermission('bonus.view', 'bonus.pay', 'admin.full');

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
    refetchInterval: 30000, // Alle 30 Sekunden aktualisieren
  });

  const { data: activeAbsencesData } = useQuery({
    queryKey: ['active-absences'],
    queryFn: () => absencesApi.getActive(),
    refetchInterval: 60000, // Jede Minute aktualisieren
  });

  const { data: myBonusData } = useQuery({
    queryKey: ['my-bonuses'],
    queryFn: async () => {
      const res = await bonusApi.getMyBonuses();
      return res.data as MyBonusData;
    },
    refetchInterval: 60000, // Jede Minute aktualisieren
  });

  // Alle Sonderzahlungen dieser Woche (für berechtigte Benutzer)
  const { data: allBonusPayments } = useQuery<AllBonusPayment[]>({
    queryKey: ['all-bonus-payments'],
    queryFn: async () => {
      const res = await bonusApi.getPayments({});
      return res.data;
    },
    enabled: canViewAllBonuses,
    refetchInterval: 60000,
  });

  const { data: bonusSummary } = useQuery<BonusSummary>({
    queryKey: ['bonus-summary'],
    queryFn: async () => {
      const res = await bonusApi.getSummary();
      return res.data;
    },
    enabled: canViewAllBonuses,
    refetchInterval: 60000,
  });

  const stats = statsData?.data?.stats;
  const activeAbsences = activeAbsencesData?.data as ActiveAbsence[] | undefined;
  const myBonus = myBonusData;

  // Gruppiere Zahlungen nach Mitarbeiter
  const groupedByEmployee = allBonusPayments?.reduce((acc: Record<string, { employee: AllBonusPayment['employee']; payments: AllBonusPayment[]; total: number }>, payment) => {
    const key = payment.employee.id;
    if (!acc[key]) {
      acc[key] = {
        employee: payment.employee,
        payments: [],
        total: 0,
      };
    }
    acc[key].payments.push(payment);
    acc[key].total += payment.amount;
    return acc;
  }, {}) || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Begrüßung */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Willkommen, {user?.displayName || user?.username}!
        </h1>
        <p className="text-slate-400 mt-1">
          Hier ist die Übersicht über das LSPD Personalsystem.
        </p>
      </div>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Mitarbeiter Gesamt */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Mitarbeiter Gesamt</p>
              <p className="stat-value">{stats?.totalEmployees || 0}</p>
            </div>
            <div className="p-3 bg-primary-900/50 rounded-xl">
              <Users className="h-6 w-6 text-primary-400" />
            </div>
          </div>
        </div>

        {/* Aktive Mitarbeiter */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Aktive Mitarbeiter</p>
              <p className="stat-value">{stats?.activeEmployees || 0}</p>
            </div>
            <div className="p-3 bg-green-900/50 rounded-xl">
              <UserCheck className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>

        {/* Abwesend */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Abwesend</p>
              <p className="stat-value">{stats?.onLeaveEmployees || 0}</p>
            </div>
            <div className="p-3 bg-yellow-900/50 rounded-xl">
              <UserMinus className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Meine Sonderzahlungen diese Woche */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Meine Boni (diese Woche)</p>
              <p className="stat-value text-yellow-400">${myBonus?.summary?.total?.toLocaleString() || 0}</p>
              <p className="text-xs text-slate-400 mt-1">
                {myBonus?.summary?.count || 0} Tätigkeiten
              </p>
            </div>
            <div className="p-3 bg-yellow-900/50 rounded-xl">
              <DollarSign className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
        </div>

      </div>

      {/* Online Benutzer & Aktive Abmeldungen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Online Benutzer */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Online Benutzer</h2>
            <span className="badge-success">{onlineUsers.length} Online</span>
          </div>
          <div className="card-body">
            {onlineUsers.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Keine Benutzer online</p>
            ) : (
              <div className="space-y-3">
                {onlineUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={
                          u.avatar ||
                          `https://ui-avatars.com/api/?name=${u.username}&background=random`
                        }
                        alt={u.username}
                        className="h-10 w-10 rounded-full"
                      />
                      <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-slate-800"></span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {u.displayName || u.username}
                      </p>
                      <p className="text-xs text-slate-400">@{u.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aktive Abmeldungen & Dienstfrei */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Abmeldungen & Dienstfrei</h2>
            </div>
            <span className="badge-warning">{activeAbsences?.length || 0} Aktiv</span>
          </div>
          <div className="card-body">
            {!activeAbsences?.length ? (
              <p className="text-slate-400 text-center py-4">Keine aktiven Abmeldungen</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activeAbsences.map((absence) => (
                  <div key={absence.id} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                    <img
                      src={
                        absence.employee.user.avatar ||
                        `https://ui-avatars.com/api/?name=${absence.employee.user.username}&background=random`
                      }
                      alt={absence.employee.user.username}
                      className="h-10 w-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {absence.employee.user.displayName || absence.employee.user.username}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            absence.type === 'DAY_OFF'
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'bg-orange-600/20 text-orange-400'
                          }`}
                        >
                          {absence.type === 'DAY_OFF' ? 'Dienstfrei' : 'Abmeldung'}
                        </span>
                        {absence.reason && (
                          <span className="text-xs text-slate-400 truncate">{absence.reason}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meine Sonderzahlungen Details */}
      {myBonus && myBonus.payments.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Meine Sonderzahlungen diese Woche</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {new Date(myBonus.weekStart).toLocaleDateString('de-DE')} - {new Date(myBonus.weekEnd).toLocaleDateString('de-DE')}
              </span>
              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-sm font-medium">
                ${myBonus.summary.total.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {myBonus.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{payment.config.displayName}</p>
                    {payment.reason && (
                      <p className="text-xs text-slate-400 mt-0.5">{payment.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        payment.status === 'PAID'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}
                    >
                      {payment.status === 'PAID' ? 'Bezahlt' : 'Offen'}
                    </span>
                    <span className="text-sm font-medium text-yellow-400">
                      ${payment.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Zusammenfassung */}
            <div className="mt-4 pt-4 border-t border-slate-600 flex items-center justify-between">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-400">Offen</p>
                  <p className="text-sm font-medium text-orange-400">${myBonus.summary.pending.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Bezahlt</p>
                  <p className="text-sm font-medium text-green-400">${myBonus.summary.paid.toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Gesamt</p>
                <p className="text-lg font-bold text-yellow-400">${myBonus.summary.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alle Mitarbeiter Sonderzahlungen (nur für berechtigte Benutzer) */}
      {canViewAllBonuses && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Alle Sonderzahlungen diese Woche</h2>
            </div>
            <div className="flex items-center gap-3">
              {bonusSummary && (
                <>
                  <span className="text-xs text-slate-400">
                    {new Date(bonusSummary.weekStart).toLocaleDateString('de-DE')} - {new Date(bonusSummary.weekEnd).toLocaleDateString('de-DE')}
                  </span>
                  <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-sm font-medium">
                    ${bonusSummary.totals.totalAmount.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="card-body">
            {Object.keys(groupedByEmployee).length === 0 ? (
              <p className="text-slate-400 text-center py-4">Keine Sonderzahlungen diese Woche</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.values(groupedByEmployee)
                  .sort((a, b) => b.total - a.total)
                  .map((group) => (
                    <div key={group.employee.id} className="p-4 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              group.employee.user.avatar ||
                              `https://ui-avatars.com/api/?name=${group.employee.user.username}&background=random`
                            }
                            alt={group.employee.user.username}
                            className="h-10 w-10 rounded-full"
                          />
                          <div>
                            <p className="text-sm font-medium text-white">
                              {group.employee.user.displayName || group.employee.user.username}
                            </p>
                            <p className="text-xs text-slate-400">
                              {group.employee.rank} {group.employee.badgeNumber && `• #${group.employee.badgeNumber}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-yellow-400">
                            ${group.total.toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-400">
                            {group.payments.length} {group.payments.length === 1 ? 'Tätigkeit' : 'Tätigkeiten'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5 pl-13">
                        {group.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between text-sm py-1.5 px-3 bg-slate-600/30 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-white">{payment.config.displayName}</span>
                              {payment.reason && (
                                <span className="text-slate-400 text-xs">({payment.reason})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  payment.status === 'PAID'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-orange-500/20 text-orange-400'
                                }`}
                              >
                                {payment.status === 'PAID' ? 'Bezahlt' : 'Offen'}
                              </span>
                              <span className="text-yellow-400 font-medium">
                                ${payment.amount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Gesamtübersicht */}
            {bonusSummary && (
              <div className="mt-4 pt-4 border-t border-slate-600 flex items-center justify-between">
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-slate-400">Offen</p>
                    <p className="text-sm font-medium text-orange-400">
                      ${bonusSummary.totals.pendingAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Bezahlt</p>
                    <p className="text-sm font-medium text-green-400">
                      ${bonusSummary.totals.paidAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Mitarbeiter</p>
                    <p className="text-sm font-medium text-slate-300">
                      {bonusSummary.totals.employeeCount}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Gesamt diese Woche</p>
                  <p className="text-lg font-bold text-purple-400">
                    ${bonusSummary.totals.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
