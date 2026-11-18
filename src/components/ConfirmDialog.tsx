import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  secondaryActionLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onSecondaryAction?: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  secondaryActionLabel,
  danger = false,
  onConfirm,
  onSecondaryAction,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#191F19] border border-[#2d382d] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                danger ? 'bg-red-500/15 text-red-400' : 'bg-[#B7FF00]/15 text-[#B7FF00]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-white leading-snug">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-xl text-[#A0A0A0] hover:text-white cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-[#A0A0A0] leading-relaxed">{description}</p>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#080B08] border border-[#2d382d] text-sm font-medium text-white hover:bg-[#111711] transition-colors whitespace-nowrap cursor-pointer"
          >
            {cancelLabel}
          </button>
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#263026] text-sm font-semibold text-white hover:bg-[#313e31] transition-colors whitespace-nowrap cursor-pointer"
            >
              {secondaryActionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
              danger
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-[#B7FF00] text-black hover:bg-[#c8ff33]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
