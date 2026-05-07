import React from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose?: () => void;
}

const toneMap: Record<ToastType, string> = {
  success: 'bg-green-700 text-white',
  error: 'bg-[#7C2D12] text-white',
  warning: 'bg-amber-700 text-white',
  info: 'bg-[#45524D] text-white',
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,28rem)]">
      <div className={`rounded-xl px-4 py-3 shadow-xl flex items-start gap-3 ${toneMap[type]}`}>
        <div className="text-sm font-medium flex-1">{message}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-white/75 hover:text-white transition-colors text-sm"
            aria-label="Close notification"
          >
            x
          </button>
        )}
      </div>
    </div>
  );
};
