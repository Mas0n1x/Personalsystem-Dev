import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academyApi, employeesApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  GraduationCap,
  Check,
  ChevronDown,
  ChevronRight,
  StickyNote,
  ArrowUpCircle,
  X,
  Plus,
  Trash2,
  ClipboardCheck,
  BookOpen,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Types
interface AcademyModule {
  id: string;
  name: string;
  description: string | null;
  category: 'JUNIOR_OFFICER' | 'OFFICER';
  sortOrder: number;
  isActive: boolean;
}

interface ModuleProgress {
  module: AcademyModule;
  progress: {
    id: string;
    completed: boolean;
    completedAt: string | null;
    completedBy: { displayName: string | null; username: string } | null;
  } | null;
}

interface Trainee {
  id: string;
  rank: string;
  rankLevel: number;
  badgeNumber: string | null;
  user: {
    id: string;
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
  juniorOfficerModules: ModuleProgress[];
  officerModules: ModuleProgress[];
  juniorOfficerCompleted: number;
  juniorOfficerTotal: number;
  officerCompleted: number;
  officerTotal: number;
  canRequestJuniorOfficerUprank: boolean;
  canRequestOfficerUprank: boolean;
}

interface AcademyNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: {
    id: string;
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

interface AcademyExam {
  id: string;
  employeeId: string;
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
  examType: string;
  theoryScore: number;
  theoryMax: number;
  funcCodesScore: number;
  funcCodesMax: number;
  lawScore: number;
  lawMax: number;
  reportScore: number;
  reportMax: number;
  situationsPassed: boolean;
  totalScore: number;
  maxScore: number;
  grade: number | null;
  passed: boolean;
  examinerNotes: string | null;
  examiner: {
    id: string;
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
  createdAt: string;
}

interface AcademyRetraining {
  id: string;
  employeeId: string;
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
  type: string;
  reason: string;
  status: string;
  notes: string | null;
  completedAt: string | null;
  completedBy: {
    id: string;
    displayName: string | null;
    username: string;
  } | null;
  createdBy: {
    id: string;
    displayName: string | null;
    username: string;
  };
  createdAt: string;
}

interface Employee {
  id: string;
  rank: string;
  badgeNumber: string | null;
  user: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

type TabType = 'training' | 'exams' | 'retraining';

const RETRAINING_TYPES = [
  'Funk & Codes',
  'Gesetze & Vorschriften',
  'Dienstvorschriften',
  'Verfolgungsfahrten',
  'Schusswaffen',
  'Einsatztraining',
  'Kommunikation',
  'Sonstiges',
];

export default function Academy() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const canManage = permissions.hasAnyPermission('academy.manage', 'admin.full');

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('training');

  // Training states
  const [expandedTrainees, setExpandedTrainees] = useState<Set<string>>(new Set());
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');

  // Exam states
  const [showExamModal, setShowExamModal] = useState(false);
  const [examForm, setExamForm] = useState({
    employeeId: '',
    theoryScore: 0,
    funcCodesScore: 0,
    lawScore: 0,
    reportScore: 0,
    situationsPassed: false,
    examinerNotes: '',
  });

  // Retraining states
  const [showRetrainingModal, setShowRetrainingModal] = useState(false);
  const [retrainingForm, setRetrainingForm] = useState({
    employeeId: '',
    type: '',
    reason: '',
    notes: '',
  });

  // Confirm dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Bestätigen',
    variant: 'danger',
    onConfirm: () => {},
  });

