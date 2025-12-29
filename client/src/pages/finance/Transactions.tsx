import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { Transaction, PaginatedResponse } from '../../types';

interface TransactionResponse extends PaginatedResponse<Transaction> {
  summary: { income: number; expense: number; balance: number };
}

export default function Transactions() {
  const queryClient = useQueryClient();
  const { canManageFinance } = usePermissions();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, type, category],
    queryFn: () =>
      financeApi.getTransactions({
        page: String(page),
        limit: '20',
        ...(type && { type }),
        ...(category && { category }),
      }),
  });

  const response = data?.data as TransactionResponse | undefined;

  const createMutation = useMutation({
    mutationFn: financeApi.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowCreateModal(false);
      toast.success('Transaktion erstellt');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns = [
    {
      key: 'type',
      header: 'Typ',
      render: (tx: Transaction) => (
        <div className="flex items-center gap-2">
          {tx.type === 'INCOME' ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
          <span className={tx.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}>
            {tx.type === 'INCOME' ? 'Einnahme' : 'Ausgabe'}
          </span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Betrag',
      render: (tx: Transaction) => (
        <span className={`font-medium ${tx.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
          {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Kategorie',
      render: (tx: Transaction) => <span className="text-white">{tx.category}</span>,
    },
    {
      key: 'description',
      header: 'Beschreibung',
      render: (tx: Transaction) => (
        <span className="text-slate-300 line-clamp-1">{tx.description || '-'}</span>
      ),
    },
    {
      key: 'user',
      header: 'Erstellt von',
      render: (tx: Transaction) => (
        <span className="text-slate-400">
          {tx.user?.displayName || tx.user?.username}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Datum',
      render: (tx: Transaction) => (
        <span className="text-slate-400">
          {format(new Date(tx.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}
        </span>
      ),
    },
  ];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      type: formData.get('type') as string,
      amount: Number(formData.get('amount')),
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      reference: formData.get('reference') as string,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kasse</h1>
          <p className="text-slate-400 mt-1">Einnahmen und Ausgaben verwalten</p>
        </div>
        {canManageFinance && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Neue Transaktion
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {response?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Einnahmen</p>
                <p className="stat-value text-green-400">{formatCurrency(response.summary.income)}</p>
              </div>
              <div className="p-3 bg-green-900/50 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Ausgaben</p>
                <p className="stat-value text-red-400">{formatCurrency(response.summary.expense)}</p>
              </div>
              <div className="p-3 bg-red-900/50 rounded-xl">
                <TrendingDown className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Bilanz</p>
                <p className={`stat-value ${response.summary.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(response.summary.balance)}
                </p>
              </div>
              <div className="p-3 bg-slate-700 rounded-xl">
                <DollarSign className="h-6 w-6 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card p-4">
        <div className="flex gap-4">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input w-auto">
            <option value="">Alle Typen</option>
            <option value="INCOME">Einnahmen</option>
            <option value="EXPENSE">Ausgaben</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-auto">
            <option value="">Alle Kategorien</option>
            <option value="Gehalt">Gehalt</option>
            <option value="Ausrüstung">Ausrüstung</option>
            <option value="Fahrzeuge">Fahrzeuge</option>
            <option value="Bußgelder">Bußgelder</option>
            <option value="Sonstiges">Sonstiges</option>
          </select>
        </div>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(t) => t.id}
        isLoading={isLoading}
        emptyMessage="Keine Transaktionen gefunden"
      />

      {/* Pagination */}
      {response && response.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={response.totalPages}
          onPageChange={setPage}
          total={response.total}
          limit={response.limit}
        />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Neue Transaktion"
        footer={
          <>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" form="create-form" className="btn-primary">
              Erstellen
            </button>
          </>
        }
      >
        <form id="create-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Typ *</label>
            <select name="type" className="input" required>
              <option value="INCOME">Einnahme</option>
              <option value="EXPENSE">Ausgabe</option>
            </select>
          </div>
          <div>
            <label className="label">Betrag *</label>
            <input name="amount" type="number" step="0.01" min="0" className="input" required />
          </div>
          <div>
            <label className="label">Kategorie *</label>
            <select name="category" className="input" required>
              <option value="">Auswählen...</option>
              <option value="Gehalt">Gehalt</option>
              <option value="Ausrüstung">Ausrüstung</option>
              <option value="Fahrzeuge">Fahrzeuge</option>
              <option value="Bußgelder">Bußgelder</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea name="description" className="input" rows={3} />
          </div>
          <div>
            <label className="label">Referenz</label>
            <input name="reference" className="input" placeholder="z.B. Rechnungsnummer" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
