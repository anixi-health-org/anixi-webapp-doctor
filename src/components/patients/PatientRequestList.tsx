import React, { useState } from 'react';
import { PatientRequest } from '../../services/patientManagementService';
import { calculateAge } from '../../services/patientManagementService';

interface PatientRequestListProps {
  requests: PatientRequest[];
  loading: boolean;
  onAccept: (requestId: string, patientId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

export const PatientRequestList: React.FC<PatientRequestListProps> = ({
  requests,
  loading,
  onAccept,
  onReject,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (requestId: string, patientId: string) => {
    try {
      setError(null);
      setLoadingId(requestId);
      await onAccept(requestId, patientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setError(null);
      setLoadingId(requestId);
      await onReject(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <svg
          className="w-16 h-16 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-lg font-medium">No pending patient requests</p>
        <p className="text-sm">New requests will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {requests.map((request) => {
        const patient = request.patientInfo;
        if (!patient) return null;

        const age = calculateAge(patient.dateOfBirth);
        const isProcessing = loadingId === request.id;

        return (
          <div
            key={request.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {patient.displayName}
                </h3>

                <div className="flex gap-6 text-sm text-gray-600 mb-4">
                  {age !== undefined && (
                    <div>
                      <span className="text-gray-500">Age:</span>
                      <span className="ml-2 font-medium">{age} years</span>
                    </div>
                  )}
                  {patient.gender && (
                    <div>
                      <span className="text-gray-500">Gender:</span>
                      <span className="ml-2 font-medium">
                        {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  🕐 Requested{' '}
                  {request.requestedAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleAccept(request.id, request.patientId)}
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isProcessing
                      ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                      </svg>
                      Processing
                    </span>
                  ) : (
                    '✅ Accept'
                  )}
                </button>

                <button
                  onClick={() => handleReject(request.id)}
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isProcessing
                      ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                      </svg>
                      Processing
                    </span>
                  ) : (
                    '❌ Reject'
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
