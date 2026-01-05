import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import {
  HelpCircle,
  CheckSquare,
  Plus,
  Trash2,
  Pencil,
  X,
  Save,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface AcademyQuestion {
  id: string;
  question: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface AcademyCriterion {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

type Tab = 'questions' | 'criteria';

export default function AcademySettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('questions');

  // Questions State
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AcademyQuestion | null>(null);
  const [newQuestion, setNewQuestion] = useState('');

  // Criteria State
  const [showCriterionModal, setShowCriterionModal] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<AcademyCriterion | null>(null);
  const [newCriterion, setNewCriterion] = useState('');

  // Questions Query
  const { data: questions = [], isLoading: questionsLoading } = useQuery<AcademyQuestion[]>({
    queryKey: ['academy-questions-all'],
    queryFn: () => adminApi.getAllAcademyQuestions().then(res => res.data),
  });

  // Criteria Query
  const { data: criteria = [], isLoading: criteriaLoading } = useQuery<AcademyCriterion[]>({
    queryKey: ['academy-criteria-all'],
    queryFn: () => adminApi.getAllAcademyCriteria().then(res => res.data),
  });

  // Question Mutations
  const createQuestion = useMutation({
    mutationFn: (question: string) => adminApi.createAcademyQuestion({ question }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-questions-all'] });
      setShowQuestionModal(false);
      setNewQuestion('');
      toast.success('Frage erstellt');
    },
  });

  const updateQuestion = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AcademyQuestion> }) =>
      adminApi.updateAcademyQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-questions-all'] });
      setEditingQuestion(null);
      toast.success('Frage aktualisiert');
    },
  });

  const deleteQuestion = useMutation({
    mutationFn: adminApi.deleteAcademyQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-questions-all'] });
      toast.success('Frage gelöscht');
    },
  });

  // Criteria Mutations
  const createCriterion = useMutation({
    mutationFn: (name: string) => adminApi.createAcademyCriterion({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-criteria-all'] });
      setShowCriterionModal(false);
      setNewCriterion('');
      toast.success('Kriterium erstellt');
    },
  });

  const updateCriterion = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AcademyCriterion> }) =>
      adminApi.updateAcademyCriterion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-criteria-all'] });
      setEditingCriterion(null);
      toast.success('Kriterium aktualisiert');
    },
  });

  const deleteCriterion = useMutation({
    mutationFn: adminApi.deleteAcademyCriterion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-criteria-all'] });
      toast.success('Kriterium gelöscht');
    },
  });

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) {
      toast.error('Frage ist erforderlich');
      return;
    }
    createQuestion.mutate(newQuestion.trim());
  };

  const handleCreateCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriterion.trim()) {
      toast.error('Kriterium ist erforderlich');
      return;
    }
    createCriterion.mutate(newCriterion.trim());
  };

  const toggleQuestionActive = (question: AcademyQuestion) => {
    updateQuestion.mutate({
      id: question.id,
      data: { isActive: !question.isActive },
    });
  };

  const toggleCriterionActive = (criterion: AcademyCriterion) => {
    updateCriterion.mutate({
      id: criterion.id,
      data: { isActive: !criterion.isActive },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Academy Einstellungen</h1>
        <p className="text-slate-400 mt-1">
          Verwalte Fragenkatalog und Einstellungskriterien für Bewerbungen
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('questions')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 border-b-2 transition-colors',
              activeTab === 'questions'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-slate-400 hover:text-white'
            )}
          >
            <HelpCircle className="h-4 w-4" />
            Fragenkatalog
            <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full">
              {questions.filter(q => q.isActive).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('criteria')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 border-b-2 transition-colors',
              activeTab === 'criteria'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-slate-400 hover:text-white'
            )}
          >
            <CheckSquare className="h-4 w-4" />
            Einstellungskriterien
            <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full">
              {criteria.filter(c => c.isActive).length}
            </span>
          </button>
        </nav>
      </div>

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Fragenkatalog</h2>
            <button
              onClick={() => setShowQuestionModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Neue Frage
            </button>
          </div>

          {questionsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : questions.length === 0 ? (
            <div className="card p-8 text-center">
              <HelpCircle className="h-12 w-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">Keine Fragen vorhanden</p>
              <button
                onClick={() => setShowQuestionModal(true)}
                className="btn-primary mt-4"
              >
                Erste Frage erstellen
              </button>
            </div>
          ) : (
            <div className="card">
              <div className="divide-y divide-slate-700">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className={clsx(
                      'flex items-center gap-4 p-4 transition-colors',
                      !question.isActive && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-2 text-slate-500">
                      <GripVertical className="h-4 w-4" />
                      <span className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded-full text-sm text-white">
                        {index + 1}
                      </span>
                    </div>

                    {editingQuestion?.id === question.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateQuestion.mutate({
                            id: question.id,
                            data: { question: editingQuestion.question },
                          });
                        }}
                        className="flex-1 flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={editingQuestion.question}
                          onChange={(e) =>
                            setEditingQuestion({ ...editingQuestion, question: e.target.value })
                          }
                          className="input flex-1"
                          autoFocus
                        />
                        <button type="submit" className="btn-primary p-2">
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingQuestion(null)}
                          className="btn-secondary p-2"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="flex-1 text-white">{question.question}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleQuestionActive(question)}
                            className={clsx(
                              'p-2 rounded-lg transition-colors',
                              question.isActive
                                ? 'text-green-400 hover:bg-green-500/20'
                                : 'text-slate-500 hover:bg-slate-600'
                            )}
                            title={question.isActive ? 'Deaktivieren' : 'Aktivieren'}
                          >
                            {question.isActive ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingQuestion(question)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Frage wirklich löschen?')) {
                                deleteQuestion.mutate(question.id);
                              }
                            }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Criteria Tab */}
      {activeTab === 'criteria' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Einstellungskriterien</h2>
            <button
              onClick={() => setShowCriterionModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Neues Kriterium
            </button>
          </div>

          {criteriaLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : criteria.length === 0 ? (
            <div className="card p-8 text-center">
              <CheckSquare className="h-12 w-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">Keine Kriterien vorhanden</p>
              <button
                onClick={() => setShowCriterionModal(true)}
                className="btn-primary mt-4"
              >
                Erstes Kriterium erstellen
              </button>
            </div>
          ) : (
            <div className="card">
              <div className="divide-y divide-slate-700">
                {criteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className={clsx(
                      'flex items-center gap-4 p-4 transition-colors',
                      !criterion.isActive && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-2 text-slate-500">
                      <GripVertical className="h-4 w-4" />
                      <CheckSquare className="h-4 w-4 text-green-400" />
                    </div>

                    {editingCriterion?.id === criterion.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateCriterion.mutate({
                            id: criterion.id,
                            data: { name: editingCriterion.name },
                          });
                        }}
                        className="flex-1 flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={editingCriterion.name}
                          onChange={(e) =>
                            setEditingCriterion({ ...editingCriterion, name: e.target.value })
                          }
                          className="input flex-1"
                          autoFocus
                        />
                        <button type="submit" className="btn-primary p-2">
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCriterion(null)}
                          className="btn-secondary p-2"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="flex-1 text-white">{criterion.name}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleCriterionActive(criterion)}
                            className={clsx(
                              'p-2 rounded-lg transition-colors',
                              criterion.isActive
                                ? 'text-green-400 hover:bg-green-500/20'
                                : 'text-slate-500 hover:bg-slate-600'
                            )}
                            title={criterion.isActive ? 'Deaktivieren' : 'Aktivieren'}
                          >
                            {criterion.isActive ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingCriterion(criterion)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Kriterium wirklich löschen?')) {
                                deleteCriterion.mutate(criterion.id);
                              }
                            }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg mx-4">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Neue Frage erstellen</h3>
              <button
                onClick={() => {
                  setShowQuestionModal(false);
                  setNewQuestion('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateQuestion} className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Frage *
                </label>
                <textarea
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="input w-full"
                  rows={3}
                  placeholder="z.B. Was macht man vor Dienstbeginn?"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuestionModal(false);
                    setNewQuestion('');
                  }}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createQuestion.isPending}
                  className="btn-primary"
                >
                  {createQuestion.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Criterion Modal */}
      {showCriterionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg mx-4">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Neues Kriterium erstellen</h3>
              <button
                onClick={() => {
                  setShowCriterionModal(false);
                  setNewCriterion('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCriterion} className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Kriterium *
                </label>
                <input
                  type="text"
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  className="input w-full"
                  placeholder="z.B. Stabilisationsschein geprüft"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCriterionModal(false);
                    setNewCriterion('');
                  }}
                  className="btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createCriterion.isPending}
                  className="btn-primary"
                >
                  {createCriterion.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
