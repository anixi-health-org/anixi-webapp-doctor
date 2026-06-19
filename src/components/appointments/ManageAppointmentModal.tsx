import React, { useState } from 'react';
import { Appointment } from '../../types';
import { updateAppointment } from '../../services/appointmentService';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface Props {
  appointment: Appointment;
  onClose: () => void;
  onUpdated?: (updated: Partial<Appointment>) => void;
}

type ActionType = 'accept' | 'decline' | 'move' | 'cancel' | 'no_show' | 'invoice';

interface Action {
  id: ActionType;
  label: string;
  icon: string;
  description: string;
  color: 'success' | 'danger' | 'warning' | 'info' | 'secondary';
  handler: () => Promise<void>;
}

export const ManageAppointmentModal: React.FC<Props> = ({ appointment, onClose, onUpdated }) => {
  const { user } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const navigate = useNavigate();

  const getActionStyles = (color: string) => {
    const styles = {
      success: 'bg-green-50 border-green-200 hover:bg-green-100 text-green-900',
      danger: 'bg-red-50 border-red-200 hover:bg-red-100 text-red-900',
      warning: 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-900',
      info: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-900',
      secondary: 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-900',
    };
    return styles[color as keyof typeof styles] || styles.secondary;
  };

  const getIconStyles = (color: string) => {
    const styles = {
      success: 'bg-green-100 text-green-600',
      danger: 'bg-red-100 text-red-600',
      warning: 'bg-orange-100 text-orange-600',
      info: 'bg-blue-100 text-blue-600',
      secondary: 'bg-gray-100 text-gray-600',
    };
    return styles[color as keyof typeof styles] || styles.secondary;
  };

  const actions: Action[] = [
    {
      id: 'accept',
      label: 'Accept appointment',
      icon: '✓',
      description: 'Confirm the appointment',
      color: 'success',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'confirmed' });
        onUpdated?.({ status: 'confirmed' });
      },
    },
    {
      id: 'decline',
      label: 'Decline appointment',
      icon: '✕',
      description: 'Reject the appointment',
      color: 'danger',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'cancelled' });
        onUpdated?.({ status: 'cancelled' });
      },
    },
    {
      id: 'move',
      label: 'Move / reschedule',
      icon: '📅',
      description: 'Change date or time',
      color: 'info',
      handler: async () => {
        // Future implementation
      },
    },
    {
      id: 'cancel',
      label: 'Cancel',
      icon: '⊘',
      description: 'Cancel the appointment',
      color: 'warning',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'cancelled' });
        onUpdated?.({ status: 'cancelled' });
      },
    },
    {
      id: 'no_show',
      label: 'No-show',
      icon: '⊗',
      description: 'Mark as no-show',
      color: 'danger',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'no_show' });
        onUpdated?.({ status: 'no_show' });
      },
    },
    {
      id: 'invoice',
      label: 'Invoice',
      icon: '💰',
      description: 'Create invoice',
      color: 'secondary',
      handler: async () => {
        onClose();
        navigate(`/invoices/new/${appointment.id}`);
      },
    },
  ];

  const runAction = async (id: string) => {
    const a = actions.find((x) => x.id === id);
    if (!a) return;
    try {
      setLoadingAction(id);
      await a.handler();
    } catch (err) {
      console.error('Error running action:', err);
    } finally {
      setLoadingAction(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full md:w-[580px] mx-auto shadow-2xl animate-in fade-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 duration-300">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Manage appointment</h3>
              <p className="text-sm text-gray-600 mt-1.5">Choose an action for this appointment</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-500 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actions.map((act) => (
              <button
                key={act.id}
                onClick={() => runAction(act.id)}
                disabled={!!loadingAction}
                className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-200 p-4 text-left ${getActionStyles(
                  act.color
                )} ${
                  loadingAction && loadingAction !== act.id
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                } disabled:cursor-not-allowed`}
              >
                {/* Background gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10 flex items-start gap-3">
                  <div
                    className={`mt-1 flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold ${getIconStyles(
                      act.color
                    )}`}
                  >
                    {act.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-sm leading-tight">{act.label}</h4>
                      {loadingAction === act.id && (
                        <div className="flex-shrink-0">
                          <div className="animate-spin">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs opacity-75 mt-1 leading-tight">{act.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageAppointmentModal;
