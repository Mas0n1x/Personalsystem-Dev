import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { casesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  X,
  RefreshCw,
  Trash2,
  FileText,
  Search,
  AlertTriangle,
  Eye,
  Edit2,
  Upload,
  Image,
  Folder,
  FolderOpen,
  Archive,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  rank: string;
  user: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

interface CaseImage {
  id: string;
  imagePath: string;
  description: string | null;
  createdAt: string;
  uploadedBy: {
    displayName: string | null;
    username: string;
  };
}

interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  suspects: string | null;
  notes: string | null;
  closedAt: string | null;
  createdAt: string;
  createdBy: {
    displayName: string | null;
    username: string;
  };
  leadInvestigator: {
    id: string;
    rank: string;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  } | null;
  images?: CaseImage[];
  _count?: {
    images: number;
  };
}

export default function Detectives() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filter State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [suspects, setSuspects] = useState('');
  const [notes, setNotes] = useState('');
  const [leadInvestigatorId, setLeadInvestigatorId] = useState('');

  // Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDescription, setImageDescription] = useState('');

  // Queries
  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases', statusFilter, searchTerm],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      return casesApi.getAll(params);
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['cases-stats'],
    queryFn: () => casesApi.getStats(),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['cases-employees'],
    queryFn: () => casesApi.getEmployees(),
  });

  const cases = (casesData?.data || []) as Case[];
  const stats = statsData?.data as { open: number; inProgress: number; closed: number; archived: number; total: number } | undefined;
  const employees = (employeesData?.data || []) as Employee[];

  // Mutations
  const createMutation = useMutation({
    mutationFn: casesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['cases-stats'] });
      closeCreateModal();
      toast.success('Ermittlungsakte erstellt');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      casesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['cases-stats'] });
      queryClient.invalidateQueries({ queryKey: ['case-detail'] });
      toast.success('Akte aktualisiert');
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      casesApi.uploadImage(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-detail'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setImageFile(null);
      setImageDescription('');
      toast.success('Bild hochgeladen');
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: casesApi.deleteImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-detail'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Bild gelöscht');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: casesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['cases-stats'] });
      toast.success('Akte gelöscht');
    },
  });

  // Modal Functions
  const openCreateModal = () => {
    setTitle('');
    setDescription('');
    setPriority('NORMAL');
    setSuspects('');
    setNotes('');
    setLeadInvestigatorId('');
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const openDetailModal = async (caseItem: Case) => {
    try {
      const response = await casesApi.getById(caseItem.id);
      setSelectedCase(response.data as Case);
      setShowDetailModal(true);
    } catch {
      toast.error('Fehler beim Laden der Akte');
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedCase(null);
  };

  const openImageModal = (imagePath: string) => {
    setSelectedImage(imagePath);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      description: description || undefined,
      priority,
      suspects: suspects || undefined,
      notes: notes || undefined,
      leadInvestigatorId: leadInvestigatorId || undefined,
    });
  };

  const handleImageUpload = () => {
    if (!imageFile || !selectedCase) return;

    const formData = new FormData();
    formData.append('image', imageFile);
    if (imageDescription) {
      formData.append('description', imageDescription);
    }

    uploadImageMutation.mutate({
      id: selectedCase.id,
      formData,
    });
  };

  const handleStatusChange = (caseId: string, newStatus: string) => {
    updateMutation.mutate({ id: caseId, data: { status: newStatus } });
  };

  const getStatusBadge = (status: Case['status']) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded-full">Offen</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 text-xs bg-amber-600/20 text-amber-400 rounded-full">In Bearbeitung</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded-full">Abgeschlossen</span>;
      case 'ARCHIVED':
        return <span className="px-2 py-0.5 text-xs bg-slate-600/20 text-slate-400 rounded-full">Archiviert</span>;
    }
  };

  const getPriorityBadge = (priority: Case['priority']) => {
    switch (priority) {
      case 'LOW':
        return <span className="px-2 py-0.5 text-xs bg-slate-600/20 text-slate-400 rounded-full">Niedrig</span>;
      case 'NORMAL':
        return <span className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded-full">Normal</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs bg-amber-600/20 text-amber-400 rounded-full">Hoch</span>;
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-xs bg-red-600/20 text-red-400 rounded-full">Kritisch</span>;
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getEmployeeName = (emp: Employee) => emp.user.displayName || emp.user.username;

  // Permission checks
  const canManage = user?.role?.permissions?.some(
    (p: { name: string }) => p.name === 'detectives.manage' || p.name === 'admin.full'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ermittlungsakten</h1>
          <p className="text-slate-400 mt-1">Detectives - Fallakten verwalten</p>
        </div>
        {canManage && (
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Neue Akte
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4 bg-gradient-to-br from-blue-900/20 to-slate-800/50 border-blue-700/30">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-xl font-bold text-blue-400">{stats?.open || 0}</p>
              <p className="text-xs text-slate-400">Offen</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-amber-900/20 to-slate-800/50 border-amber-700/30">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-xl font-bold text-amber-400">{stats?.inProgress || 0}</p>
              <p className="text-xs text-slate-400">In Bearbeitung</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-green-900/20 to-slate-800/50 border-green-700/30">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-xl font-bold text-green-400">{stats?.closed || 0}</p>
              <p className="text-xs text-slate-400">Abgeschlossen</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-slate-800/50 to-slate-800/50 border-slate-700/30">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-xl font-bold text-white">{stats?.archived || 0}</p>
              <p className="text-xs text-slate-400">Archiviert</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-purple-900/20 to-slate-800/50 border-purple-700/30">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-xl font-bold text-purple-400">{stats?.total || 0}</p>
              <p className="text-xs text-slate-400">Gesamt</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
                placeholder="Suche nach Aktenzeichen, Titel oder Verdächtigen..."
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="ALL">Alle Status</option>
            <option value="OPEN">Offen</option>
            <option value="IN_PROGRESS">In Bearbeitung</option>
            <option value="CLOSED">Abgeschlossen</option>
            <option value="ARCHIVED">Archiviert</option>
          </select>
        </div>
      </div>

      {/* Cases List */}
      <div className="card">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Ermittlungsakten</h2>
        </div>
        <div className="divide-y divide-slate-700">
          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
            </div>
          ) : cases.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Keine Ermittlungsakten gefunden</p>
            </div>
          ) : (
            cases.map((caseItem) => (
              <div key={caseItem.id} className="p-4 hover:bg-slate-750 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-600/20 rounded-xl">
                    <FileText className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-purple-400">{caseItem.caseNumber}</span>
                      <span className="font-medium text-white">{caseItem.title}</span>
                      {getStatusBadge(caseItem.status)}
                      {getPriorityBadge(caseItem.priority)}
                      {caseItem._count && caseItem._count.images > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Image className="h-3 w-3" />
                          {caseItem._count.images}
                        </span>
                      )}
                    </div>
                    {caseItem.description && (
                      <p className="text-sm text-slate-400 truncate">{caseItem.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                      <span>Erstellt: {formatDate(caseItem.createdAt)}</span>
                      {caseItem.leadInvestigator && (
                        <span>Ermittler: {getEmployeeName(caseItem.leadInvestigator)}</span>
                      )}
                      <span>von {caseItem.createdBy.displayName || caseItem.createdBy.username}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDetailModal(caseItem)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors"
                      title="Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {canManage && (
                      <button
                        onClick={() => {
                          if (confirm('Akte wirklich löschen?')) {
                            deleteMutation.mutate(caseItem.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
              <h2 className="text-xl font-bold text-white">Neue Ermittlungsakte</h2>
              <button onClick={closeCreateModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              <div>
                <label className="label">Titel *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="z.B. Drogenhandel Southside"
                  required
                />
              </div>

              <div>
                <label className="label">Beschreibung</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Beschreibung des Falls..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Priorität</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="input"
                  >
                    <option value="LOW">Niedrig</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">Hoch</option>
                    <option value="CRITICAL">Kritisch</option>
                  </select>
                </div>
                <div>
                  <label className="label">Ermittler</label>
                  <select
                    value={leadInvestigatorId}
                    onChange={(e) => setLeadInvestigatorId(e.target.value)}
                    className="input"
                  >
                    <option value="">Kein Ermittler</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.rank} - {getEmployeeName(emp)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Verdächtige</label>
                <textarea
                  value={suspects}
                  onChange={(e) => setSuspects(e.target.value)}
                  className="input min-h-[60px]"
                  placeholder="Namen oder Beschreibungen der Verdächtigen..."
                />
              </div>

              <div>
                <label className="label">Interne Notizen</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input min-h-[60px]"
                  placeholder="Interne Notizen..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeCreateModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary px-5">
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCase && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-3xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <div>
                <span className="font-mono text-sm text-purple-400">{selectedCase.caseNumber}</span>
                <h2 className="text-xl font-bold text-white">{selectedCase.title}</h2>
              </div>
              <button onClick={closeDetailModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Priority */}
              <div className="flex items-center gap-4">
                {getStatusBadge(selectedCase.status)}
                {getPriorityBadge(selectedCase.priority)}
                {canManage && (
                  <select
                    value={selectedCase.status}
                    onChange={(e) => handleStatusChange(selectedCase.id, e.target.value)}
                    className="input py-1 px-2 text-sm w-auto ml-auto"
                  >
                    <option value="OPEN">Offen</option>
                    <option value="IN_PROGRESS">In Bearbeitung</option>
                    <option value="CLOSED">Abgeschlossen</option>
                    <option value="ARCHIVED">Archiviert</option>
                  </select>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Erstellt am</p>
                  <p className="text-white">{formatDateTime(selectedCase.createdAt)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Erstellt von</p>
                  <p className="text-white">{selectedCase.createdBy.displayName || selectedCase.createdBy.username}</p>
                </div>
                {selectedCase.leadInvestigator && (
                  <div>
                    <p className="text-slate-500">Ermittler</p>
                    <p className="text-white">{getEmployeeName(selectedCase.leadInvestigator)}</p>
                  </div>
                )}
                {selectedCase.closedAt && (
                  <div>
                    <p className="text-slate-500">Abgeschlossen</p>
                    <p className="text-white">{formatDateTime(selectedCase.closedAt)}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedCase.description && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Beschreibung</p>
                  <p className="text-white bg-slate-700/50 rounded-lg p-3">{selectedCase.description}</p>
                </div>
              )}

              {/* Suspects */}
              {selectedCase.suspects && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Verdächtige</p>
                  <p className="text-amber-400 bg-amber-900/20 rounded-lg p-3">{selectedCase.suspects}</p>
                </div>
              )}

              {/* Notes */}
              {selectedCase.notes && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Interne Notizen</p>
                  <p className="text-white bg-slate-700/50 rounded-lg p-3">{selectedCase.notes}</p>
                </div>
              )}

              {/* Images */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-500 text-sm">Beweisbilder</p>
                  {canManage && (
                    <label className="btn-ghost text-sm px-3 py-1 cursor-pointer flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Bild hochladen
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>

                {imageFile && (
                  <div className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Image className="h-5 w-5 text-slate-400" />
                      <span className="text-white text-sm">{imageFile.name}</span>
                      <button
                        onClick={() => setImageFile(null)}
                        className="ml-auto p-1 text-slate-400 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={imageDescription}
                      onChange={(e) => setImageDescription(e.target.value)}
                      className="input text-sm"
                      placeholder="Bildbeschreibung (optional)"
                    />
                    <button
                      onClick={handleImageUpload}
                      className="btn-primary text-sm px-4 py-1"
                      disabled={uploadImageMutation.isPending}
                    >
                      {uploadImageMutation.isPending ? 'Hochladen...' : 'Hochladen'}
                    </button>
                  </div>
                )}

                {selectedCase.images && selectedCase.images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {selectedCase.images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={casesApi.getImageUrl(image.imagePath)}
                          alt={image.description || 'Beweisbild'}
                          className="w-full h-24 object-cover rounded-lg cursor-pointer"
                          onClick={() => openImageModal(image.imagePath)}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <button
                            onClick={() => openImageModal(image.imagePath)}
                            className="p-1 bg-white/20 rounded"
                          >
                            <Eye className="h-4 w-4 text-white" />
                          </button>
                          {canManage && (
                            <button
                              onClick={() => {
                                if (confirm('Bild wirklich löschen?')) {
                                  deleteImageMutation.mutate(image.id);
                                }
                              }}
                              className="p-1 bg-red-600/50 rounded"
                            >
                              <Trash2 className="h-4 w-4 text-white" />
                            </button>
                          )}
                        </div>
                        {image.description && (
                          <p className="text-xs text-slate-400 mt-1 truncate">{image.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-700/30 rounded-lg">
                    <Image className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Keine Bilder vorhanden</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={closeDetailModal} className="btn-ghost px-5">
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={closeImageModal}
        >
          <button
            onClick={closeImageModal}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg hover:bg-white/20"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={casesApi.getImageUrl(selectedImage)}
            alt="Beweisbild"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
