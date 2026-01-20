import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../services/api';
import { StatusBadge } from '../components/ui/Badge';
import DutyTimeCard from '../components/DutyTimeCard';
import {
  ArrowLeft,
  Edit,
  Clock,
  X,
  Save,
  CalendarOff,
  TrendingUp,
  ArrowUp,
  DollarSign,
  Briefcase,
  GraduationCap,
  ShieldAlert,
  Search,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import clsx from 'clsx';

interface AbsenceData {
  id: string;
  type: 'ABSENCE' | 'DAY_OFF';
  reason: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface EmployeeDetailData {
  id: string;
  userId: string;
  badgeNumber: string | null;
  rank: string;
  rankLevel: number;
  department: string;
  status: string;
  hireDate: string;
  notes: string | null;
  absences: AbsenceData[];
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    role: { id: string; name: string; displayName: string; color: string } | null;
  };
}

interface PromotionData {
  id: string;
  oldRank: string;
  oldRankLevel: number;
  newRank: string;
  newRankLevel: number;
  reason: string | null;
  promotedAt: string;
  promotedBy: {
    displayName: string | null;
    username: string;
  };
}

interface BonusPaymentData {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  createdAt: string;
  paidAt: string | null;
  config: {
    displayName: string;
    category: string;
    activityType: string;
  };
  paidBy: {
    displayName: string | null;
    username: string;
  } | null;
}

interface BonusStats {
  totalEarned: number;
  totalPending: number;
  paymentCount: number;
  byCategory: Record<string, { count: number; amount: number }>;
}

interface UnitStats {
  departments: string[];
  stats: {
    academy: {
      trainingsCompleted: number;
      trainingsParticipated: number;
      examsGiven: number;
      modulesCompleted: number;
      retrainingsCompleted: number;
      total: number;
    };
    internalAffairs: {
      investigationsOpened: number;
      investigationsClosed: number;
      unitReviews: number;
      total: number;
    };
    detective: {
      casesOpened: number;
      casesClosed: number;
      total: number;
    };
    humanResources: {
      applicationsProcessed: number;
      total: number;
    };
  };
}

const formatDate = (date: string) => {
  return format(new Date(date), 'dd.MM.yyyy', { locale: de });
};

const formatDateTime = (date: string) => {
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: de });
};

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Woher kam der Benutzer?
  const fromPage = searchParams.get('from');

  // Navigation zurück zur richtigen Seite
  const handleGoBack = () => {
    if (fromPage === 'management') {
      navigate('/management');
    } else {
      navigate('/employees');
    }
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [unitStatsPeriod, setUnitStatsPeriod] = useState<'week' | 'month' | 'all'>('all');
  const [editForm, setEditForm] = useState({
    badgeNumber: '',
    displayName: '',
    status: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getById(id!),
    enabled: !!id,
  });

  // Beförderungshistorie
  const { data: promotionsData } = useQuery({
    queryKey: ['employee', id, 'promotions'],
    queryFn: () => employeesApi.getPromotions(id!),
    enabled: !!id,
  });

  // Sonderzahlungen
  const { data: bonusesData } = useQuery({
    queryKey: ['employee', id, 'bonuses'],
    queryFn: () => employeesApi.getBonuses(id!, 10),
    enabled: !!id,
  });

  // Unit-Statistiken
  const { data: unitStatsData } = useQuery({
    queryKey: ['employee', id, 'unit-stats', unitStatsPeriod],
    queryFn: () => employeesApi.getUnitStats(id!, unitStatsPeriod),
    enabled: !!id,
  });

  const employee = data?.data as EmployeeDetailData | undefined;
  const promotions = (promotionsData?.data || []) as PromotionData[];
  const bonusPayments = (bonusesData?.data?.payments || []) as BonusPaymentData[];
  const bonusStats = bonusesData?.data?.stats as BonusStats | undefined;
  const unitStats = unitStatsData?.data as UnitStats | undefined;

  const updateMutation = useMutation({
    mutationFn: (data: typeof editForm) => employeesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEditModalOpen(false);
    },
  });

  // Namen ohne Badge-Prefix extrahieren
  const cleanDisplayName = (name: string | null | undefined) => {
    if (!name) return '';
    return name.replace(/^\[[A-Z]+-\d+\]\s*/, '').trim();
  };

  const openEditModal = () => {
    if (employee) {
      setEditForm({
        badgeNumber: employee.badgeNumber || '',
        displayName: cleanDisplayName(employee.user?.displayName),
        status: employee.status || 'ACTIVE',
      });
      setIsEditModalOpen(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Mitarbeiter nicht gefunden</p>
        <button onClick={handleGoBack} className="btn-primary mt-4">
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGoBack}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Mitarbeiter Details</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/uprank-request?employeeId=${employee.id}`)}
            className="btn-primary"
          >
            <TrendingUp className="h-4 w-4" />
            Uprank Antrag einreichen
          </button>
          <button onClick={openEditModal} className="btn-secondary">
            <Edit className="h-4 w-4" />
            Bearbeiten
          </button>
        </div>
      </div>

      {/* Profil-Karte */}
      <div className="card p-6">
        <div className="flex items-start gap-6">
          <img
            src={
              employee.user?.avatar ||
              `https://ui-avatars.com/api/?name=${employee.user?.username}&background=random&size=128`
            }
            alt={employee.user?.username}
            className="h-32 w-32 rounded-xl"
          />
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-2xl font-bold text-white">
                {employee.user?.displayName || employee.user?.username}
              </h2>
              <StatusBadge status={employee.status} />
            </div>
            <p className="text-slate-400 mb-4">@{employee.user?.username}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-400">Badge</p>
                <p className="text-white font-medium">{employee.badgeNumber || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Rang</p>
                <p className="text-white font-medium">{employee.rank}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Abteilung</p>
                <p className="text-white font-medium">{employee.department || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Eingestellt am</p>
                <p className="text-white font-medium">
                  {format(new Date(employee.hireDate), 'dd.MM.yyyy', { locale: de })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {employee.notes && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Notizen</h3>
            <p className="text-slate-300">{employee.notes}</p>
          </div>
        )}
      </div>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Beförderungen */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{promotions.length}</p>
              <p className="text-sm text-slate-400">Beförderungen</p>
            </div>
          </div>
        </div>

        {/* Sonderzahlungen Total */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                ${(bonusStats?.totalEarned || 0).toLocaleString()}
              </p>
              <p className="text-sm text-slate-400">Sonderzahlungen erhalten</p>
            </div>
          </div>
        </div>

        {/* Unit-Aktivitäten */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Briefcase className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {unitStats ? (
                  unitStats.stats.academy.total +
                  unitStats.stats.internalAffairs.total +
                  unitStats.stats.detective.total +
                  unitStats.stats.humanResources.total
                ) : 0}
              </p>
              <p className="text-sm text-slate-400">Unit-Aktivitäten</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dienstzeiten (Leitstelle) */}
      <DutyTimeCard employeeId={employee.id} />

      {/* Zwei-Spalten-Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Beförderungshistorie */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <h3 className="font-semibold text-white">Beförderungshistorie</h3>
          </div>
          <div className="card-body">
            {promotions.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Keine Beförderungen vorhanden</p>
            ) : (
              <div className="space-y-3">
                {promotions.map((promotion) => (
                  <div
                    key={promotion.id}
                    className="p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-slate-400">{promotion.oldRank}</span>
                      <ArrowUp className="h-4 w-4 text-green-400" />
                      <span className="text-green-400 font-medium">{promotion.newRank}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(promotion.promotedAt)}</span>
                      <span>
                        von {promotion.promotedBy.displayName || promotion.promotedBy.username}
                      </span>
                    </div>
                    {promotion.reason && (
                      <p className="text-xs text-slate-400 mt-2">{promotion.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Letzte Sonderzahlungen */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-400" />
              <h3 className="font-semibold text-white">Letzte Sonderzahlungen</h3>
            </div>
            {bonusStats && bonusStats.totalPending > 0 && (
              <span className="text-xs text-yellow-400">
                ${bonusStats.totalPending.toLocaleString()} offen
              </span>
            )}
          </div>
          <div className="card-body">
            {bonusPayments.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Keine Sonderzahlungen vorhanden</p>
            ) : (
              <div className="space-y-2">
                {bonusPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm text-white">{payment.config.displayName}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(payment.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-yellow-400">
                        ${payment.amount.toLocaleString()}
                      </p>
                      <span
                        className={clsx(
                          'text-xs px-1.5 py-0.5 rounded',
                          payment.status === 'PAID'
                            ? 'bg-green-500/20 text-green-400'
                            : payment.status === 'PENDING'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-slate-500/20 text-slate-400'
                        )}
                      >
                        {payment.status === 'PAID'
                          ? 'Bezahlt'
                          : payment.status === 'PENDING'
                          ? 'Offen'
                          : 'Storniert'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Abmeldungen */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <CalendarOff className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-white">Letzte Abmeldungen</h3>
        </div>
        <div className="card-body">
          {!employee.absences?.length ? (
            <p className="text-slate-400 text-center py-4">Keine Abmeldungen vorhanden</p>
          ) : (
            <div className="space-y-4">
              {employee.absences.map((absence) => {
                const isActive = () => {
                  const now = new Date();
                  const start = new Date(absence.startDate);
                  const end = new Date(absence.endDate);
                  return now >= start && now <= end;
                };

                return (
                  <div
                    key={absence.id}
                    className={`p-4 bg-slate-700/50 rounded-lg border border-slate-600 ${
                      isActive() ? 'border-l-4 border-l-green-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            absence.type === 'DAY_OFF'
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'bg-orange-600/20 text-orange-400'
                          }`}
                        >
                          {absence.type === 'DAY_OFF' ? 'Dienstfrei' : 'Abmeldung'}
                        </span>
                        {isActive() && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-600/20 text-green-400">
                            Aktiv
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Clock className="h-4 w-4" />
                      {format(new Date(absence.startDate), 'dd.MM.yyyy', { locale: de })}
                      {absence.startDate !== absence.endDate && (
                        <> - {format(new Date(absence.endDate), 'dd.MM.yyyy', { locale: de })}</>
                      )}
                    </div>
                    {absence.reason && (
                      <p className="text-sm text-slate-400 mt-2">{absence.reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unit-Statistiken */}
      {unitStats && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-purple-400" />
              <h3 className="font-semibold text-white">Unit-Aktivitäten</h3>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setUnitStatsPeriod('week')}
                className={clsx(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  unitStatsPeriod === 'week'
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                )}
              >
                Woche
              </button>
              <button
                onClick={() => setUnitStatsPeriod('month')}
                className={clsx(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  unitStatsPeriod === 'month'
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                )}
              >
                Monat
              </button>
              <button
                onClick={() => setUnitStatsPeriod('all')}
                className={clsx(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  unitStatsPeriod === 'all'
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                )}
              >
                Gesamt
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Academy */}
              <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="h-5 w-5 text-blue-400" />
                  <h4 className="font-medium text-white">Police Academy</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Schulungen durchgeführt</span>
                    <span className="text-white">{unitStats.stats.academy.trainingsCompleted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Prüfungen abgenommen</span>
                    <span className="text-white">{unitStats.stats.academy.examsGiven}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Module abgeschlossen</span>
                    <span className="text-white">{unitStats.stats.academy.modulesCompleted || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nachschulungen</span>
                    <span className="text-white">{unitStats.stats.academy.retrainingsCompleted || 0}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
                    <span className="text-slate-400">Schulungen besucht</span>
                    <span className="text-white">{unitStats.stats.academy.trainingsParticipated}</span>
                  </div>
                </div>
              </div>

              {/* Internal Affairs */}
              <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                  <h4 className="font-medium text-white">Internal Affairs</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ermittlungen eröffnet</span>
                    <span className="text-white">{unitStats.stats.internalAffairs.investigationsOpened}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ermittlungen abgeschlossen</span>
                    <span className="text-white">{unitStats.stats.internalAffairs.investigationsClosed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Unit-Überprüfungen</span>
                    <span className="text-white">{unitStats.stats.internalAffairs.unitReviews}</span>
                  </div>
                </div>
              </div>

              {/* Detective */}
              <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-5 w-5 text-orange-400" />
                  <h4 className="font-medium text-white">Detektive</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Akten eröffnet</span>
                    <span className="text-white">{unitStats.stats.detective.casesOpened}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Akten abgeschlossen</span>
                    <span className="text-white">{unitStats.stats.detective.casesClosed}</span>
                  </div>
                </div>
              </div>

              {/* Human Resources */}
              <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-green-400" />
                  <h4 className="font-medium text-white">Human Resources</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bewerbungen bearbeitet</span>
                    <span className="text-white">{unitStats.stats.humanResources.applicationsProcessed}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg mx-4 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Mitarbeiter bearbeiten</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="input w-full"
                  placeholder="z.B. Jack Ripper"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Badge-Nummer
                </label>
                <input
                  type="text"
                  value={editForm.badgeNumber}
                  onChange={(e) => setEditForm({ ...editForm, badgeNumber: e.target.value })}
                  className="input w-full"
                  placeholder="z.B. PD-104"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="input w-full"
                >
                  <option value="ACTIVE">Aktiv</option>
                  <option value="INACTIVE">Inaktiv</option>
                  <option value="ON_LEAVE">Abwesend</option>
                  <option value="SUSPENDED">Suspendiert</option>
                  <option value="TERMINATED">Entlassen</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="btn-ghost"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
