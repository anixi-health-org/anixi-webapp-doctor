import React, { useState } from 'react';
import { Appointment } from '../../types';
import { formatTimestamp, formatTime } from '../../utils/dateFormatter';
import { usePatientInfo } from '../../hooks/usePatientInfo';

interface AppointmentDetailModalProps {
  appointment: Appointment;
  onClose: () => void;
  onStatusUpdate: (patientId: string, appointmentId: string, newStatus: Appointment['status']) => Promise<void>;
  isUpdating?: boolean;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  appointment,
  onClose,
  onStatusUpdate,
  isUpdating = false,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<Appointment['status']>(appointment.status);
  const [showStatusOptions, setShowStatusOptions] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  
  const { patientName, isLoading: patientLoading } = usePatientInfo(appointment.patientId);

  const handleStatusChange = async (newStatus: Appointment['status']) => {
    if (newStatus === appointment.status) {
      setShowStatusOptions(false);
      return;
    }

    try {
      setUpdateError(null);
      setUpdateSuccess(false);
      await onStatusUpdate(appointment.patientId, appointment.id, newStatus);
      setSelectedStatus(newStatus);
      setUpdateSuccess(true);
      setShowStatusOptions(false);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update appointment status';
      setUpdateError(errorMessage);
      console.error('Status update error:', error);
    }
  };

  const getStatusColor = (status: Appointment['status']): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const availableStatuses: Appointment['status'][] = ['scheduled', 'confirmed', 'completed', 'cancelled'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Appointment Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              {appointment.title && appointment.title !== 'Untitled' ? (
                appointment.title
              ) : (
                <span className="text-gray-400">
                  {patientLoading ? 'Loading...' : `Appointment with ${patientName}`}
                </span>
              )}
            </h3>
          </div>

          {updateSuccess && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">✓ Appointment status updated successfully</p>
            </div>
          )}

          {updateError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">✕ {updateError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">PATIENT</p>
                <p className="text-gray-900 font-medium">
                  {patientLoading ? (
                    <span className="text-gray-400 animate-pulse">Loading...</span>
                  ) : (
                    <>👤 {patientName}</>
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">APPOINTMENT TYPE</p>
                <p className="text-gray-900 font-medium capitalize">
                  {appointment.type}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">START TIME</p>
                <p className="text-gray-900 font-medium">
                  {formatTimestamp(appointment.startTime, 'long')}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">END TIME</p>
                <p className="text-gray-900 font-medium">
                  {formatTimestamp(appointment.endTime, 'long')}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">DURATION</p>
                <p className="text-gray-900 font-medium">
                  {Math.round((new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60000)} minutes
                </p>
              </div>
            </div>
          </div>

          {appointment.description && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">DESCRIPTION</p>
              <p className="text-gray-900 bg-gray-50 p-4 rounded-lg border border-gray-200">
                {appointment.description}
              </p>
            </div>
          )}

          {appointment.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">NOTES</p>
              <p className="text-gray-900 bg-gray-50 p-4 rounded-lg border border-gray-200">
                {appointment.notes}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <p className="font-semibold mb-1">CREATED AT</p>
              <p>{formatTimestamp(appointment.createdAt, 'long')}</p>
            </div>
            <div>
              <p className="font-semibold mb-1">UPDATED AT</p>
              <p>{formatTimestamp(appointment.updatedAt, 'long')}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-semibold text-gray-600 mb-3">CURRENT STATUS</p>
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-4 py-2 rounded-full font-semibold ${getStatusColor(selectedStatus)}`}>
                {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
              </span>
              {selectedStatus !== appointment.status && (
                <span className="text-sm text-amber-600 font-medium">(Changed, not yet saved)</span>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600">CHANGE STATUS TO:</p>
              <div className="grid grid-cols-2 gap-2">
                {availableStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={isUpdating}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      status === selectedStatus
                        ? 'ring-2 ring-blue-500 ' + getStatusColor(status)
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                  >
                    {isUpdating ? (
                      <>
                        <span className="inline-block animate-spin mr-2">⌛</span>
                        Saving...
                      </>
                    ) : (
                      status.charAt(0).toUpperCase() + status.slice(1)
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-medium hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
