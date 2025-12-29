import clsx from 'clsx';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'gray';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'badge-primary',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  gray: 'badge-gray',
};

export default function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span className={clsx(variantClasses[variant], className)}>
      {children}
    </span>
  );
}

// Helper für Status-Badges
export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeVariant> = {
    // Employee Status
    ACTIVE: 'success',
    INACTIVE: 'gray',
    SUSPENDED: 'danger',
    ON_LEAVE: 'warning',
    TERMINATED: 'danger',

    // Application Status
    PENDING: 'warning',
    INTERVIEW_SCHEDULED: 'primary',
    INTERVIEW_COMPLETED: 'primary',
    ACCEPTED: 'success',
    REJECTED: 'danger',
    WITHDRAWN: 'gray',

    // Training Status
    SCHEDULED: 'primary',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'gray',

    // Evidence Status
    IN_STORAGE: 'primary',
    CHECKED_OUT: 'warning',
    RELEASED: 'success',
    DESTROYED: 'danger',

    // Robbery Status
    OPEN: 'danger',
    INVESTIGATING: 'warning',
    SOLVED: 'success',
    CLOSED: 'gray',

    // Payment/Absence Status
    APPROVED: 'success',
    PAID: 'success',

    // Priority
    LOW: 'gray',
    NORMAL: 'primary',
    HIGH: 'warning',
    URGENT: 'danger',
  };

  const labels: Record<string, string> = {
    ACTIVE: 'Aktiv',
    INACTIVE: 'Inaktiv',
    SUSPENDED: 'Suspendiert',
    ON_LEAVE: 'Abwesend',
    TERMINATED: 'Entlassen',
    PENDING: 'Ausstehend',
    INTERVIEW_SCHEDULED: 'Interview geplant',
    INTERVIEW_COMPLETED: 'Interview abgeschlossen',
    ACCEPTED: 'Angenommen',
    REJECTED: 'Abgelehnt',
    WITHDRAWN: 'Zurückgezogen',
    SCHEDULED: 'Geplant',
    IN_PROGRESS: 'Läuft',
    COMPLETED: 'Abgeschlossen',
    CANCELLED: 'Abgebrochen',
    IN_STORAGE: 'Eingelagert',
    CHECKED_OUT: 'Ausgeliehen',
    RELEASED: 'Freigegeben',
    DESTROYED: 'Vernichtet',
    OPEN: 'Offen',
    INVESTIGATING: 'In Ermittlung',
    SOLVED: 'Gelöst',
    CLOSED: 'Geschlossen',
    APPROVED: 'Genehmigt',
    PAID: 'Bezahlt',
    LOW: 'Niedrig',
    NORMAL: 'Normal',
    HIGH: 'Hoch',
    URGENT: 'Dringend',
  };

  return (
    <Badge variant={variants[status] || 'gray'}>
      {labels[status] || status}
    </Badge>
  );
}
