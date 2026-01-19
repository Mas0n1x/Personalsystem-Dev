import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import { Search, FileText, Filter, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { AuditLog, PaginatedResponse } from '../../types';

// Übersetze Aktionen in lesbare Beschreibungen
function getActionDescription(action: string, entity: string, details: string | null): string {
  const method = action.split(' ')[0];
  const path = action.split(' ').slice(1).join(' ');

  // Parse details wenn vorhanden
  let parsedDetails: { body?: Record<string, unknown>; path?: string } = {};
  try {
    if (details) {
      parsedDetails = JSON.parse(details);
    }
  } catch {
    // Ignoriere Parse-Fehler
  }

  const body = parsedDetails.body || {};

  // Auth-spezifische Beschreibungen
  if (path.includes('/auth/discord/callback') || entity === 'callback') {
    return 'Discord Login durchgeführt';
  }
  if (path.includes('/auth/logout') || (entity === 'auth' && path.includes('logout'))) {
    return 'Benutzer ausgeloggt';
  }
  if (path.includes('/auth/') || entity === 'auth') {
    if (path.includes('callback')) return 'Discord Login durchgeführt';
    if (path.includes('login')) return 'Benutzer eingeloggt';
    return 'Authentifizierung';
  }

  // Wenn entity "unknown" ist, versuche aus dem Pfad zu extrahieren
  if (entity === 'unknown') {
    if (path.includes('/discord')) return 'Discord-Aktion';
    if (path.includes('/auth')) return 'Authentifizierung';
    return 'Systemaktivität';
  }

  // Spezifische Beschreibungen basierend auf Pfad und Methode
  if (path.includes('/employees') && method === 'POST' && !path.includes('/')) {
    return `Neuer Mitarbeiter erstellt: ${body.badgeNumber || 'Unbekannt'}`;
  }
  if (path.includes('/terminate')) {
    return 'Mitarbeiter gekündigt';
  }
  if (path.includes('/promote')) {
    return `Mitarbeiter befördert zu ${body.newRank || 'Unbekannt'}`;
  }
  if (path.includes('/employees') && method === 'PUT') {
    return 'Mitarbeiter bearbeitet';
  }
  if (path.includes('/absences') && method === 'POST') {
    return `Abmeldung erstellt (${body.type === 'DAY_OFF' ? 'Dienstfrei' : 'Abwesenheit'})`;
  }
  if (path.includes('/absences') && method === 'DELETE') {
    return 'Abmeldung gelöscht';
  }
  if (path.includes('/sanctions') && method === 'POST') {
    return `Sanktion erstellt: ${body.reason ? String(body.reason).substring(0, 30) + '...' : 'Ohne Grund'}`;
  }
  if (path.includes('/revoke')) {
    return 'Sanktion widerrufen';
  }
  if (path.includes('/tasks') && method === 'POST') {
    return `Aufgabe erstellt: ${body.title || 'Unbekannt'}`;
  }
  if (path.includes('/tasks') && method === 'PUT') {
    return 'Aufgabe aktualisiert';
  }
  if (path.includes('/tasks') && method === 'DELETE') {
    return 'Aufgabe gelöscht';
  }
  if (path.includes('/treasury/deposit')) {
    return `Einzahlung: $${body.amount || 0} (${body.moneyType === 'BLACK' ? 'Schwarz' : 'Normal'}) - ${body.reason || 'Kein Grund'}`;
  }
  if (path.includes('/treasury/withdraw')) {
    return `Auszahlung: $${body.amount || 0} (${body.moneyType === 'BLACK' ? 'Schwarz' : 'Normal'}) - ${body.reason || 'Kein Grund'}`;
  }
  if (path.includes('/accept')) {
    return 'Bewerbung angenommen';
  }
  if (path.includes('/reject')) {
    return 'Bewerbung abgelehnt';
  }
  if (path.includes('/applications') && method === 'POST') {
    return 'Neue Bewerbung eingereicht';
  }
  if (path.includes('/approve')) {
    return 'Anfrage genehmigt';
  }
  if (path.includes('/cases') && method === 'POST') {
    return `Fall erstellt: ${body.title || 'Unbekannt'}`;
  }
  if (path.includes('/cases') && method === 'PUT') {
    return 'Fall aktualisiert';
  }
  if (path.includes('/investigations') && method === 'POST') {
    return 'Ermittlung erstellt';
  }
  if (path.includes('/trainings') && method === 'POST') {
    return `Training erstellt: ${body.topic || 'Unbekannt'}`;
  }
  if (path.includes('/evidence') && method === 'POST') {
    return `Asservat eingelagert: ${body.name || 'Unbekannt'}`;
  }
  if (path.includes('/evidence') && path.includes('/destroy')) {
    return `Asservat vernichtet${body.quantity ? ` (${body.quantity}x)` : ''}`;
  }
  if (path.includes('/evidence') && path.includes('/release')) {
    return 'Asservat ausgelagert';
  }
  if (path.includes('/robbery') && method === 'POST') {
    return 'Raub eingetragen';
  }
  if (path.includes('/tuning') && method === 'POST') {
    return `Tuning-Rechnung eingereicht: $${body.amount || 0}`;
  }
  if (path.includes('/calendar') && method === 'POST') {
    return `Termin erstellt: ${body.title || 'Unbekannt'}`;
  }
  if (path.includes('/calendar') && method === 'PUT') {
    return 'Termin aktualisiert';
  }
  if (path.includes('/calendar') && method === 'DELETE') {
    return 'Termin gelöscht';
  }
  if (path.includes('/bonus') && path.includes('/pay')) {
    return 'Sonderzahlung ausgezahlt';
  }
  if (path.includes('/units') && method === 'POST') {
    return `Unit erstellt: ${body.name || 'Unbekannt'}`;
  }
  if (path.includes('/units') && method === 'PUT') {
    return 'Unit aktualisiert';
  }
  if (path.includes('/team-change-reports') && method === 'POST') {
    return `Teamwechsel: ${body.previousTeam || '?'} → ${body.newTeam || '?'}`;
  }
  if (path.includes('/login')) {
    return 'Benutzer eingeloggt';
  }
  if (path.includes('/notifications') && method === 'PUT') {
    return 'Benachrichtigung gelesen';
  }
  if (path.includes('/notifications') && method === 'POST') {
    return 'Benachrichtigung erstellt';
  }

  // Fallback
  const actionMap: Record<string, string> = {
    'POST': 'Erstellt',
    'PUT': 'Aktualisiert',
    'PATCH': 'Aktualisiert',
    'DELETE': 'Gelöscht',
  };

  const entityMap: Record<string, string> = {
    'employees': 'Mitarbeiter',
    'users': 'Benutzer',
    'absences': 'Abmeldung',
    'sanctions': 'Sanktion',
    'tasks': 'Aufgabe',
    'treasury': 'Kasse',
    'applications': 'Bewerbung',
    'cases': 'Fall',
    'investigations': 'Ermittlung',
    'trainings': 'Training',
    'evidence': 'Asservat',
    'robbery': 'Raub',
    'tuning': 'Tuning',
    'calendar': 'Termin',
    'bonus': 'Bonus',
    'units': 'Unit',
    'auth': 'Authentifizierung',
    'callback': 'Discord Login',
    'uprank-requests': 'Uprank-Anfrage',
    'uprank-locks': 'Uprank-Sperre',
    'team-change-reports': 'Teamwechsel',
    'announcements': 'Ankündigung',
    'notifications': 'Benachrichtigung',
    'discord': 'Discord',
    'unknown': 'System',
  };

  return `${actionMap[method] || method} - ${entityMap[entity] || entity}`;
}

// Übersetze Entity-Namen
const entityLabels: Record<string, string> = {
  'employees': 'Mitarbeiter',
  'users': 'Benutzer',
  'absences': 'Abmeldungen',
  'sanctions': 'Sanktionen',
  'tasks': 'Aufgaben',
  'treasury': 'Kasse',
  'applications': 'Bewerbungen',
  'cases': 'Fälle',
  'investigations': 'Ermittlungen',
  'trainings': 'Trainings',
  'evidence': 'Asservate',
  'robbery': 'Räube',
  'tuning': 'Tuning',
  'calendar': 'Kalender',
  'bonus': 'Bonus',
  'units': 'Units',
  'auth': 'Login',
  'callback': 'Login',
  'discord': 'Discord',
  'unknown': 'System',
  'uprank-requests': 'Uprank-Anfragen',
  'uprank-locks': 'Uprank-Sperren',
  'team-change-reports': 'Teamwechsel',
  'announcements': 'Ankündigungen',
  'notifications': 'Benachrichtigungen',
  'admin': 'Admin',
};

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, entity, action],
    queryFn: () =>
      adminApi.getAuditLogs({
        page: String(page),
        limit: '50',
        ...(entity && { entity }),
        ...(action && { action }),
      }),
  });

  const response = data?.data as PaginatedResponse<AuditLog> | undefined;

  const getActionColor = (action: string): string => {
    if (action.includes('POST')) return 'text-green-400';
    if (action.includes('PUT') || action.includes('PATCH')) return 'text-yellow-400';
    if (action.includes('DELETE')) return 'text-red-400';
    return 'text-slate-400';
  };

  const columns = [
    {
      key: 'description',
      header: 'Beschreibung',
      render: (log: AuditLog) => (
        <span className="text-white text-sm">
          {getActionDescription(log.action, log.entity, log.details)}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Bereich',
      render: (log: AuditLog) => (
        <span className="badge-gray">{entityLabels[log.entity] || log.entity}</span>
      ),
    },
    {
      key: 'user',
      header: 'Benutzer',
      render: (log: AuditLog) =>
        log.user ? (
          <div className="flex items-center gap-2">
            <img
              src={
                log.user.avatar ||
                `https://ui-avatars.com/api/?name=${log.user.username}&background=random`
              }
              alt={log.user.username}
              className="h-6 w-6 rounded-full"
            />
            <span className="text-slate-300">{log.user.displayName || log.user.username}</span>
          </div>
        ) : (
          <span className="text-slate-500">System</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Zeit',
      render: (log: AuditLog) => (
        <span className="text-slate-400 text-sm">
          {format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (log: AuditLog) => (
        <button
          onClick={() => setSelectedLog(log)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
          title="Details anzeigen"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header mit Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-600/20 via-slate-800 to-gray-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gray-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-500/20 rounded-2xl backdrop-blur-sm border border-slate-500/30 shadow-lg shadow-slate-500/20">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Audit-Logs</h1>
              <p className="text-slate-400 mt-0.5">Alle Systemaktivitäten protokolliert</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Aktion suchen..."
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="input w-auto"
          >
            <option value="">Alle Bereiche</option>
            <option value="auth">Authentifizierung</option>
            <option value="employees">Mitarbeiter</option>
            <option value="absences">Abmeldungen</option>
            <option value="sanctions">Sanktionen</option>
            <option value="tasks">Aufgaben</option>
            <option value="treasury">Kasse</option>
            <option value="applications">Bewerbungen</option>
            <option value="uprank-requests">Uprank-Anfragen</option>
            <option value="cases">Fälle</option>
            <option value="investigations">Ermittlungen</option>
            <option value="trainings">Trainings</option>
            <option value="evidence">Asservate</option>
            <option value="robbery">Räube</option>
            <option value="tuning">Tuning</option>
            <option value="calendar">Kalender</option>
            <option value="bonus">Bonus</option>
            <option value="units">Units</option>
            <option value="team-change-reports">Teamwechsel</option>
          </select>
          <button className="btn-ghost">
            <Filter className="h-4 w-4" />
            Mehr Filter
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <Table
        columns={columns}
        data={response?.data || []}
        keyExtractor={(l) => l.id}
        isLoading={isLoading}
        emptyMessage="Keine Audit-Logs gefunden"
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

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl w-full max-w-2xl border border-slate-700/50 shadow-2xl shadow-black/50 animate-scale-in max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Log Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase">Aktion</label>
                  <p className={`font-mono text-sm ${getActionColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Bereich</label>
                  <p className="text-white">{entityLabels[selectedLog.entity] || selectedLog.entity}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Benutzer</label>
                  <p className="text-white">
                    {selectedLog.user?.displayName || selectedLog.user?.username || 'System'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Zeit</label>
                  <p className="text-white">
                    {format(new Date(selectedLog.createdAt), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">IP-Adresse</label>
                  <p className="text-slate-400 font-mono text-sm">{selectedLog.ipAddress || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Entity ID</label>
                  <p className="text-slate-400 font-mono text-sm">{selectedLog.entityId || '-'}</p>
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <label className="text-xs text-slate-500 uppercase">Details</label>
                  <pre className="mt-1 p-4 bg-slate-900/50 rounded-lg text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(selectedLog.details), null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <label className="text-xs text-slate-500 uppercase">User Agent</label>
                  <p className="text-slate-400 text-sm break-all">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
