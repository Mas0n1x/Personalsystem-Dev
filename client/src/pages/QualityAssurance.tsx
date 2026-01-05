import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unitReviewsApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  ClipboardCheck,
  Plus,
  X,
  Star,
  Calendar,
  User,
  FileText,
  Trash2,
  ChevronRight,
  Send,
  CheckCircle,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface UnitReview {
  id: string;
  unit: string;
  reviewDate: string;
  rating: number;
  findings: string | null;
  recommendations: string | null;
  status: string;
  createdAt: string;
  reviewer: { id: string; displayName: string | null; username: string };
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Entwurf',
  SUBMITTED: 'Eingereicht',
  REVIEWED: 'Abgeschlossen',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-500/20 text-slate-400',
  SUBMITTED: 'bg-yellow-500/20 text-yellow-400',
  REVIEWED: 'bg-green-500/20 text-green-400',
};

export default function QualityAssurance() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const canManage = permissions.hasAnyPermission('qa.manage', 'admin.full');

  const [filter, setFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<UnitReview | null>(null);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['unit-reviews', 'stats'],
    queryFn: () => unitReviewsApi.getStats().then(res => res.data),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['unit-reviews', 'units'],
    queryFn: () => unitReviewsApi.getUnits().then(res => res.data),
  });

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['unit-reviews', filter],
    queryFn: () => unitReviewsApi.getAll(filter !== 'all' ? { status: filter } : {}).then(res => res.data),
  });

  // Mutations
  const createReview = useMutation({
    mutationFn: unitReviewsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-reviews'] });
      setShowCreateModal(false);
      toast.success('Überprüfung erstellt');
    },
  });

  const updateReview = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      unitReviewsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-reviews'] });
      toast.success('Überprüfung aktualisiert');
    },
  });

  const deleteReview = useMutation({
    mutationFn: unitReviewsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-reviews'] });
      setSelectedReview(null);
      toast.success('Überprüfung gelöscht');
    },
  });

  const handleCreateReview = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createReview.mutate({
      unit: formData.get('unit') as string,
      reviewDate: formData.get('reviewDate') as string,
      rating: parseInt(formData.get('rating') as string),
      findings: formData.get('findings') as string || undefined,
      recommendations: formData.get('recommendations') as string || undefined,
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number, interactive = false, onChange?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            onClick={interactive && onChange ? () => onChange(star) : undefined}
            disabled={!interactive}
            className={clsx(
              'transition-colors',
              interactive && 'hover:text-yellow-400 cursor-pointer',
              star <= rating ? 'text-yellow-400' : 'text-slate-600'
            )}
          >
            <Star className="h-5 w-5 fill-current" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600/20 via-slate-800 to-teal-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-2xl backdrop-blur-sm border border-purple-500/30 shadow-lg shadow-purple-500/20">
              <ClipboardCheck className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Quality Assurance</h1>
              <p className="text-slate-400 mt-0.5">Überprüfung der Unitabläufe</p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Neue Überprüfung
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="card p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:border-slate-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-slate-400">Gesamt</p>
              </div>
            </div>
          </div>
          <div className="card p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:border-slate-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.draft}</p>
                <p className="text-sm text-slate-400">Entwürfe</p>
              </div>
            </div>
          </div>
          <div className="card p-4 bg-gradient-to-br from-yellow-900/30 to-slate-900/80 hover:border-yellow-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <Send className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{stats.submitted}</p>
                <p className="text-sm text-slate-400">Eingereicht</p>
              </div>
            </div>
          </div>
          <div className="card p-4 bg-gradient-to-br from-green-900/30 to-slate-900/80 hover:border-green-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{stats.reviewed}</p>
                <p className="text-sm text-slate-400">Abgeschlossen</p>
              </div>
            </div>
          </div>
          <div className="card p-4 bg-gradient-to-br from-amber-900/30 to-slate-900/80 hover:border-amber-600/50 transition-all group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg group-hover:scale-110 transition-transform">
                <Star className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{stats.averageRating?.toFixed(1) || '-'}</p>
                <p className="text-sm text-slate-400">Durchschnitt</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'DRAFT', 'SUBMITTED', 'REVIEWED'].map((status) => (
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
            {status === 'all' ? 'Alle' : statusLabels[status]}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div className="card">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Keine Überprüfungen gefunden
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {reviews.map((review: UnitReview) => (
              <div
                key={review.id}
                onClick={() => setSelectedReview(review)}
                className="p-4 hover:bg-slate-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-white">{review.unit}</h3>
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs', statusColors[review.status])}>
                        {statusLabels[review.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(review.reviewDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {review.reviewer.displayName || review.reviewer.username}
                      </span>
                      {renderStars(review.rating)}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Neue Überprüfung</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateReview} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Unit *</label>
                <select name="unit" required className="input w-full">
                  <option value="">Unit auswählen...</option>
                  {units.map((unit: string) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Datum der Überprüfung *</label>
                <input type="date" name="reviewDate" required className="input w-full" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Bewertung *</label>
                <select name="rating" required className="input w-full" defaultValue="3">
                  <option value="1">1 Stern - Ungenügend</option>
                  <option value="2">2 Sterne - Mangelhaft</option>
                  <option value="3">3 Sterne - Befriedigend</option>
                  <option value="4">4 Sterne - Gut</option>
                  <option value="5">5 Sterne - Ausgezeichnet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Feststellungen</label>
                <textarea name="findings" rows={4} className="input w-full" placeholder="Was wurde festgestellt..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Empfehlungen</label>
                <textarea name="recommendations" rows={3} className="input w-full" placeholder="Verbesserungsvorschläge..." />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={createReview.isPending}>
                  {createReview.isPending ? 'Erstelle...' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedReview.unit}</h2>
                <p className="text-sm text-slate-400">Überprüfung vom {formatDate(selectedReview.reviewDate)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('px-3 py-1 rounded-full text-sm', statusColors[selectedReview.status])}>
                  {statusLabels[selectedReview.status]}
                </span>
                <button onClick={() => setSelectedReview(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-6">
              {/* Rating */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Bewertung</h3>
                {renderStars(selectedReview.rating)}
              </div>

              {/* Reviewer */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">Prüfer</h3>
                <p className="text-white">{selectedReview.reviewer.displayName || selectedReview.reviewer.username}</p>
              </div>

              {/* Findings */}
              {selectedReview.findings && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1">Feststellungen</h3>
                  <p className="text-slate-400 whitespace-pre-wrap">{selectedReview.findings}</p>
                </div>
              )}

              {/* Recommendations */}
              {selectedReview.recommendations && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1">Empfehlungen</h3>
                  <p className="text-slate-400 whitespace-pre-wrap">{selectedReview.recommendations}</p>
                </div>
              )}

              {/* Status Actions */}
              {canManage && selectedReview.status !== 'REVIEWED' && (
                <div className="flex gap-2">
                  {selectedReview.status === 'DRAFT' && (
                    <button
                      onClick={() => {
                        updateReview.mutate({ id: selectedReview.id, data: { status: 'SUBMITTED' } });
                        setSelectedReview({ ...selectedReview, status: 'SUBMITTED' });
                      }}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Einreichen
                    </button>
                  )}
                  {selectedReview.status === 'SUBMITTED' && (
                    <button
                      onClick={() => {
                        updateReview.mutate({ id: selectedReview.id, data: { status: 'REVIEWED' } });
                        setSelectedReview({ ...selectedReview, status: 'REVIEWED' });
                      }}
                      className="btn-primary flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Abschließen
                    </button>
                  )}
                </div>
              )}

              {/* Delete */}
              {canManage && (
                <div className="pt-4 border-t border-slate-700">
                  <button
                    onClick={() => {
                      if (confirm('Überprüfung wirklich löschen?')) {
                        deleteReview.mutate(selectedReview.id);
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Überprüfung löschen
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
