import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi, notificationsApi, employeesApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  Calendar as CalendarIcon,
  Plus,
  X,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Bell,
  Users,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ==================== TYPES ====================

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isAllDay: boolean;
  color: string;
  category: string;
  discordRoleIds: string | null;
  notifyEmployeeIds: string | null;
  reminderMinutes: number | null;
  reminderSent: boolean;
  createdBy: {
    displayName: string | null;
    username: string;
    avatar: string | null;
  };
  createdAt: string;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

interface Employee {
  id: string;
  rank: string;
  user: {
    displayName: string | null;
    username: string;
  };
}

// ==================== CONSTANTS ====================

const CATEGORIES = [
  { value: 'GENERAL', label: 'Allgemein', color: '#3b82f6' },
  { value: 'TRAINING', label: 'Training', color: '#22c55e' },
  { value: 'MEETING', label: 'Besprechung', color: '#f59e0b' },
  { value: 'EVENT', label: 'Event', color: '#a855f7' },
  { value: 'DEADLINE', label: 'Deadline', color: '#ef4444' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'Keine Erinnerung' },
  { value: 15, label: '15 Minuten vorher' },
  { value: 30, label: '30 Minuten vorher' },
  { value: 60, label: '1 Stunde vorher' },
  { value: 120, label: '2 Stunden vorher' },
  { value: 1440, label: '1 Tag vorher' },
];

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// ==================== HELPER FUNCTIONS ====================

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from Monday of the first week
  const startDate = new Date(firstDay);
  const dayOfWeek = startDate.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startDate.setDate(startDate.getDate() + diff);

  // Generate 6 weeks (42 days)
  for (let i = 0; i < 42; i++) {
    days.push(new Date(startDate));
    startDate.setDate(startDate.getDate() + 1);
  }

  return days;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ==================== MAIN COMPONENT ====================

