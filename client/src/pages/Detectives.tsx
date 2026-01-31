import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { casesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import CivilianServiceTracker from '../components/detectives/CivilianServiceTracker';
import DetectiveNamesManager from '../components/detectives/DetectiveNamesManager';
import {
  Plus,
  X,
  RefreshCw,
  Trash2,
  FileText,
  Search,
  Eye,
  Upload,
  Image,
  Folder,
  FolderOpen,
  Archive,
  CheckCircle,
  ArrowLeft,
  User,
  Pencil,
  Save,
  MessageSquarePlus,
  Clock,
  Users,
  UserCheck,
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

interface InvestigationResult {
  id: string;
  content: string;
  createdAt: string;
  createdBy: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
}

interface DetectiveFolder {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  detective: {
    id: string;
    rank: string;
    user: {
      displayName: string | null;
      username: string;
      avatar: string | null;
    };
  };
  createdBy: {
    displayName: string | null;
    username: string;
  };
  _count?: {
    cases: number;
  };
  cases?: Case[];
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
  folder?: DetectiveFolder;
  images?: CaseImage[];
  investigationResults?: InvestigationResult[];
  _count?: {
    images: number;
  };
}

export default function Detectives() {
  const { user, hasAnyPermission } = useAuth();
  const queryClient = useQueryClient();

  // Tab State
  const [activeTab, setActiveTab] = useState<'cases' | 'civilian-service' | 'names'>('cases');

  // View State
  const [selectedFolder, setSelectedFolder] = useState<DetectiveFolder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showAddResultModal, setShowAddResultModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Form State - Folder
  const [selectedDetectiveId, setSelectedDetectiveId] = useState('');
  const [folderDescription, setFolderDescription] = useState('');

  // Form State - Case
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [suspects, setSuspects] = useState('');
  const [notes, setNotes] = useState('');

  // Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDescription, setImageDescription] = useState('');

  // Investigation Result State
  const [resultContent, setResultContent] = useState('');

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editSuspects, setEditSuspects] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Confirm Dialog State
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
    confirmText: 'Löschen',
    variant: 'danger',
    onConfirm: () => {},
  });

  // STRG+V Paste Handler für Bilder
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!selectedCase) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Erstelle einen aussagekräftigen Dateinamen
          const extension = item.type.split('/')[1] || 'png';
          const renamedFile = new File([file], `fall-bild-${Date.now()}.${extension}`, { type: file.type });
          setImageFile(renamedFile);
          toast.success('Bild aus Zwischenablage eingefügt');
          e.preventDefault();
          return;
        }
      }
    }
  }, [selectedCase]);

  // Paste Event Listener registrieren
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Queries
  const { data: foldersData, isLoading: foldersLoading } = useQuery({
    queryKey: ['detective-folders'],
    queryFn: () => casesApi.getFolders().then((r) => r.data),
  });

  const { data: folderDetailData, isLoading: folderDetailLoading } = useQuery({
    queryKey: ['detective-folder', selectedFolder?.id],
    queryFn: () => casesApi.getFolderById(selectedFolder!.id).then((r) => r.data),
    enabled: !!selectedFolder,
  });

  const { data: statsData } = useQuery({
    queryKey: ['cases-stats'],
    queryFn: () => casesApi.getStats().then((r) => r.data),
  });

  const { data: employeesWithoutFolderData } = useQuery({
    queryKey: ['employees-without-folder'],
    queryFn: () => casesApi.getEmployeesWithoutFolder().then((r) => r.data),
  });

  const folders = (foldersData || []) as DetectiveFolder[];
  const folderDetail = folderDetailData as DetectiveFolder | undefined;
  const stats = statsData as { folders: number; open: number; inProgress: number; closed: number; archived: number; totalCases: number } | undefined;
  const employeesWithoutFolder = (employeesWithoutFolderData || []) as Employee[];

  // Filter cases in folder
  const filteredCases = (folderDetail?.cases || []).filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.suspects && c.suspects.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Mutations
  const createFolderMutation = useMutation({
    mutationFn: casesApi.createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detective-folders'] });
      queryClient.invalidateQueries({ queryKey: ['employees-without-folder'] });
      queryClient.invalidateQueries({ queryKey: ['cases-stats'] });
      closeCreateFolderModal();
      toast.success('Ordner erstellt');
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: casesApi.deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detective-folders'] });
      queryClient.invalidateQueries({ queryKey: ['employees-without-folder'] });
      queryClient.invalidateQueries({ queryKey: ['cases-stats'] });
      setSelectedFolder(null);
      toast.success('Ordner gelöscht');
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: casesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detective-folder', selectedFolder?.id] });
      queryClient.invalidateQueries({ queryKey: ['cases-stats'] });
      closeCreateCaseModal();
      toast.success('Akte erstellt');
    },
  });

  const updateCaseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      casesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detective-folder', selectedFolder?.id] });
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
      setImageFile(null);
      setImageDescription('');
      toast.success('Bild hochgeladen');
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: casesApi.deleteImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-detail'] });
      toast.success('Bild gelöscht');
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: casesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detective-folder', selectedFolder?.id] });
      queryClient.invalidateQueries({ queryKey: ['cases-stats'] });
      toast.success('Akte gelöscht');
    },
  });

  const createInvestigationResultMutation = useMutation({
    mutationFn: ({ caseId, content }: { caseId: string; content: string }) =>
      casesApi.createInvestigationResult(caseId, { content }),
    onSuccess: async () => {
      toast.success('Ermittlungsergebnis hinzugefügt');
      setResultContent('');
      setShowAddResultModal(false);
      // Reload case details
      if (selectedCase) {
        const response = await casesApi.getById(selectedCase.id);
        setSelectedCase(response.data as Case);
      }
    },
  });

  const deleteInvestigationResultMutation = useMutation({
    mutationFn: casesApi.deleteInvestigationResult,
    onSuccess: async () => {
      toast.success('Ermittlungsergebnis gelöscht');
      // Reload case details
      if (selectedCase) {
        const response = await casesApi.getById(selectedCase.id);
        setSelectedCase(response.data as Case);
      }
    },
  });

  // Modal Functions - Folder
  const openCreateFolderModal = () => {
    setSelectedDetectiveId('');
    setFolderDescription('');
    setShowCreateFolderModal(true);
  };

  const closeCreateFolderModal = () => {
    setShowCreateFolderModal(false);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createFolderMutation.mutate({
      detectiveId: selectedDetectiveId,
      description: folderDescription || undefined,
    });
  };

  // Modal Functions - Case
  const openCreateCaseModal = () => {
    setTitle('');
    setDescription('');
    setPriority('NORMAL');
    setSuspects('');
    setNotes('');
    setShowCreateCaseModal(true);
  };

  const closeCreateCaseModal = () => {
    setShowCreateCaseModal(false);
  };

  const handleCreateCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolder) return;
    createCaseMutation.mutate({
      title,
      description: description || undefined,
      priority,
      suspects: suspects || undefined,
      notes: notes || undefined,
      folderId: selectedFolder.id,
    });
  };

  // Detail Modal
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
    setIsEditing(false);
  };

  const startEditing = () => {
    if (!selectedCase) return;
    setEditTitle(selectedCase.title);
    setEditDescription(selectedCase.description || '');
    setEditPriority(selectedCase.priority);
    setEditSuspects(selectedCase.suspects || '');
    setEditNotes(selectedCase.notes || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedCase) return;

    updateCaseMutation.mutate({
      id: selectedCase.id,
      data: {
        title: editTitle,
        description: editDescription || null,
        priority: editPriority,
        suspects: editSuspects || null,
        notes: editNotes || null,
      },
    }, {
      onSuccess: async () => {
        // Reload case details
        const response = await casesApi.getById(selectedCase.id);
        setSelectedCase(response.data as Case);
        setIsEditing(false);
      },
    });
  };

  // Image Modal
  const openImageModal = (imagePath: string) => {
    setSelectedImage(imagePath);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
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

  // Investigation Result Modal Functions
  const openAddResultModal = () => {
    setResultContent('');
    setShowAddResultModal(true);
  };

  const closeAddResultModal = () => {
    setShowAddResultModal(false);
    setResultContent('');
  };

  const handleAddResultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !resultContent.trim()) return;
    createInvestigationResultMutation.mutate({
      caseId: selectedCase.id,
      content: resultContent.trim(),
    });
  };

  const handleStatusChange = (caseId: string, newStatus: string) => {
    updateCaseMutation.mutate({ id: caseId, data: { status: newStatus } });
  };

  // Helpers
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
  const getDetectiveName = (folder: DetectiveFolder) => folder.detective.user.displayName || folder.detective.user.username;

  // Permission checks
  const canManage = hasAnyPermission('detectives.manage', 'admin.full');

  // Render folder view (list of cases in a folder)
  if (selectedFolder) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedFolder(null)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-400" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-6 w-6 text-purple-400" />
                <h1 className="text-2xl font-bold text-white">{folderDetail?.name || selectedFolder.name}</h1>
              </div>
              <p className="text-slate-400 mt-1">
                Ermittlungsakten von {getDetectiveName(folderDetail || selectedFolder)}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <button onClick={openCreateCaseModal} className="btn-primary flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Neue Akte
              </button>
              <button
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: 'Ordner löschen',
                    message: 'Möchtest du diesen Ordner und alle Akten darin wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
                    confirmText: 'Löschen',
                    variant: 'danger',
                    onConfirm: () => deleteFolderMutation.mutate(selectedFolder.id),
                  });
                }}
                className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-600/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {folderDetail?.description && (
          <div className="card p-4">
            <p className="text-slate-300">{folderDetail.description}</p>
          </div>
        )}

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
            <h2 className="font-semibold text-white">
              Ermittlungsakten ({filteredCases.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-700">
            {folderDetailLoading ? (
              <div className="p-12 text-center">
                <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Keine Ermittlungsakten in diesem Ordner</p>
              </div>
            ) : (
              filteredCases.map((caseItem) => (
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
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Akte löschen',
                              message: 'Möchtest du diese Akte wirklich löschen?',
                              confirmText: 'Löschen',
                              variant: 'danger',
                              onConfirm: () => deleteCaseMutation.mutate(caseItem.id),
                            });
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

        {/* Create Case Modal */}
        {showCreateCaseModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
                <h2 className="text-xl font-bold text-white">Neue Ermittlungsakte</h2>
                <button onClick={closeCreateCaseModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreateCaseSubmit} className="p-6 space-y-5">
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
                  <button type="button" onClick={closeCreateCaseModal} className="btn-ghost px-5">
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
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="input text-xl font-bold mt-1"
                      placeholder="Titel"
                    />
                  ) : (
                    <h2 className="text-xl font-bold text-white">{selectedCase.title}</h2>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canManage && !isEditing && (
                    <button
                      onClick={startEditing}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                      title="Bearbeiten"
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                  )}
                  <button onClick={closeDetailModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Status & Priority */}
                <div className="flex items-center gap-4">
                  {!isEditing && getStatusBadge(selectedCase.status)}
                  {!isEditing && getPriorityBadge(selectedCase.priority)}
                  {canManage && !isEditing && (
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
                  {isEditing && (
                    <div className="flex items-center gap-4 w-full">
                      <div>
                        <label className="text-xs text-slate-500">Priorität</label>
                        <select
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                          className="input py-1 px-2 text-sm"
                        >
                          <option value="LOW">Niedrig</option>
                          <option value="NORMAL">Normal</option>
                          <option value="HIGH">Hoch</option>
                          <option value="CRITICAL">Kritisch</option>
                        </select>
                      </div>
                    </div>
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
                  {selectedCase.closedAt && (
                    <div>
                      <p className="text-slate-500">Abgeschlossen</p>
                      <p className="text-white">{formatDateTime(selectedCase.closedAt)}</p>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <p className="text-slate-500 text-sm mb-1">Beschreibung</p>
                  {isEditing ? (
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="input min-h-[80px]"
                      placeholder="Beschreibung des Falls..."
                    />
                  ) : selectedCase.description ? (
                    <p className="text-white bg-slate-700/50 rounded-lg p-3">{selectedCase.description}</p>
                  ) : (
                    <p className="text-slate-500 bg-slate-700/30 rounded-lg p-3 italic">Keine Beschreibung</p>
                  )}
                </div>

                {/* Suspects */}
                <div>
                  <p className="text-slate-500 text-sm mb-1">Verdächtige</p>
                  {isEditing ? (
                    <textarea
                      value={editSuspects}
                      onChange={(e) => setEditSuspects(e.target.value)}
                      className="input min-h-[60px]"
                      placeholder="Namen oder Beschreibungen der Verdächtigen..."
                    />
                  ) : selectedCase.suspects ? (
                    <p className="text-amber-400 bg-amber-900/20 rounded-lg p-3">{selectedCase.suspects}</p>
                  ) : (
                    <p className="text-slate-500 bg-slate-700/30 rounded-lg p-3 italic">Keine Verdächtigen eingetragen</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <p className="text-slate-500 text-sm mb-1">Interne Notizen</p>
                  {isEditing ? (
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="input min-h-[60px]"
                      placeholder="Interne Notizen..."
                    />
                  ) : selectedCase.notes ? (
                    <p className="text-white bg-slate-700/50 rounded-lg p-3">{selectedCase.notes}</p>
                  ) : (
                    <p className="text-slate-500 bg-slate-700/30 rounded-lg p-3 italic">Keine Notizen</p>
                  )}
                </div>

                {/* Investigation Results (Ermittlungsergebnisse) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquarePlus className="h-5 w-5 text-blue-400" />
                      <p className="font-semibold text-white">Ermittlungsergebnisse</p>
                    </div>
                    {canManage && !isEditing && (
                      <button onClick={openAddResultModal} className="btn-ghost text-sm px-3 py-1 flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Hinzufügen
                      </button>
                    )}
                  </div>

                  {selectedCase.investigationResults && selectedCase.investigationResults.length > 0 ? (
                    <div className="space-y-3">
                      {selectedCase.investigationResults.map((result) => (
                        <div key={result.id} className="bg-blue-900/10 border border-blue-700/30 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              <span>{formatDateTime(result.createdAt)}</span>
                              <span>•</span>
                              <span>{result.createdBy.displayName || result.createdBy.username}</span>
                            </div>
                            {canManage && !isEditing && (
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Ermittlungsergebnis löschen',
                                    message: 'Möchtest du dieses Ermittlungsergebnis wirklich löschen?',
                                    confirmText: 'Löschen',
                                    variant: 'danger',
                                    onConfirm: () => deleteInvestigationResultMutation.mutate(result.id),
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-white whitespace-pre-wrap">{result.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-700/30 rounded-lg border border-dashed border-slate-600">
                      <MessageSquarePlus className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Noch keine Ermittlungsergebnisse vorhanden</p>
                      {canManage && !isEditing && (
                        <button onClick={openAddResultModal} className="btn-ghost text-sm mt-2">
                          Erstes Ergebnis hinzufügen
                        </button>
                      )}
                    </div>
                  )}
                </div>

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
                    <span className="text-xs text-slate-500">STRG+V zum Einfügen</span>
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
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Bild löschen',
                                    message: 'Möchtest du dieses Bild wirklich löschen?',
                                    confirmText: 'Löschen',
                                    variant: 'danger',
                                    onConfirm: () => deleteImageMutation.mutate(image.id),
                                  });
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

                <div className="flex justify-end gap-3 pt-2">
                  {isEditing ? (
                    <>
                      <button onClick={cancelEditing} className="btn-ghost px-5">
                        Abbrechen
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={updateCaseMutation.isPending || !editTitle.trim()}
                        className="btn-primary flex items-center gap-2 px-5"
                      >
                        <Save className="h-4 w-4" />
                        {updateCaseMutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
                      </button>
                    </>
                  ) : (
                    <button onClick={closeDetailModal} className="btn-ghost px-5">
                      Schließen
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Investigation Result Modal */}
        {showAddResultModal && selectedCase && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="h-5 w-5 text-blue-400" />
                  <h2 className="text-xl font-bold text-white">Ermittlungsergebnis hinzufügen</h2>
                </div>
                <button onClick={closeAddResultModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddResultSubmit} className="p-6 space-y-5">
                <div>
                  <label className="label">Ermittlungsergebnis / Fortschritt *</label>
                  <textarea
                    value={resultContent}
                    onChange={(e) => setResultContent(e.target.value)}
                    className="input min-h-[150px]"
                    placeholder="Beschreibe die neuen Erkenntnisse, Entwicklungen oder Fortschritte in der Ermittlung..."
                    required
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Halte wichtige Ermittlungsschritte chronologisch fest
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeAddResultModal} className="btn-ghost px-5">
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-5"
                    disabled={createInvestigationResultMutation.isPending || !resultContent.trim()}
                  >
                    {createInvestigationResultMutation.isPending ? 'Wird hinzugefügt...' : 'Hinzufügen'}
                  </button>
                </div>
              </form>
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

  // Render main folders view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Detectives</h1>
          <p className="text-slate-400 mt-1">Ermittlungsakten, Zivildienst-Tracking & Namen-Dokumentation</p>
        </div>
        {activeTab === 'cases' && canManage && employeesWithoutFolder.length > 0 && (
          <button onClick={openCreateFolderModal} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Neuer Ordner
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('cases')}
            className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'cases'
                ? 'text-primary-400 border-b-2 border-primary-400 bg-slate-700/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20'
            }`}
          >
            <Folder className="h-5 w-5" />
            Detektiv-Akten
          </button>
          <button
            onClick={() => setActiveTab('civilian-service')}
            className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'civilian-service'
                ? 'text-primary-400 border-b-2 border-primary-400 bg-slate-700/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20'
            }`}
          >
            <Clock className="h-5 w-5" />
            Zivildienst-Tracking
          </button>
          <button
            onClick={() => setActiveTab('names')}
            className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'names'
                ? 'text-primary-400 border-b-2 border-primary-400 bg-slate-700/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20'
            }`}
          >
            <Users className="h-5 w-5" />
            Namen-Dokumentation
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'cases' && (
        <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="card p-4 bg-gradient-to-br from-purple-900/20 to-slate-800/50 border-purple-700/30">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-xl font-bold text-purple-400">{stats?.folders || 0}</p>
              <p className="text-xs text-slate-400">Ordner</p>
            </div>
          </div>
        </div>
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
        <div className="card p-4 bg-gradient-to-br from-indigo-900/20 to-slate-800/50 border-indigo-700/30">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-indigo-400" />
            <div>
              <p className="text-xl font-bold text-indigo-400">{stats?.totalCases || 0}</p>
              <p className="text-xs text-slate-400">Akten Gesamt</p>
            </div>
          </div>
        </div>
      </div>

      {/* Folders Grid */}
      <div className="card">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Detektiv-Ordner</h2>
        </div>
        {foldersLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto" />
          </div>
        ) : folders.length === 0 ? (
          <div className="p-12 text-center">
            <Folder className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Keine Detektiv-Ordner vorhanden</p>
            {canManage && employeesWithoutFolder.length > 0 && (
              <button onClick={openCreateFolderModal} className="btn-primary mt-4">
                Ersten Ordner erstellen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(folder)}
                className="card p-4 hover:bg-slate-700/50 cursor-pointer transition-colors border border-slate-700 hover:border-purple-600/50"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-600/20 rounded-xl">
                    <Folder className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{folder.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                      <User className="h-3 w-3" />
                      <span>{folder.detective.rank}</span>
                    </div>
                    {folder.description && (
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">{folder.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-3">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {folder._count?.cases || 0} Akten
                      </span>
                      <span>Erstellt: {formatDate(folder.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      )}

      {/* Civilian Service Tab */}
      {activeTab === 'civilian-service' && user?.employee?.id && (
        <CivilianServiceTracker employeeId={user.employee.id} />
      )}

      {/* Names Documentation Tab */}
      {activeTab === 'names' && (
        <DetectiveNamesManager />
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Neuer Detektiv-Ordner</h2>
              <button onClick={closeCreateFolderModal} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="p-6 space-y-5">
              <div>
                <label className="label">Detektiv *</label>
                <select
                  value={selectedDetectiveId}
                  onChange={(e) => setSelectedDetectiveId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Detektiv auswählen...</option>
                  {employeesWithoutFolder.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.rank} - {getEmployeeName(emp)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Nur Mitarbeiter ohne bestehenden Ordner werden angezeigt
                </p>
              </div>

              <div>
                <label className="label">Beschreibung (optional)</label>
                <textarea
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Optionale Beschreibung für den Ordner..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeCreateFolderModal} className="btn-ghost px-5">
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary px-5" disabled={!selectedDetectiveId}>
                  Erstellen
                </button>
              </div>
            </form>
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
