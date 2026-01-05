import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uprankRequestsApi, tuningApi, employeesApi, bonusApi, archiveApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  Building2,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  X,
  User,
  ArrowUp,
  Image,
  Trash2,
  UserMinus,
  Wallet,
  Check,
  Archive,
  UserPlus,
  UserX,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface UprankRequest {
  id: string;
  employeeId: string;
  currentRank: string;
  targetRank: string;
  reason: string;
  achievements: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
  processedAt: string | null;
  employee: {
    id: string;
    rank: string;
    badgeNumber: string | null;
    user: {
      displayName: string | null;
      username: string;
    };
  };
  requestedBy: {
    id: string;
    displayName: string | null;
    username: string;
  };
  processedBy: {
    displayName: string | null;
    username: string;
  } | null;
}

interface TuningInvoice {
  id: string;
  amount: number;
  imagePath: string;
  status: string;
  createdAt: string;
  submittedBy: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

interface Employee {
  id: string;
  rank: string;
  rankLevel: number;
  badgeNumber: string | null;
  department: string;
  status: string;
  user: {
    id: string;
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

interface BonusPayment {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  createdAt: string;
  paidAt: string | null;
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
  paidBy?: {
    displayName: string | null;
    username: string;
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

interface PromotionArchive {
  id: string;
  employeeId: string;
  oldRank: string;
  oldRankLevel: number;
  newRank: string;
  newRankLevel: number;
  reason: string | null;
  promotedAt: string;
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
  promotedBy: {
    displayName: string | null;
    username: string;
  };
}

interface TerminationArchive {
  id: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  badgeNumber: string | null;
  rankName: string;
  hireDate: string | null;
  terminationType: string;
  reason: string | null;
  terminatedAt: string;
  terminatedBy: {
    displayName: string | null;
    username: string;
  } | null;
}

interface ApplicationArchive {
  id: string;
  applicantName: string;
  applicationDate: string;
  status: string;
  rejectionReason: string | null;
  processedAt: string | null;
  createdBy: {
    displayName: string | null;
    username: string;
  };
  processedBy: {
    displayName: string | null;
    username: string;
  } | null;
}

interface ArchiveStats {
  promotions: {
    total: number;
    recent: number;
  };
  terminations: {
    total: number;
    recent: number;
  };
  applications: {
    completed: number;
    rejected: number;
    recent: number;
  };
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function Management() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const canManageUprank = permissions.hasAnyPermission('management.uprank', 'admin.full');
  const canManageTuning = permissions.hasAnyPermission('tuning.manage', 'admin.full');
  const canManageBonus = permissions.hasAnyPermission('bonus.pay', 'admin.full');

  const [activeTab, setActiveTab] = useState<'uprank' | 'tuning' | 'nounit' | 'bonus' | 'archive'>('uprank');
  const [selectedRequest, setSelectedRequest] = useState<UprankRequest | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<TuningInvoice | null>(null);
  const [filter, setFilter] = useState<string>('PENDING');
  const [bonusFilter, setBonusFilter] = useState<'PENDING' | 'PAID' | 'all'>('PENDING');
  const [archiveTab, setArchiveTab] = useState<'promotions' | 'terminations' | 'applications'>('promotions');
  const [archiveAppFilter, setArchiveAppFilter] = useState<'ALL' | 'COMPLETED' | 'REJECTED'>('ALL');

  // Uprank Requests Queries
  const { data: uprankStats } = useQuery({
    queryKey: ['uprank-requests', 'stats'],
    queryFn: () => uprankRequestsApi.getStats().then(res => res.data),
  });

  const { data: uprankRequests = [], isLoading: isLoadingUprank } = useQuery({
    queryKey: ['uprank-requests', filter],
    queryFn: () => uprankRequestsApi.getAll(filter !== 'all' ? { status: filter } : {}).then(res => res.data),
  });

  // Tuning Queries
  const { data: tuningStats } = useQuery({
    queryKey: ['tuning', 'stats'],
    queryFn: () => tuningApi.getStats().then(res => res.data),
  });

  const { data: tuningInvoices = [], isLoading: isLoadingTuning } = useQuery({
    queryKey: ['tuning'],
    queryFn: () => tuningApi.getAll().then(res => res.data),
  });

  // Employees without Unit Query
  const { data: allEmployeesData, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesApi.getAll({ limit: '1000' }).then(res => res.data),
  });

  // Filter employees without unit (department is empty or only contains default)
  const employeesWithoutUnit = (allEmployeesData?.data || []).filter((emp: Employee) => {
    const dept = emp.department?.trim() || '';
    return dept === '' || dept === 'Patrol' || dept === '-';
  });

  // Bonus Queries
  const { data: bonusSummary } = useQuery<BonusSummary>({
    queryKey: ['bonus', 'summary'],
    queryFn: () => bonusApi.getSummary().then(res => res.data),
  });

  const { data: bonusPayments = [], isLoading: isLoadingBonus } = useQuery<BonusPayment[]>({
    queryKey: ['bonus', 'payments', bonusFilter],
    queryFn: () => bonusApi.getPayments(bonusFilter !== 'all' ? { status: bonusFilter } : {}).then(res => res.data),
  });

  // Archive Queries
  const { data: archiveStats } = useQuery<ArchiveStats>({
    queryKey: ['archive', 'stats'],
    queryFn: () => archiveApi.getStats().then(res => res.data),
    enabled: activeTab === 'archive',
  });

  const { data: promotionsData, isLoading: isLoadingPromotions } = useQuery<{ data: PromotionArchive[]; total: number }>({
    queryKey: ['archive', 'promotions'],
    queryFn: () => archiveApi.getPromotions({ limit: '100' }).then(res => res.data),
    enabled: activeTab === 'archive' && archiveTab === 'promotions',
  });

  const { data: terminationsData, isLoading: isLoadingTerminations } = useQuery<{ data: TerminationArchive[]; total: number }>({
    queryKey: ['archive', 'terminations'],
    queryFn: () => archiveApi.getTerminations({ limit: '100' }).then(res => res.data),
    enabled: activeTab === 'archive' && archiveTab === 'terminations',
  });

  const { data: applicationsData, isLoading: isLoadingApplications } = useQuery<{ data: ApplicationArchive[]; total: number }>({
    queryKey: ['archive', 'applications', archiveAppFilter],
    queryFn: () => archiveApi.getApplications({ limit: '100', status: archiveAppFilter }).then(res => res.data),
    enabled: activeTab === 'archive' && archiveTab === 'applications',
  });

  // Mutations
  const processRequest = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string } }) =>
      uprankRequestsApi.process(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uprank-requests'] });
      setSelectedRequest(null);
      toast.success('Antrag bearbeitet');
    },
    onError: () => {
      toast.error('Fehler beim Bearbeiten des Antrags');
    },
  });

  const completeTuning = useMutation({
    mutationFn: tuningApi.complete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuning'] });
      setSelectedInvoice(null);
      toast.success('Rechnung als bezahlt markiert');
    },
    onError: () => {
      toast.error('Fehler beim Markieren der Rechnung');
    },
  });

  const deleteTuning = useMutation({
    mutationFn: tuningApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuning'] });
      setSelectedInvoice(null);
      toast.success('Rechnung gelöscht');
    },
  });

  // Bonus Mutations
  const payBonus = useMutation({
    mutationFn: (id: string) => bonusApi.payBonus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus'] });
      toast.success('Bonus als bezahlt markiert');
    },
    onError: () => {
      toast.error('Fehler beim Bezahlen');
    },
  });

  const payEmployeeBonuses = useMutation({
    mutationFn: (employeeId: string) => bonusApi.payEmployee(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus'] });
      toast.success('Alle Boni des Mitarbeiters bezahlt');
    },
    onError: () => {
      toast.error('Fehler beim Bezahlen');
    },
  });

  const payAllBonuses = useMutation({
    mutationFn: () => bonusApi.payAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus'] });
      toast.success('Alle offenen Boni bezahlt');
    },
    onError: () => {
      toast.error('Fehler beim Bezahlen');
    },
  });

  // Group bonuses by employee
  const groupedBonuses = bonusPayments.reduce((acc: Record<string, { employee: BonusPayment['employee']; payments: BonusPayment[]; total: number }>, payment) => {
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
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="h-8 w-8 text-purple-400" />
            Management
          </h1>
          <p className="text-slate-400 mt-1">Uprank-Anträge, Tuning-Rechnungen und Mitarbeiterverwaltung</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('uprank')}
          className={clsx(
            'px-4 py-2 -mb-px transition-colors',
            activeTab === 'uprank'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Uprank-Anträge
            {uprankStats?.pending > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                {uprankStats.pending}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('tuning')}
          className={clsx(
            'px-4 py-2 -mb-px transition-colors',
            activeTab === 'tuning'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Tuning-Rechnungen
            {tuningStats?.offen > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                {tuningStats.offen}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('nounit')}
          className={clsx(
            'px-4 py-2 -mb-px transition-colors',
            activeTab === 'nounit'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <div className="flex items-center gap-2">
            <UserMinus className="h-4 w-4" />
            Ohne Unit
            {employeesWithoutUnit.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                {employeesWithoutUnit.length}
              </span>
            )}
          </div>
        </button>
        {canManageBonus && (
          <button
            onClick={() => setActiveTab('bonus')}
            className={clsx(
              'px-4 py-2 -mb-px transition-colors',
              activeTab === 'bonus'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Sonderzahlungen
              {bonusSummary && bonusSummary.totals.paymentCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                  {bonusSummary.totals.paymentCount}
                </span>
              )}
            </div>
          </button>
        )}
        <button
          onClick={() => setActiveTab('archive')}
          className={clsx(
            'px-4 py-2 -mb-px transition-colors',
            activeTab === 'archive'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archiv
          </div>
        </button>
      </div>

      {/* Uprank Tab */}
      {activeTab === 'uprank' && (
        <>
          {/* Stats */}
          {uprankStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-500/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{uprankStats.total}</p>
                    <p className="text-sm text-slate-400">Gesamt</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{uprankStats.pending}</p>
                    <p className="text-sm text-slate-400">Ausstehend</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{uprankStats.approved}</p>
                    <p className="text-sm text-slate-400">Genehmigt</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{uprankStats.rejected}</p>
                    <p className="text-sm text-slate-400">Abgelehnt</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="flex gap-2">
            {['PENDING', 'APPROVED', 'REJECTED', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={clsx(
                  'px-4 py-2 rounded-lg transition-colors',
                  filter === status
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {status === 'PENDING' ? 'Ausstehend' :
                 status === 'APPROVED' ? 'Genehmigt' :
                 status === 'REJECTED' ? 'Abgelehnt' : 'Alle'}
              </button>
            ))}
          </div>

          {/* Requests List */}
          <div className="card">
            {isLoadingUprank ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : uprankRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Keine Uprank-Anträge gefunden
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {uprankRequests.map((request: UprankRequest) => (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className="p-4 hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-white">
                            {request.employee.user.displayName || request.employee.user.username}
                          </span>
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs',
                            request.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                            request.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                            'bg-red-500/20 text-red-400'
                          )}>
                            {request.status === 'PENDING' ? 'Ausstehend' :
                             request.status === 'APPROVED' ? 'Genehmigt' : 'Abgelehnt'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <span className="text-slate-400">{request.currentRank}</span>
                          <ArrowUp className="h-4 w-4 text-green-400" />
                          <span className="text-green-400 font-medium">{request.targetRank}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <span>Beantragt von: {request.requestedBy.displayName || request.requestedBy.username}</span>
                          <span>{formatDate(request.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Tuning Tab */}
      {activeTab === 'tuning' && (
        <>
          {/* Stats */}
          {tuningStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{tuningStats.offen}</p>
                    <p className="text-sm text-slate-400">Offene Rechnungen</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{formatCurrency(tuningStats.summe)}</p>
                    <p className="text-sm text-slate-400">Gesamtsumme</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoices List */}
          <div className="card">
            {isLoadingTuning ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : tuningInvoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Keine offenen Tuning-Rechnungen
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {tuningInvoices.map((invoice: TuningInvoice) => (
                  <div
                    key={invoice.id}
                    onClick={() => setSelectedInvoice(invoice)}
                    className="p-4 hover:bg-slate-700/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden">
                          <Image className="h-6 w-6 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{formatCurrency(invoice.amount)}</p>
                          <p className="text-sm text-slate-400">
                            von {invoice.submittedBy.displayName || invoice.submittedBy.username}
                          </p>
                          <p className="text-xs text-slate-500">{formatDateTime(invoice.createdAt)}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* No Unit Tab */}
      {activeTab === 'nounit' && (
        <>
          {/* Stats */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <UserMinus className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{employeesWithoutUnit.length}</p>
                <p className="text-sm text-slate-400">Mitarbeiter ohne Unit-Zuweisung</p>
              </div>
            </div>
          </div>

          {/* Employees List */}
          <div className="card">
            {isLoadingEmployees ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : employeesWithoutUnit.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Alle Mitarbeiter sind einer Unit zugewiesen
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {employeesWithoutUnit.map((employee: Employee) => (
                  <div
                    key={employee.id}
                    className="p-4 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                          {employee.user.avatar ? (
                            <img src={employee.user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {employee.user.displayName || employee.user.username}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>{employee.rank}</span>
                            {employee.badgeNumber && (
                              <>
                                <span>•</span>
                                <span>#{employee.badgeNumber}</span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {employee.department || 'Keine Unit'}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`/employees/${employee.id}`}
                        className="btn-secondary text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Profil öffnen
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Bonus Tab */}
      {activeTab === 'bonus' && canManageBonus && (
        <>
          {/* Summary */}
          {bonusSummary && (
            <div className="space-y-4">
              <div className="text-sm text-slate-400">
                Woche: {new Date(bonusSummary.weekStart).toLocaleDateString('de-DE')} - {new Date(bonusSummary.weekEnd).toLocaleDateString('de-DE')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <Clock className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-400">${bonusSummary.totals.pendingAmount.toLocaleString()}</p>
                      <p className="text-sm text-slate-400">{bonusSummary.totals.paymentCount} offene Zahlungen</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">${bonusSummary.totals.paidAmount.toLocaleString()}</p>
                      <p className="text-sm text-slate-400">{bonusSummary.totals.employeeCount} Mitarbeiter</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4 flex items-center justify-center">
                  {bonusSummary.totals.pendingAmount > 0 && (
                    <button
                      onClick={() => {
                        if (confirm(`Alle offenen Boni (${formatCurrency(bonusSummary.totals.pendingAmount)}) bezahlen?`)) {
                          payAllBonuses.mutate();
                        }
                      }}
                      className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2"
                      disabled={payAllBonuses.isPending}
                    >
                      <Check className="h-4 w-4" />
                      Alle bezahlen
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="flex gap-2">
            {(['PENDING', 'PAID', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setBonusFilter(status)}
                className={clsx(
                  'px-4 py-2 rounded-lg transition-colors',
                  bonusFilter === status
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {status === 'PENDING' ? 'Offen' :
                 status === 'PAID' ? 'Bezahlt' : 'Alle'}
              </button>
            ))}
          </div>

          {/* Grouped Payments List */}
          <div className="space-y-4">
            {isLoadingBonus ? (
              <div className="card p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : Object.keys(groupedBonuses).length === 0 ? (
              <div className="card p-8 text-center text-slate-400">
                Keine Sonderzahlungen gefunden
              </div>
            ) : (
              Object.values(groupedBonuses).map(({ employee, payments, total }) => (
                <div key={employee.id} className="card">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {employee.user.avatar ? (
                          <img src={employee.user.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-6 w-6 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {employee.user.displayName || employee.user.username}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <span>{employee.rank}</span>
                          {employee.badgeNumber && (
                            <>
                              <span>•</span>
                              <span>#{employee.badgeNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-yellow-400">${total.toLocaleString()}</p>
                        <p className="text-sm text-slate-400">{payments.length} Tätigkeiten</p>
                      </div>
                      {bonusFilter === 'PENDING' && (
                        <button
                          onClick={() => payEmployeeBonuses.mutate(employee.id)}
                          className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2"
                          disabled={payEmployeeBonuses.isPending}
                        >
                          <Check className="h-4 w-4" />
                          Alle bezahlen
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {payments.map((payment) => (
                      <div key={payment.id} className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{payment.config.displayName}</p>
                          {payment.reason && (
                            <p className="text-xs text-slate-400">{payment.reason}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDateTime(payment.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs',
                            payment.status === 'PENDING'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-green-500/20 text-green-400'
                          )}>
                            {payment.status === 'PENDING' ? 'Offen' : 'Bezahlt'}
                          </span>
                          <span className="text-sm font-medium text-yellow-400">
                            ${payment.amount.toLocaleString()}
                          </span>
                          {payment.status === 'PENDING' && (
                            <button
                              onClick={() => payBonus.mutate(payment.id)}
                              className="p-1 hover:bg-green-500/20 rounded transition-colors"
                              title="Als bezahlt markieren"
                              disabled={payBonus.isPending}
                            >
                              <Check className="h-4 w-4 text-green-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Archive Tab */}
      {activeTab === 'archive' && (
        <>
          {/* Archive Stats */}
          {archiveStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{archiveStats.promotions.total}</p>
                    <p className="text-sm text-slate-400">Beförderungen gesamt</p>
                    <p className="text-xs text-green-400">+{archiveStats.promotions.recent} letzte 30 Tage</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <UserX className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{archiveStats.terminations.total}</p>
                    <p className="text-sm text-slate-400">Kündigungen gesamt</p>
                    <p className="text-xs text-red-400">+{archiveStats.terminations.recent} letzte 30 Tage</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <UserPlus className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{archiveStats.applications.completed + archiveStats.applications.rejected}</p>
                    <p className="text-sm text-slate-400">Bewerbungen abgeschlossen</p>
                    <p className="text-xs text-blue-400">+{archiveStats.applications.recent} letzte 30 Tage</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Archive Sub-Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setArchiveTab('promotions')}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
                archiveTab === 'promotions'
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <TrendingUp className="h-4 w-4" />
              Beförderungen
            </button>
            <button
              onClick={() => setArchiveTab('terminations')}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
                archiveTab === 'terminations'
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <UserX className="h-4 w-4" />
              Kündigungen
            </button>
            <button
              onClick={() => setArchiveTab('applications')}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
                archiveTab === 'applications'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <UserPlus className="h-4 w-4" />
              Bewerbungen
            </button>
          </div>

          {/* Promotions Archive */}
          {archiveTab === 'promotions' && (
            <div className="card">
              {isLoadingPromotions ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : !promotionsData?.data.length ? (
                <div className="p-8 text-center text-slate-400">
                  Keine Beförderungen im Archiv
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {promotionsData.data.map((promotion) => (
                    <div key={promotion.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                            {promotion.employee.user.avatar ? (
                              <img src={promotion.employee.user.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="h-6 w-6 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {promotion.employee.user.displayName || promotion.employee.user.username}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">{promotion.oldRank}</span>
                              <ArrowUp className="h-4 w-4 text-green-400" />
                              <span className="text-green-400 font-medium">{promotion.newRank}</span>
                            </div>
                            {promotion.reason && (
                              <p className="text-xs text-slate-500 mt-1">{promotion.reason}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-400">{formatDate(promotion.promotedAt)}</p>
                          <p className="text-xs text-slate-500">
                            von {promotion.promotedBy.displayName || promotion.promotedBy.username}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Terminations Archive */}
          {archiveTab === 'terminations' && (
            <div className="card">
              {isLoadingTerminations ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : !terminationsData?.data.length ? (
                <div className="p-8 text-center text-slate-400">
                  Keine Kündigungen im Archiv
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {terminationsData.data.map((termination) => (
                    <div key={termination.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                            <UserX className="h-6 w-6 text-red-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {termination.displayName || termination.discordUsername}
                            </p>
                            <p className="text-sm text-slate-400">{termination.rankName}</p>
                            {termination.badgeNumber && (
                              <p className="text-xs text-slate-500">#{termination.badgeNumber}</p>
                            )}
                            {termination.reason && (
                              <p className="text-xs text-slate-500 mt-1">{termination.reason}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs',
                            termination.terminationType === 'RESIGNATION'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : termination.terminationType === 'TERMINATION'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-500/20 text-slate-400'
                          )}>
                            {termination.terminationType === 'RESIGNATION' ? 'Kündigung' :
                             termination.terminationType === 'TERMINATION' ? 'Entlassung' : 'Sonstig'}
                          </span>
                          <p className="text-sm text-slate-400 mt-1">{formatDate(termination.terminatedAt)}</p>
                          {termination.terminatedBy && (
                            <p className="text-xs text-slate-500">
                              von {termination.terminatedBy.displayName || termination.terminatedBy.username}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Applications Archive */}
          {archiveTab === 'applications' && (
            <>
              {/* Application Filter */}
              <div className="flex gap-2 -mt-2">
                {(['ALL', 'COMPLETED', 'REJECTED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setArchiveAppFilter(status)}
                    className={clsx(
                      'px-3 py-1 rounded text-sm transition-colors',
                      archiveAppFilter === status
                        ? status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                          status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                          'bg-purple-500/20 text-purple-400'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    {status === 'ALL' ? 'Alle' :
                     status === 'COMPLETED' ? 'Angenommen' : 'Abgelehnt'}
                  </button>
                ))}
              </div>

              <div className="card">
                {isLoadingApplications ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                  </div>
                ) : !applicationsData?.data.length ? (
                  <div className="p-8 text-center text-slate-400">
                    Keine Bewerbungen im Archiv
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {applicationsData.data.map((application) => (
                      <div key={application.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={clsx(
                              'w-12 h-12 rounded-full flex items-center justify-center',
                              application.status === 'COMPLETED' ? 'bg-green-500/20' : 'bg-red-500/20'
                            )}>
                              {application.status === 'COMPLETED' ? (
                                <UserPlus className="h-6 w-6 text-green-400" />
                              ) : (
                                <XCircle className="h-6 w-6 text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-white">{application.applicantName}</p>
                              <p className="text-sm text-slate-400">
                                Bewerbung vom {formatDate(application.applicationDate)}
                              </p>
                              {application.rejectionReason && (
                                <p className="text-xs text-red-400 mt-1">{application.rejectionReason}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-xs',
                              application.status === 'COMPLETED'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            )}>
                              {application.status === 'COMPLETED' ? 'Angenommen' : 'Abgelehnt'}
                            </span>
                            {application.processedAt && (
                              <p className="text-sm text-slate-400 mt-1">{formatDate(application.processedAt)}</p>
                            )}
                            {application.processedBy && (
                              <p className="text-xs text-slate-500">
                                von {application.processedBy.displayName || application.processedBy.username}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Uprank Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Uprank-Antrag</h2>
                <p className="text-sm text-slate-400">
                  {selectedRequest.employee.user.displayName || selectedRequest.employee.user.username}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs',
                  selectedRequest.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                  selectedRequest.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                )}>
                  {selectedRequest.status === 'PENDING' ? 'Ausstehend' :
                   selectedRequest.status === 'APPROVED' ? 'Genehmigt' : 'Abgelehnt'}
                </span>
                <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Employee Info */}
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                    <User className="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {selectedRequest.employee.user.displayName || selectedRequest.employee.user.username}
                    </p>
                    <p className="text-sm text-slate-400">
                      {selectedRequest.employee.rank}
                      {selectedRequest.employee.badgeNumber && ` • #${selectedRequest.employee.badgeNumber}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rank Change */}
              <div className="p-4 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-400">Aktueller Rang</p>
                    <p className="text-lg font-medium text-white">{selectedRequest.currentRank}</p>
                  </div>
                  <ArrowUp className="h-6 w-6 text-green-400" />
                  <div className="text-center">
                    <p className="text-sm text-slate-400">Neuer Rang</p>
                    <p className="text-lg font-medium text-green-400">{selectedRequest.targetRank}</p>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">Begründung</h3>
                <p className="text-slate-400 bg-slate-700/30 p-3 rounded-lg whitespace-pre-wrap">{selectedRequest.reason}</p>
              </div>

              {/* Achievements */}
              {selectedRequest.achievements && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1">Leistungen</h3>
                  <p className="text-slate-400 bg-slate-700/30 p-3 rounded-lg whitespace-pre-wrap">{selectedRequest.achievements}</p>
                </div>
              )}

              {/* Requester Info */}
              <div className="text-sm text-slate-500">
                <p>Beantragt von: {selectedRequest.requestedBy.displayName || selectedRequest.requestedBy.username}</p>
                <p>Am: {formatDateTime(selectedRequest.createdAt)}</p>
              </div>

              {/* Rejection Reason (if rejected) */}
              {selectedRequest.status === 'REJECTED' && selectedRequest.rejectionReason && (
                <div>
                  <h3 className="text-sm font-medium text-red-400 mb-1">Ablehnungsgrund</h3>
                  <p className="text-slate-400 bg-red-500/10 p-3 rounded-lg">{selectedRequest.rejectionReason}</p>
                  {selectedRequest.processedBy && (
                    <p className="text-xs text-slate-500 mt-1">
                      Abgelehnt von {selectedRequest.processedBy.displayName || selectedRequest.processedBy.username} am {formatDateTime(selectedRequest.processedAt!)}
                    </p>
                  )}
                </div>
              )}

              {/* Approved Info */}
              {selectedRequest.status === 'APPROVED' && selectedRequest.processedBy && (
                <div className="text-sm text-green-400">
                  <p>Genehmigt von {selectedRequest.processedBy.displayName || selectedRequest.processedBy.username}</p>
                  <p>Am: {formatDateTime(selectedRequest.processedAt!)}</p>
                </div>
              )}

              {/* Actions (only for pending) */}
              {canManageUprank && selectedRequest.status === 'PENDING' && (
                <div className="space-y-3 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-slate-300">Antrag bearbeiten</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const status = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-status') as 'APPROVED' | 'REJECTED';

                      if (status === 'REJECTED') {
                        const rejectionReason = formData.get('rejectionReason') as string;
                        if (!rejectionReason.trim()) {
                          toast.error('Bitte gib einen Ablehnungsgrund an');
                          return;
                        }
                        processRequest.mutate({
                          id: selectedRequest.id,
                          data: { status, rejectionReason },
                        });
                      } else {
                        processRequest.mutate({
                          id: selectedRequest.id,
                          data: { status },
                        });
                      }
                    }}
                    className="space-y-3"
                  >
                    <textarea
                      name="rejectionReason"
                      rows={2}
                      className="input w-full"
                      placeholder="Ablehnungsgrund (nur bei Ablehnung erforderlich)"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        data-status="APPROVED"
                        className="flex-1 btn-primary bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                        disabled={processRequest.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Genehmigen
                      </button>
                      <button
                        type="submit"
                        data-status="REJECTED"
                        className="flex-1 btn-secondary bg-red-600/20 hover:bg-red-600/30 text-red-400 flex items-center justify-center gap-2"
                        disabled={processRequest.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                        Ablehnen
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tuning Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Tuning-Rechnung</h2>
                <p className="text-sm text-slate-400">{formatCurrency(selectedInvoice.amount)}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Invoice Image */}
              <div className="rounded-lg overflow-hidden bg-slate-900">
                <img
                  src={`/api${tuningApi.getImageUrl(selectedInvoice.imagePath)}`}
                  alt="Rechnung"
                  className="w-full h-auto"
                />
              </div>

              {/* Info */}
              <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                <div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(selectedInvoice.amount)}</p>
                  <p className="text-sm text-slate-400">
                    Eingereicht von {selectedInvoice.submittedBy.displayName || selectedInvoice.submittedBy.username}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(selectedInvoice.createdAt)}</p>
                </div>
              </div>

              {/* Actions */}
              {canManageTuning && (
                <div className="flex gap-2 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => completeTuning.mutate(selectedInvoice.id)}
                    className="flex-1 btn-primary bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                    disabled={completeTuning.isPending}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Als bezahlt markieren
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Rechnung wirklich löschen?')) {
                        deleteTuning.mutate(selectedInvoice.id);
                      }
                    }}
                    className="btn-secondary text-red-400 flex items-center gap-2"
                    disabled={deleteTuning.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    Löschen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
