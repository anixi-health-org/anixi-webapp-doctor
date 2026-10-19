import { XMarkIcon } from '@heroicons/react/24/outline';
import React, { useEffect } from 'react';
import { clinicButtonClasses } from './clinicButtonStyles';

type ClinicFormModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const ClinicFormModal: React.FC<ClinicFormModalProps> = ({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0E2340]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinic-form-modal-title"
        className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#e1e7ef] bg-white shadow-xl sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#eef2f6] px-5 py-4">
          <div>
            <h2 id="clinic-form-modal-title" className="text-lg font-semibold text-[#344256]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[#65758b]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={clinicButtonClasses('ghost', 'sm', 'shrink-0 !px-2')}
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#eef2f6] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ClinicFormModal;
