import React, { useEffect, useState } from 'react';
import { SharingRequest } from '../../types';
import { calculateAge } from '../../services/patientManagementService';

interface SharingRequestsListProps {
  requests: SharingRequest[];
  loading: boolean;
  doctorId: string;
  onAccept: (patientId: string, doctorId: string, requestId: string) => Promise<void>;
  onReject: (patientId: string, doctorId: string, requestId: string) => Promise<void>;
}

export const SharingRequestsList: React.FC<SharingRequestsListProps> = ({
  requests,
  loading,
  doctorId,
  onAccept,
  onReject,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupedRequests, setGroupedRequests] = useState<Map<string, SharingRequest[]>>(new Map());

  useEffect(() => {
    
    const pendingRequests = requests.filter(req => {
      return req.status === 'pending';
    });
    
    const grouped = new Map<string, SharingRequest[]>();
    pendingRequests.forEach((req) => {
      if (!grouped.has(req.patientId)) {
        grouped.set(req.patientId, []);
      }
      grouped.get(req.patientId)!.push(req);
    });
    setGroupedRequests(grouped);
  }, [requests]);

  const handleAccept = async (patientId: string, doctorId: string, requestId: string) => {
    try {
      setError(null);
      setLoadingId(requestId);
      await onAccept(patientId, doctorId, requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (patientId: string, doctorId: string, requestId: string) => {
    try {
      setError(null);
      setLoadingId(requestId);
      await onReject(patientId, doctorId, requestId);
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

  const pendingRequestsCount = groupedRequests.size;

  if (pendingRequestsCount === 0) {
    return null; 
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {Array.from(groupedRequests.entries()).map(([patientId, patientRequests]) => {
        const patient = patientRequests[0]?.patientInfo;
        
        
        if (!patient) {
          return (
            <div key={patientId} className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900">Patient</h4>
              <p className="text-sm text-gray-600">Patient details not available</p>
            </div>
          );
        }

        return (
          <div key={patientId} className="space-y-2">
            {patientRequests.map((request) => {
              const age = calculateAge(patient.dateOfBirth);
              
              return (
              <div
                key={request.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all flex items-center justify-between"
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    {patient.displayName || 'No Name'}
                  </h4>
                  
                  {}
                  <div className="flex gap-6 text-sm text-gray-600 mb-2">
                    {age !== null && age !== undefined && (
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
                  
                  {}
                  {patient.email && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 font-medium">{patient.email}</span>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-600">
                    📅 Request: {request.createdAt.toLocaleDateString()}
                  </p>
                  {request.reason && (
                    <p className="text-sm text-gray-600">
                      💬 {request.reason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    request.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : request.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                  }`}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </span>

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(patientId, doctorId, request.id)}
                        disabled={loadingId === request.id}
                        className="px-3 py-1 bg-green-500 text-white rounded font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {loadingId === request.id ? '...' : '✓ Accept'}
                      </button>
                      <button
                        onClick={() => handleReject(patientId, doctorId, request.id)}
                        disabled={loadingId === request.id}
                        className="px-3 py-1 bg-red-500 text-white rounded font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {loadingId === request.id ? '...' : '✗ Reject'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
            })}
          </div>
        );
      })}
    </div>
  );
};