export default function Calendar() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [category, setCategory] = useState('GENERAL');
  const [color, setColor] = useState('#3b82f6');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<number>(0);

  // Calculate date range for current month view
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Query events for current month
  const { data: eventsData } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => calendarApi.getAll({
      start: new Date(year, month - 1, 1).toISOString(),
      end: new Date(year, month + 2, 0).toISOString(),
    }),
  });

  // Query Discord roles (optional - fails gracefully if user doesn't have permission)
  const { data: rolesData } = useQuery({
    queryKey: ['notification-discord-roles'],
    queryFn: async () => {
      try {
        const res = await notificationsApi.getDiscordRoles();
        return res.data as { serverName: string; roles: DiscordRole[] };
      } catch (error) {
        console.warn('Discord roles not available (missing permission or Discord offline)');
        return { serverName: '', roles: [] as DiscordRole[] };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query Employees
  const { data: employeesData } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      try {
        const res = await employeesApi.getAll({ status: 'ACTIVE' });
        return res.data?.data as Employee[] || [];
      } catch (error) {
        console.error('Failed to load employees:', error);
        return [] as Employee[];
      }
    },
    retry: 1,
  });

  const events = Array.isArray(eventsData?.data) ? eventsData.data as CalendarEvent[] : [];
  const discordRoles = Array.isArray(rolesData?.roles) ? rolesData.roles : [];
  const employees = Array.isArray(employeesData) ? employeesData : [];
  const days = getDaysInMonth(year, month);

  // Mutations
  const createMutation = useMutation({
    mutationFn: calendarApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendarUpcoming'] });
      closeModal();
      toast.success('Termin erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      calendarApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendarUpcoming'] });
      closeModal();
      toast.success('Termin aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const deleteMutation = useMutation({
    mutationFn: calendarApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendarUpcoming'] });
      toast.success('Termin gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  // Event handlers
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const openCreateModal = (date?: Date) => {
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setLocation('');
    const d = date || new Date();
    setStartDate(d.toISOString().split('T')[0]);
    setStartTime('12:00');
    setEndDate('');
    setEndTime('');
    setIsAllDay(false);
    setCategory('GENERAL');
    setColor('#3b82f6');
    setSelectedRoles([]);
    setSelectedEmployees([]);
    setReminderMinutes(0);
    setShowModal(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || '');
    setLocation(event.location || '');
    const start = new Date(event.startDate);
    setStartDate(start.toISOString().split('T')[0]);
    setStartTime(formatTime(start));
    if (event.endDate) {
      const end = new Date(event.endDate);
      setEndDate(end.toISOString().split('T')[0]);
      setEndTime(formatTime(end));
    } else {
      setEndDate('');
      setEndTime('');
    }
    setIsAllDay(event.isAllDay);
    setCategory(event.category);
    setColor(event.color);
    setSelectedRoles(event.discordRoleIds ? JSON.parse(event.discordRoleIds) : []);
    setSelectedEmployees(event.notifyEmployeeIds ? JSON.parse(event.notifyEmployeeIds) : []);
    setReminderMinutes(event.reminderMinutes || 0);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEvent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) {
      toast.error('Titel und Startdatum sind erforderlich');
      return;
    }

    const startDateTime = isAllDay
      ? new Date(startDate + 'T00:00:00')
      : new Date(startDate + 'T' + (startTime || '00:00'));

    const endDateTime = endDate
      ? (isAllDay
          ? new Date(endDate + 'T23:59:59')
          : new Date(endDate + 'T' + (endTime || '23:59')))
      : undefined;

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime?.toISOString(),
      isAllDay,
      color,
      category,
      discordRoleIds: selectedRoles.length > 0 ? selectedRoles : undefined,
      notifyEmployeeIds: selectedEmployees.length > 0 ? selectedEmployees : undefined,
      reminderMinutes: reminderMinutes > 0 ? reminderMinutes : undefined,
    };

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return isSameDay(eventDate, date);
    });
  };

  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-slate-800 to-purple-600/20 border border-slate-700/50 p-6">
        <div className="absolute inset-0 bg-grid-white/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl backdrop-blur-sm border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <CalendarIcon className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Kalender</h1>
              <p className="text-slate-400 mt-0.5">Termine und Events verwalten</p>
            </div>
          </div>
          <button
            onClick={() => openCreateModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neuer Termin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-3 card">
          {/* Month Navigation */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-slate-400" />
              </button>
              <h2 className="text-lg font-semibold text-white min-w-[180px] text-center">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="text-sm text-primary-400 hover:text-primary-300 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Heute
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-700">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-medium text-slate-400 uppercase"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const isCurrentMonth = day.getMonth() === month;
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const dayEvents = getEventsForDay(day);

              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  onDoubleClick={() => openCreateModal(day)}
                  className={`min-h-[100px] p-2 border-r border-b border-slate-700/50 cursor-pointer transition-colors ${
                    !isCurrentMonth ? 'bg-slate-800/30' : 'hover:bg-slate-700/30'
                  } ${isSelected ? 'bg-primary-500/10' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-primary-500 text-white'
                          : isCurrentMonth
                            ? 'text-slate-300'
                            : 'text-slate-600'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(event);
                        }}
                        className="px-1.5 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: event.color + '40', color: event.color }}
                      >
                        {!event.isAllDay && (
                          <span className="font-medium mr-1">
                            {formatTime(new Date(event.startDate))}
                          </span>
                        )}
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-slate-500 pl-1">
                        +{dayEvents.length - 3} weitere
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: Selected Day Details */}
        <div className="card h-fit">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">
              {selectedDate
                ? formatDate(selectedDate)
                : formatDate(today)}
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {getEventsForDay(selectedDate || today).length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                Keine Termine an diesem Tag
              </p>
            ) : (
              getEventsForDay(selectedDate || today).map((event) => (
                <div
                  key={event.id}
                  className="bg-slate-700/30 rounded-lg p-3 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: event.color }}
                        />
                        <span className="font-medium text-white text-sm truncate">
                          {event.title}
                        </span>
                      </div>
                      {!event.isAllDay && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          {formatTime(new Date(event.startDate))}
                          {event.endDate && (
                            <span> - {formatTime(new Date(event.endDate))}</span>
                          )}
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </div>
                      )}
                      {event.discordRoleIds && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                          <Bell className="h-3 w-3" />
                          DC-Benachrichtigung
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(event)}
                        className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-white"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Termin löschen',
                            message: `Möchtest du "${event.title}" wirklich löschen?`,
                            onConfirm: () => deleteMutation.mutate(event.id),
                          })
                        }
                        className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => openCreateModal(selectedDate || today)}
              className="w-full py-2 text-sm text-primary-400 hover:text-primary-300 hover:bg-slate-700/30 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Termin hinzufügen
            </button>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-lg mx-4 border border-slate-700/50 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {editingEvent ? 'Termin bearbeiten' : 'Neuer Termin'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-slate-700 rounded"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="label">Titel *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="Titel des Termins"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">Beschreibung</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input h-20 resize-none"
                  placeholder="Optionale Beschreibung..."
                />
              </div>

              {/* Location */}
              <div>
                <label className="label">Ort</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="input"
                  placeholder="z.B. Besprechungsraum"
                />
              </div>

              {/* All Day Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAllDay(!isAllDay)}
                  className={`w-10 h-6 rounded-full transition-colors ${
                    isAllDay ? 'bg-primary-500' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      isAllDay ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-300">Ganztägig</span>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Startdatum *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                {!isAllDay && (
                  <div>
                    <label className="label">Startzeit</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="input"
                    />
                  </div>
                )}
                <div>
                  <label className="label">Enddatum</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input"
                  />
                </div>
                {!isAllDay && (
                  <div>
                    <label className="label">Endzeit</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="input"
                    />
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="label">Kategorie</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setCategory(cat.value);
                        setColor(cat.color);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        category === cat.value
                          ? 'ring-2 ring-offset-2 ring-offset-slate-800'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: cat.color + '30',
                        color: cat.color,
                        ...(category === cat.value ? { ringColor: cat.color } : {}),
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discord Roles */}
              <div>
                <label className="label flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Discord-Rollen benachrichtigen
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-700/30 rounded-lg">
                  {discordRoles.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2 w-full text-center">
                      Keine Discord-Rollen verfügbar
                    </p>
                  ) : (
                    discordRoles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleRole(role.id)}
                        className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                          selectedRoles.includes(role.id)
                            ? 'bg-primary-600/30 text-primary-400 border border-primary-500'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                      >
                        {selectedRoles.includes(role.id) && <Check className="h-3 w-3" />}
                        {role.name.replace('»', '').trim()}
                      </button>
                    ))
                  )}
                </div>
                {selectedRoles.length > 0 && (
                  <p className="text-xs text-primary-400 mt-1">
                    {selectedRoles.length} Rolle(n) ausgewählt
                  </p>
                )}
              </div>

              {/* Mitarbeiter benachrichtigen */}
              <div>
                <label className="label flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Mitarbeiter benachrichtigen
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-700/30 rounded-lg">
                  {employees.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2 w-full text-center">
                      Keine Mitarbeiter verfügbar
                    </p>
                  ) : (
                    employees.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => toggleEmployee(emp.id)}
                        className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                          selectedEmployees.includes(emp.id)
                            ? 'bg-green-600/30 text-green-400 border border-green-500'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                      >
                        {selectedEmployees.includes(emp.id) && <Check className="h-3 w-3" />}
                        {emp.user.displayName || emp.user.username}
                      </button>
                    ))
                  )}
                </div>
                {selectedEmployees.length > 0 && (
                  <p className="text-xs text-green-400 mt-1">
                    {selectedEmployees.length} Mitarbeiter ausgewählt
                  </p>
                )}
              </div>

              {/* Reminder */}
              {(selectedRoles.length > 0 || selectedEmployees.length > 0) && (
                <div>
                  <label className="label flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Erinnerung
                  </label>
                  <select
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(parseInt(e.target.value))}
                    className="input"
                  >
                    {REMINDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={closeModal} className="btn-ghost">
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Speichern...'
                    : 'Speichern'}
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
        confirmText="Löschen"
        variant="danger"
      />
    </div>
  );
}