  // Queries
  const { data: trainees = [], isLoading: traineesLoading } = useQuery({
    queryKey: ['academy-trainees'],
    queryFn: () => academyApi.getTrainees().then(res => res.data),
    enabled: activeTab === 'training',
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['academy-notes', showNotesFor],
    queryFn: () => academyApi.getNotes(showNotesFor!).then(res => res.data),
    enabled: !!showNotesFor,
  });

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ['academy-exams'],
    queryFn: () => academyApi.getExams().then(res => res.data),
    enabled: activeTab === 'exams',
  });

  const { data: retrainings = [], isLoading: retrainingsLoading } = useQuery({
    queryKey: ['academy-retrainings'],
    queryFn: () => academyApi.getRetrainings().then(res => res.data),
    enabled: activeTab === 'retraining',
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees-for-academy'],
    queryFn: () => employeesApi.getAll({ limit: '500' }).then(res => res.data?.data || []),
    enabled: showExamModal || showRetrainingModal,
  });

  // Mutations
  const toggleProgress = useMutation({
    mutationFn: academyApi.toggleProgress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-trainees'] });
    },
  });

  const createNote = useMutation({
    mutationFn: academyApi.createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-notes'] });
      setNewNoteContent('');
      toast.success('Notiz erstellt');
    },
  });

  const deleteNote = useMutation({
    mutationFn: academyApi.deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-notes'] });
      toast.success('Notiz gelöscht');
    },
  });

  const requestUprank = useMutation({
    mutationFn: academyApi.requestUprank,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-trainees'] });
      toast.success('Uprank-Antrag erstellt');
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Fehler beim Erstellen des Antrags');
    },
  });

  const createExam = useMutation({
    mutationFn: academyApi.createExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-exams'] });
      setShowExamModal(false);
      setExamForm({
        employeeId: '',
        theoryScore: 0,
        funcCodesScore: 0,
        lawScore: 0,
        reportScore: 0,
        situationsPassed: false,
        examinerNotes: '',
      });
      toast.success('Wiedereinstellungstest erstellt');
    },
  });

  const deleteExam = useMutation({
    mutationFn: academyApi.deleteExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-exams'] });
      toast.success('Wiedereinstellungstest gelöscht');
    },
  });

  const createRetraining = useMutation({
    mutationFn: academyApi.createRetraining,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-retrainings'] });
      setShowRetrainingModal(false);
      setRetrainingForm({ employeeId: '', type: '', reason: '', notes: '' });
      toast.success('Nachschulung erstellt');
    },
  });

  const updateRetraining = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; notes?: string } }) =>
      academyApi.updateRetraining(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-retrainings'] });
      toast.success('Nachschulung aktualisiert');
    },
  });

  const deleteRetraining = useMutation({
    mutationFn: academyApi.deleteRetraining,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-retrainings'] });
      toast.success('Nachschulung gelöscht');
    },
  });

  // Helpers
  const toggleExpanded = (traineeId: string) => {
    const newExpanded = new Set(expandedTrainees);
    if (newExpanded.has(traineeId)) {
      newExpanded.delete(traineeId);
    } else {
      newExpanded.add(traineeId);
    }
    setExpandedTrainees(newExpanded);
  };

  const handleToggleModule = (employeeId: string, moduleId: string) => {
    if (!canManage) return;
    toggleProgress.mutate({ employeeId, moduleId });
  };

  const handleRequestUprank = (employeeId: string, targetRank: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Uprank-Antrag erstellen',
      message: `Möchtest du einen Uprank-Antrag für ${targetRank} erstellen?`,
      confirmText: 'Antrag erstellen',
      variant: 'info',
      onConfirm: () => requestUprank.mutate({ employeeId, targetRank }),
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getGradeColor = (grade: number | null) => {
    if (!grade) return 'text-slate-400';
    if (grade === 1) return 'text-green-400';
    if (grade === 2) return 'text-green-300';
    if (grade === 3) return 'text-yellow-400';
    if (grade === 4) return 'text-orange-400';
    if (grade === 5) return 'text-red-400';
    return 'text-red-500';
  };

  // Separate trainees by current rank
  const juniorOfficerTrainees = trainees.filter((t: Trainee) => t.rankLevel === 1);
  const officerTrainees = trainees.filter((t: Trainee) => t.rankLevel === 2);

  const renderModuleList = (modules: ModuleProgress[], employeeId: string) => (
    <div className="space-y-1">
      {modules.map(({ module, progress }) => (
        <div
          key={module.id}
          onClick={() => handleToggleModule(employeeId, module.id)}
          className={clsx(
            'flex items-center gap-3 p-2 rounded-lg transition-colors',
            canManage ? 'cursor-pointer hover:bg-slate-700/50' : '',
            progress?.completed ? 'text-green-400' : 'text-slate-300'
          )}
        >
          <div
            className={clsx(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
              progress?.completed
                ? 'bg-green-500 border-green-500'
                : 'border-slate-500'
            )}
          >
            {progress?.completed && <Check className="h-3 w-3 text-white" />}
          </div>
          <span className={clsx(progress?.completed && 'line-through')}>
            {module.name}
          </span>
          {progress?.completed && progress.completedBy && (
            <span className="ml-auto text-xs text-slate-500">
              [{progress.completedBy.displayName || progress.completedBy.username}]
            </span>
          )}
        </div>
      ))}
      {modules.length === 0 && (
        <p className="text-slate-500 text-sm p-2">Keine Module definiert</p>
      )}
    </div>
  );

  const renderTraineeCard = (trainee: Trainee) => {
    const isExpanded = expandedTrainees.has(trainee.id);
    const displayName = trainee.user.displayName || trainee.user.username;
    const badgeDisplay = trainee.badgeNumber ? `[${trainee.badgeNumber}]` : '';

    return (
      <div key={trainee.id} className="card overflow-hidden">
        <div
          onClick={() => toggleExpanded(trainee.id)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            {trainee.user.avatar ? (
              <img
                src={trainee.user.avatar}
                alt={displayName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-300">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h3 className="font-medium text-white">
                {badgeDisplay} {displayName}
              </h3>
              <p className="text-sm text-slate-400">{trainee.rank}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNotesFor(trainee.id);
              }}
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              title="Interne Notizen"
            >
              <StickyNote className="h-5 w-5" />
            </button>
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-700">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-amber-400">Junior Officer</h4>
                  <span className="text-sm text-slate-400">
                    {trainee.juniorOfficerCompleted}/{trainee.juniorOfficerTotal}
                  </span>
                </div>
                {renderModuleList(trainee.juniorOfficerModules, trainee.id)}
                {canManage && trainee.canRequestJuniorOfficerUprank && trainee.rankLevel === 1 && (
                  <button
                    onClick={() => handleRequestUprank(trainee.id, 'Junior Officer')}
                    className="mt-4 w-full btn-primary flex items-center justify-center gap-2"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Uprank beantragen
                  </button>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-orange-400">Officer</h4>
                  <span className="text-sm text-slate-400">
                    {trainee.officerCompleted}/{trainee.officerTotal}
                  </span>
                </div>
                {renderModuleList(trainee.officerModules, trainee.id)}
                {canManage && trainee.canRequestOfficerUprank && trainee.rankLevel === 2 && (
                  <button
                    onClick={() => handleRequestUprank(trainee.id, 'Officer')}
                    className="mt-4 w-full btn-primary flex items-center justify-center gap-2"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Uprank beantragen
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Tab Content Renderers
  const renderTrainingTab = () => (
    <div className="space-y-6">
      {traineesLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {!traineesLoading && trainees.length === 0 && (
        <div className="card p-8 text-center">
          <GraduationCap className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Keine Azubis vorhanden</h3>
          <p className="text-slate-400">
            Es gibt derzeit keine Mitarbeiter mit Rang 1-2.
          </p>
        </div>
      )}

      {!traineesLoading && trainees.length > 0 && (
        <div className="space-y-6">
          {juniorOfficerTrainees.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-amber-400">Cadets / Junior Officers</span>
                <span className="text-sm font-normal text-slate-400">
                  ({juniorOfficerTrainees.length})
                </span>
              </h2>
              <div className="space-y-3">
                {juniorOfficerTrainees.map((trainee: Trainee) => renderTraineeCard(trainee))}
              </div>
            </div>
          )}

          {officerTrainees.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-orange-400">Officers</span>
                <span className="text-sm font-normal text-slate-400">
                  ({officerTrainees.length})
                </span>
              </h2>
              <div className="space-y-3">
                {officerTrainees.map((trainee: Trainee) => renderTraineeCard(trainee))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderExamsTab = () => (
    <div className="space-y-6">
      {/* Header with Add Button */}
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowExamModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neuer Test
          </button>
        </div>
      )}

      {examsLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {!examsLoading && exams.length === 0 && (
        <div className="card p-8 text-center">
          <ClipboardCheck className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Keine Tests vorhanden</h3>
          <p className="text-slate-400">
            Es wurden noch keine Wiedereinstellungstests erstellt.
          </p>
        </div>
      )}

      {!examsLoading && exams.length > 0 && (
        <div className="grid gap-4">
          {exams.map((exam: AcademyExam) => {
            const displayName = exam.employee.user.displayName || exam.employee.user.username;
            const badge = exam.employee.badgeNumber ? `[${exam.employee.badgeNumber}]` : '';
            const percentage = Math.round((exam.totalScore / exam.maxScore) * 100);

            return (
              <div key={exam.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {exam.employee.user.avatar ? (
                      <img
                        src={exam.employee.user.avatar}
                        alt={displayName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                        <span className="text-lg font-bold text-slate-300">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-white">
                        {badge} {displayName}
                      </h3>
                      <p className="text-sm text-slate-400">{exam.employee.rank}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exam.passed ? (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Bestanden
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        Nicht bestanden
                      </span>
                    )}
                    {canManage && (
                      <button
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Wiedereinstellungstest löschen',
                            message: 'Möchtest du diesen Wiedereinstellungstest wirklich löschen?',
                            confirmText: 'Löschen',
                            variant: 'danger',
                            onConfirm: () => deleteExam.mutate(exam.id),
                          });
                        }}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Scores */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Theorie</p>
                    <p className="text-lg font-bold text-white">{exam.theoryScore}/{exam.theoryMax}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Funk & Codes</p>
                    <p className="text-lg font-bold text-white">{exam.funcCodesScore}/{exam.funcCodesMax}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Gesetze</p>
                    <p className="text-lg font-bold text-white">{exam.lawScore}/{exam.lawMax}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Report</p>
                    <p className="text-lg font-bold text-white">{exam.reportScore}/{exam.reportMax}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">Situationen</p>
                    <p className={clsx('text-lg font-bold', exam.situationsPassed ? 'text-green-400' : 'text-red-400')}>
                      {exam.situationsPassed ? 'Bestanden' : 'Nicht best.'}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-sm text-slate-400">Gesamt: </span>
                      <span className="font-bold text-white">{exam.totalScore}/{exam.maxScore} ({percentage}%)</span>
                    </div>
                    <div>
                      <span className="text-sm text-slate-400">Note: </span>
                      <span className={clsx('font-bold text-lg', getGradeColor(exam.grade))}>
                        {exam.grade || '-'}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    Prüfer: {exam.examiner.displayName || exam.examiner.username} | {formatDate(exam.createdAt)}
                  </div>
                </div>

                {exam.examinerNotes && (
                  <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Anmerkungen:</p>
                    <p className="text-slate-300">{exam.examinerNotes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderRetrainingTab = () => (
    <div className="space-y-6">
      {/* Header with Add Button */}
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowRetrainingModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neue Nachschulung
          </button>
        </div>
      )}

      {retrainingsLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {!retrainingsLoading && retrainings.length === 0 && (
        <div className="card p-8 text-center">
          <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Keine Nachschulungen</h3>
          <p className="text-slate-400">
            Es wurden noch keine Nachschulungen erstellt.
          </p>
        </div>
      )}

      {!retrainingsLoading && retrainings.length > 0 && (
        <div className="grid gap-4">
          {retrainings.map((retraining: AcademyRetraining) => {
            const displayName = retraining.employee.user.displayName || retraining.employee.user.username;
            const badge = retraining.employee.badgeNumber ? `[${retraining.employee.badgeNumber}]` : '';

            return (
              <div key={retraining.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {retraining.employee.user.avatar ? (
                      <img
                        src={retraining.employee.user.avatar}
                        alt={displayName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                        <span className="text-lg font-bold text-slate-300">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-white">
                        {badge} {displayName}
                      </h3>
                      <p className="text-sm text-slate-400">{retraining.employee.rank}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {retraining.status === 'PENDING' && (
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Ausstehend
                      </span>
                    )}
                    {retraining.status === 'COMPLETED' && (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Abgeschlossen
                      </span>
                    )}
                    {retraining.status === 'CANCELLED' && (
                      <span className="px-3 py-1 bg-slate-500/20 text-slate-400 rounded-full text-sm font-medium flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        Abgebrochen
                      </span>
                    )}
                    {canManage && retraining.status === 'PENDING' && (
                      <button
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Nachschulung abschließen',
                            message: 'Möchtest du diese Nachschulung als abgeschlossen markieren?',
                            confirmText: 'Abschließen',
                            variant: 'success',
                            onConfirm: () => updateRetraining.mutate({ id: retraining.id, data: { status: 'COMPLETED' } }),
                          });
                        }}
                        className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg"
                        title="Als abgeschlossen markieren"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Nachschulung löschen',
                            message: 'Möchtest du diese Nachschulung wirklich löschen?',
                            confirmText: 'Löschen',
                            variant: 'danger',
                            onConfirm: () => deleteRetraining.mutate(retraining.id),
                          });
                        }}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Art der Nachschulung</p>
                    <p className="text-white font-medium">{retraining.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Grund</p>
                    <p className="text-white">{retraining.reason}</p>
                  </div>
                </div>

                {retraining.notes && (
                  <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Notizen:</p>
                    <p className="text-slate-300">{retraining.notes}</p>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-sm text-slate-500 border-t border-slate-700 pt-4">
                  <span>Erstellt von: {retraining.createdBy.displayName || retraining.createdBy.username}</span>
                  <span>{formatDate(retraining.createdAt)}</span>
                </div>

                {retraining.completedBy && (
                  <div className="mt-2 text-sm text-green-400">
                    Abgeschlossen von: {retraining.completedBy.displayName || retraining.completedBy.username}
                    {retraining.completedAt && ` am ${formatDate(retraining.completedAt)}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-slate-800 to-cyan-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl backdrop-blur-sm border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <GraduationCap className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Police Academy</h1>
              <p className="text-slate-400 mt-0.5">Ausbildung, Prüfungen und Nachschulungen verwalten</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2 bg-slate-800/50 rounded-t-xl px-2">
        <button
          onClick={() => setActiveTab('training')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
            activeTab === 'training'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          )}
        >
          <Users className="h-4 w-4" />
          Ausbildung
        </button>
        <button
          onClick={() => setActiveTab('exams')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
            activeTab === 'exams'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          )}
        >
          <ClipboardCheck className="h-4 w-4" />
          Wiedereinstellungstest
        </button>
        <button
          onClick={() => setActiveTab('retraining')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
            activeTab === 'retraining'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          )}
        >
          <BookOpen className="h-4 w-4" />
          Nachschulungen
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'training' && renderTrainingTab()}
      {activeTab === 'exams' && renderExamsTab()}
      {activeTab === 'retraining' && renderRetrainingTab()}

      {/* Notes Modal */}
      {showNotesFor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-amber-400" />
                Interne Notizen
              </h2>
              <button
                onClick={() => setShowNotesFor(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              ) : notes.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Keine Notizen vorhanden</p>
              ) : (
                notes.map((note: AcademyNote) => (
                  <div key={note.id} className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-slate-300 whitespace-pre-wrap">{note.content}</p>
                      {canManage && (
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Notiz löschen',
                              message: 'Möchtest du diese Notiz wirklich löschen?',
                              confirmText: 'Löschen',
                              variant: 'danger',
                              onConfirm: () => deleteNote.mutate(note.id),
                            });
                          }}
                          className="p-1 text-red-400 hover:bg-red-500/20 rounded flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                      <span>{note.createdBy.displayName || note.createdBy.username}</span>
                      <span>|</span>
                      <span>{formatDate(note.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {canManage && (
              <div className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Neue Notiz hinzufügen..."
                    className="input flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newNoteContent.trim()) {
                        createNote.mutate({ employeeId: showNotesFor, content: newNoteContent.trim() });
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newNoteContent.trim()) {
                        createNote.mutate({ employeeId: showNotesFor, content: newNoteContent.trim() });
                      }
                    }}
                    disabled={!newNoteContent.trim() || createNote.isPending}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exam Modal */}
      {showExamModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-400" />
                Neuer Wiedereinstellungstest
              </h2>
              <button
                onClick={() => setShowExamModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Mitarbeiter *
                </label>
                <select
                  value={examForm.employeeId}
                  onChange={(e) => setExamForm({ ...examForm, employeeId: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Mitarbeiter auswählen...</option>
                  {allEmployees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.badgeNumber ? `[${emp.badgeNumber}] ` : ''}
                      {emp.user.displayName || emp.user.username} - {emp.rank}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scores Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Theorie (max. 13)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="13"
                    value={examForm.theoryScore}
                    onChange={(e) => setExamForm({ ...examForm, theoryScore: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Funk & Codes (max. 10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={examForm.funcCodesScore}
                    onChange={(e) => setExamForm({ ...examForm, funcCodesScore: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Gesetze (max. 10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={examForm.lawScore}
                    onChange={(e) => setExamForm({ ...examForm, lawScore: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Report (max. 25)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={examForm.reportScore}
                    onChange={(e) => setExamForm({ ...examForm, reportScore: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Situations Passed */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="situationsPassed"
                  checked={examForm.situationsPassed}
                  onChange={(e) => setExamForm({ ...examForm, situationsPassed: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="situationsPassed" className="text-slate-300">
                  Situationen bestanden
                </label>
              </div>

              {/* Preview */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-2">Vorschau:</p>
                {(() => {
                  const total = examForm.theoryScore + examForm.funcCodesScore + examForm.lawScore + examForm.reportScore;
                  const max = 13 + 10 + 10 + 25;
                  const percentage = Math.round((total / max) * 100);
                  let grade: number;
                  if (percentage >= 90) grade = 1;
                  else if (percentage >= 80) grade = 2;
                  else if (percentage >= 70) grade = 3;
                  else if (percentage >= 60) grade = 4;
                  else if (percentage >= 50) grade = 5;
                  else grade = 6;
                  const passed = grade <= 4 && examForm.situationsPassed;

                  return (
                    <div className="flex items-center gap-4">
                      <span className="text-white">Gesamt: {total}/{max} ({percentage}%)</span>
                      <span className={clsx('font-bold', getGradeColor(grade))}>Note: {grade}</span>
                      <span className={passed ? 'text-green-400' : 'text-red-400'}>
                        {passed ? 'Bestanden' : 'Nicht bestanden'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Anmerkungen
                </label>
                <textarea
                  value={examForm.examinerNotes}
                  onChange={(e) => setExamForm({ ...examForm, examinerNotes: e.target.value })}
                  className="input w-full h-24"
                  placeholder="Optionale Anmerkungen zum Test..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowExamModal(false)}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => createExam.mutate(examForm)}
                  disabled={!examForm.employeeId || createExam.isPending}
                  className="btn-primary"
                >
                  {createExam.isPending ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retraining Modal */}
      {showRetrainingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-lg w-full border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-amber-400" />
                Neue Nachschulung
              </h2>
              <button
                onClick={() => setShowRetrainingModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Mitarbeiter *
                </label>
                <select
                  value={retrainingForm.employeeId}
                  onChange={(e) => setRetrainingForm({ ...retrainingForm, employeeId: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Mitarbeiter auswählen...</option>
                  {allEmployees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.badgeNumber ? `[${emp.badgeNumber}] ` : ''}
                      {emp.user.displayName || emp.user.username} - {emp.rank}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Art der Nachschulung *
                </label>
                <select
                  value={retrainingForm.type}
                  onChange={(e) => setRetrainingForm({ ...retrainingForm, type: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Typ auswählen...</option>
                  {RETRAINING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Grund *
                </label>
                <textarea
                  value={retrainingForm.reason}
                  onChange={(e) => setRetrainingForm({ ...retrainingForm, reason: e.target.value })}
                  className="input w-full h-24"
                  placeholder="Warum ist die Nachschulung erforderlich?"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Zusätzliche Notizen
                </label>
                <textarea
                  value={retrainingForm.notes}
                  onChange={(e) => setRetrainingForm({ ...retrainingForm, notes: e.target.value })}
                  className="input w-full h-20"
                  placeholder="Optionale Notizen..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowRetrainingModal(false)}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => createRetraining.mutate(retrainingForm)}
                  disabled={!retrainingForm.employeeId || !retrainingForm.type || !retrainingForm.reason || createRetraining.isPending}
                  className="btn-primary"
                >
                  {createRetraining.isPending ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
