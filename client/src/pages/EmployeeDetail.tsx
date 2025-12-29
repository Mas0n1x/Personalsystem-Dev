import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeesApi } from '../services/api';
import { StatusBadge } from '../components/ui/Badge';
import { ArrowLeft, Edit, Star, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Employee, Evaluation, Absence } from '../types';

interface EmployeeDetailData extends Employee {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    role: { id: string; name: string; displayName: string; color: string } | null;
    evaluationsReceived: Evaluation[];
    absences: Absence[];
  };
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getById(id!),
    enabled: !!id,
  });

  const employee = data?.data as EmployeeDetailData | undefined;

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
        <button onClick={() => navigate('/employees')} className="btn-primary mt-4">
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
          onClick={() => navigate('/employees')}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Mitarbeiter Details</h1>
        </div>
        <button className="btn-secondary">
          <Edit className="h-4 w-4" />
          Bearbeiten
        </button>
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
                <p className="text-white font-medium">{employee.department}</p>
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

      {/* Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bewertungen */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400" />
            <h3 className="font-semibold text-white">Letzte Bewertungen</h3>
          </div>
          <div className="card-body">
            {!employee.user?.evaluationsReceived?.length ? (
              <p className="text-slate-400 text-center py-4">Keine Bewertungen vorhanden</p>
            ) : (
              <div className="space-y-4">
                {employee.user.evaluationsReceived.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={evaluation.type} />
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= evaluation.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {format(new Date(evaluation.createdAt), 'dd.MM.yyyy', { locale: de })}
                      </span>
                    </div>
                    {evaluation.comment && (
                      <p className="text-sm text-slate-300">{evaluation.comment}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-2">
                      von {evaluation.evaluator?.displayName || evaluation.evaluator?.username}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Abwesenheiten */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <h3 className="font-semibold text-white">Letzte Abwesenheiten</h3>
          </div>
          <div className="card-body">
            {!employee.user?.absences?.length ? (
              <p className="text-slate-400 text-center py-4">Keine Abwesenheiten vorhanden</p>
            ) : (
              <div className="space-y-4">
                {employee.user.absences.map((absence) => (
                  <div
                    key={absence.id}
                    className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status={absence.type} />
                      <StatusBadge status={absence.status} />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Clock className="h-4 w-4" />
                      {format(new Date(absence.startDate), 'dd.MM.yyyy', { locale: de })} -{' '}
                      {format(new Date(absence.endDate), 'dd.MM.yyyy', { locale: de })}
                    </div>
                    {absence.reason && (
                      <p className="text-sm text-slate-400 mt-2">{absence.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
