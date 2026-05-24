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

export const ManageAppointmentModal: React.FC<Props> = ({ appointment, onClose, onUpdated }) => {
  const { user } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const navigate = useNavigate();
  const actions: { id: string; label: string; handler: () => Promise<void> }[] = [
    {
      id: 'accept',
      label: 'Accept appointment',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'confirmed' });
        onUpdated?.({ status: 'confirmed' });
      },
    },
    {
      id: 'decline',
      label: 'Decline appointment',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'cancelled' });
        onUpdated?.({ status: 'cancelled' });
      },
    },
    {
      id: 'move',
      label: 'Move / reschedule',
      handler: async () => {


      },
    },
    {
      id: 'cancel',
      label: 'Cancel',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'cancelled' });
        onUpdated?.({ status: 'cancelled' });
      },
    },
    {
      id: 'no_show',
      label: 'No-show',
      handler: async () => {
        if (!user?.id) return;
        await updateAppointment(user.id, appointment.id, { status: 'no_show' });
        onUpdated?.({ status: 'no_show' });
      },
    },
    {
      id: 'invoice',
      label: 'Invoice',
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

    } finally {
      setLoadingAction(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white rounded-xl w-full md:w-[520px] mx-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">Manage appointment</h3>
            <p className="text-sm text-gray-600 mt-1">Choose an action for this appointment.</p>
          </div>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <div className="mt-6 grid gap-3">
          {actions.map((act) => (
            <button
              key={act.id}
              onClick={() => runAction(act.id)}
              disabled={!!loadingAction}
              className="w-full text-left px-4 py-3 rounded-lg border hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{act.label}</div>
                <div className="text-xs text-gray-500">{act.id === 'move' || act.id === 'invoice' ? '…' : ''}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManageAppointmentModal;
