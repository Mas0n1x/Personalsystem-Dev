import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  footer?: ReactNode;
  variant?: 'default' | 'danger' | 'success';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  variant = 'default',
}: ModalProps) {
  // ESC-Taste zum Schließen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
  };

  const variantClasses = {
    default: '',
    danger: 'border-red-900/50 shadow-red-900/20',
    success: 'border-green-900/50 shadow-green-900/20',
  };

  const titleClasses = {
    default: 'text-white',
    danger: 'text-red-400',
    success: 'text-green-400',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={clsx('modal animate-slide-up', sizeClasses[size], variantClasses[variant])}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 className={clsx('text-lg font-semibold', titleClasses[variant])}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
