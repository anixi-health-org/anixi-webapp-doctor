import React, { useState, useEffect } from 'react';
import { Patient } from '../../types';
import { getPatientStatus } from '../../utils/patientStatusUtils';

interface PatientListPanelProps {
  patients: Patient[];
  loading: boolean;
  error?: string | null;
  selectedPatientId?: string | null;
  onSelectPatient: (patient: Patient) => void;
  isVisible: boolean;
}

export const PatientListPanel: React.FC<PatientListPanelProps> = ({
  patients,
  loading,
  error,
  selectedPatientId,
  onSelectPatient,
  isVisible,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patientStatuses, setPatientStatuses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const calculateStatuses = async () => {
      const statusMap = new Map<string, string>();

      for (const patient of patients) {
        try {
          const status = await getPatientStatus(patient);
          statusMap.set(patient.id, status);
        } catch (err) {
          ;
          statusMap.set(patient.id, 'Stable'); 
        }
      }

      setPatientStatuses(statusMap);
    };

    if (patients.length > 0) {
      calculateStatuses();
    }
  }, [patients]);

  const filteredPatients = patients.filter((patient) =>
    (patient.displayName || patient.email)
      .toLowerCase()
      .includes(searchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isVisible) {
    return null;
  }

  const getPatientStatusDisplay = (patient: Patient): string => {
    return patientStatuses.get(patient.id) || 'Loading...';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Action Required':
        return 'bg-orange-100 text-orange-800';
      case 'Inactive':
        return 'bg-gray-100 text-gray-800';
      case 'Stable':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      {}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍 Search patients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
          {error}
        </div>
      )}

      {}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">Loading patients...</span>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="flex justify-center items-center py-8 text-gray-500">
          <p>No patients found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPatients.map((patient) => {
            const status = getPatientStatusDisplay(patient);
            return (
              <div
                key={patient.id}
                onClick={() => onSelectPatient(patient)}
                className={`
                  p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                  ${
                    selectedPatientId === patient.id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-full bg-[#425950] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(patient.displayName || patient.email)?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{patient.displayName || patient.email}</p>
                        <p className="text-sm text-gray-600 truncate">{patient.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getStatusColor(status)}`}>
                      {status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
