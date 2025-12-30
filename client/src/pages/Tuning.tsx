import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tuningApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  X,
  Car,
  DollarSign,
  ImageIcon,
  Check,
  Trash2,
  RefreshCw,
  Upload,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TuningInvoice {
  id: string;
  amount: number;
  imagePath: string;
  status: string;
  submittedBy: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
  createdAt: string;
  submittedById: string;
}

interface Stats {
  offen: number;
  summe: number;
}

export default function Tuning() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['tuning-invoices'],
    queryFn: () => tuningApi.getAll(),
  });

  const { data: statsData } = useQuery({
    queryKey: ['tuning-stats'],
    queryFn: () => tuningApi.getStats(),
  });

  const invoices = (invoicesData?.data || []) as TuningInvoice[];
  const stats = statsData?.data as Stats | undefined;

  const createMutation = useMutation({
    mutationFn: tuningApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuning-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['tuning-stats'] });
      closeModal();
      toast.success('Rechnung eingereicht');
    },
    onError: () => {
      toast.error('Fehler beim Einreichen');
    },
  });

  const completeMutation = useMutation({
    mutationFn: tuningApi.complete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuning-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['tuning-stats'] });
      toast.success('Rechnung erledigt');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tuningApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuning-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['tuning-stats'] });
      toast.success('Rechnung gelöscht');
    },
  });

  const openModal = () => {
    setAmount('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setAmount('');
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !selectedFile) {
      toast.error('Bitte Betrag und Beweisfoto angeben');
      return;
    }

    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Bitte einen gültigen Betrag eingeben');
      return;
    }

    const formData = new FormData();
    formData.append('amount', parsedAmount.toString());
    formData.append('image', selectedFile);

    createMutation.mutate(formData);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  // Check if user can manage (has permission)
  const canManage = user?.role?.permissions?.some(
    (p: { name: string }) => p.name === 'tuning.manage' || p.name === 'admin.full'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tuning</h1>
          <p className="text-slate-400 mt-1">Tuning-Rechnungen einreichen</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Rechnung einreichen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 bg-gradient-to-br from-amber-900/20 to-slate-800/50 border-amber-700/30">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-amber-600/20 rounded-2xl">
              <Car className="h-8 w-8 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-3xl font-bold text-amber-400">{stats?.offen || 0}</p>
              <p className="text-sm text-slate-400 mt-0.5">Offene Rechnungen</p>
            </div>
          </div>
        </div>
        <div className="card p-5 bg-gradient-to-br from-green-900/20 to-slate-800/50 border-green-700/30">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-green-600/20 rounded-2xl">
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-3xl font-bold text-green-400">{formatCurrency(stats?.summe || 0)}</p>
              <p className="text-sm text-slate-400 mt-0.5">Gesamtsumme offen</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="card">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Offene Rechnungen</h2>
        </div>
        <div className="divide-y divide-slate-700">
          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
              <p className="text-slate-400 mt-3">Lädt...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <Car className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">Keine offenen Rechnungen</p>
              <p className="text-slate-500 text-sm mt-1">
                Klicke auf &quot;Rechnung einreichen&quot; um eine neue Rechnung zu erstellen
              </p>
            </div>
          ) : (
            invoices.map((invoice) => {
              const isOwner = invoice.submittedById === user?.id;
              return (
                <div key={invoice.id} className="p-4 hover:bg-slate-750 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Amount */}
                    <div className="p-3 bg-amber-600/20 rounded-xl">
                      <DollarSign className="h-6 w-6 text-amber-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xl font-bold text-white">
                          {formatCurrency(invoice.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <img
                          src={
                            invoice.submittedBy.avatar ||
                            `https://ui-avatars.com/api/?name=${invoice.submittedBy.displayName || invoice.submittedBy.username}&size=24&background=334155&color=fff`
                          }
                          className="h-5 w-5 rounded-full"
                          alt=""
                        />
                        <span>{invoice.submittedBy.displayName || invoice.submittedBy.username}</span>
                        <span>•</span>
                        <span>{formatDate(invoice.createdAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* View Image Button */}
                      <button
                        onClick={() => setShowImageModal(invoice.imagePath)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                        title="Beweisfoto anzeigen"
                      >
                        <Eye className="h-5 w-5" />
                      </button>

                      {/* Complete Button (only for managers) */}
                      {canManage && (
                        <button
                          onClick={() => {
                            if (confirm('Rechnung als erledigt markieren? Dies löscht die Rechnung und das Bild.')) {
                              completeMutation.mutate(invoice.id);
                            }
                          }}
                          disabled={completeMutation.isPending}
                          className="p-2 text-green-400 hover:bg-green-600/20 rounded-lg transition-colors"
                          title="Als erledigt markieren"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                      )}

                      {/* Delete Button (owner or manager) */}
                      {(isOwner || canManage) && (
                        <button
                          onClick={() => {
                            if (confirm('Rechnung wirklich löschen?')) {
                              deleteMutation.mutate(invoice.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Tuning-Rechnung einreichen</h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Amount */}
              <div>
                <label className="label">Betrag ($) *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input pl-10"
                    placeholder="z.B. 50000"
                    min="1"
                    required
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="label">Beweisfoto *</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    previewUrl
                      ? 'border-green-500/50 bg-green-900/10'
                      : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
                  }`}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {previewUrl ? (
                    <div className="space-y-2">
                      <img
                        src={previewUrl}
                        alt="Vorschau"
                        className="max-h-40 mx-auto rounded-lg"
                      />
                      <p className="text-sm text-green-400">{selectedFile?.name}</p>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload className="h-10 w-10 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400">Klicken um Bild auszuwählen</p>
                      <p className="text-xs text-slate-500 mt-1">JPEG, PNG, GIF, WebP (max. 10MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !amount || !selectedFile}
                  className="btn-primary flex items-center gap-2 px-5"
                >
                  <Plus className="h-4 w-4" />
                  {createMutation.isPending ? 'Wird eingereicht...' : 'Einreichen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageModal(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={tuningApi.getImageUrl(showImageModal)}
              alt="Beweisfoto"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
