import { AlertTriangle, Trash2, Check, X, HelpCircle } from 'lucide-react';
import Modal from './Modal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const variantConfig = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
      modalVariant: 'danger' as const,
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
      modalVariant: 'default' as const,
    },
    info: {
      icon: HelpCircle,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
      modalVariant: 'default' as const,
    },
    success: {
      icon: Check,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      modalVariant: 'success' as const,
    },
  };

  const config = variantConfig[variant] || variantConfig.danger;
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      variant={config.modalVariant}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${config.buttonClass}`}
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Wird ausgeführt...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full ${config.iconBg}`}>
          <Icon className={`h-6 w-6 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-slate-300 whitespace-pre-line">{message}</p>
        </div>
      </div>
    </Modal>
  );
}

// Hook für einfache Verwendung
import { useState, useCallback } from 'react';

export interface UseConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export interface UseConfirmDialogReturn {
  isOpen: boolean;
  confirm: (options?: Partial<UseConfirmDialogOptions>) => Promise<boolean>;
  ConfirmDialogComponent: React.FC;
}

export function useConfirmDialog(defaultOptions: UseConfirmDialogOptions): UseConfirmDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((overrideOptions?: Partial<UseConfirmDialogOptions>): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions({ ...defaultOptions, ...overrideOptions });
      setResolveRef(() => resolve);
      setIsOpen(true);
    });
  }, [defaultOptions]);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(true);
    setResolveRef(null);
  }, [resolveRef]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(false);
    setResolveRef(null);
  }, [resolveRef]);

  const ConfirmDialogComponent: React.FC = useCallback(() => (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      {...options}
    />
  ), [isOpen, handleClose, handleConfirm, options]);

  return { isOpen, confirm, ConfirmDialogComponent };
}
