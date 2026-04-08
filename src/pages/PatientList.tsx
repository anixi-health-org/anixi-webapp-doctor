import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PatientCard } from '../components/PatientCard';
import { useAuth } from '../hooks/useAuth';
import { getDoctorPatients, getDashboardStats } from '../services/doctorService';
import { DashboardStats, Patient, PatientStatus } from '../types';

export const PatientList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const filterParam = (searchParams.get('filter') || 'total') as PatientStatus | 'total' | 'all';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const [patientsData, statsData] = await Promise.all([
          getDoctorPatients(user.id),
          getDashboardStats(user.id),
        ]);

        setPatients(patientsData);
        setStats(statsData);

        applyFilter(patientsData, filterParam, statsData);
      } catch (err) {
        console.error('Error fetching patients:', err);
        setError('Failed to load patients. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, filterParam]);

  const applyFilter = (allPatients: Patient[], filter: PatientStatus | 'total' | 'all', dashboardStats: DashboardStats) => {
    let filtered: Patient[] = [];
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'stable':
        filtered = allPatients.filter((patient) => {
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          return lastActive >= fiveDaysAgo;
        });
        break;

      case 'warning':
        filtered = allPatients.filter((patient) => {
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          return lastActive >= fiveDaysAgo && lastActive < new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        });
        break;

      case 'inactive':
        filtered = allPatients.filter((patient) => {
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          return lastActive < fiveDaysAgo;
        });
        break;

      case 'total':
      case 'all':
      default:
        filtered = allPatients;
        break;
    }

    setFilteredPatients(filtered);
  };

  const getPatientStatus = (patient: Patient): PatientStatus => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);

    if (lastActive < fiveDaysAgo) {
      return 'inactive';
    }
    return 'stable';
  };

  const getFilterLabel = () => {
    switch (filterParam) {
      case 'stable':
        return 'Stable Patients';
      case 'warning':
        return 'Patients Requiring Attention';
      case 'inactive':
        return 'Inactive Patients';
      case 'total':
      case 'all':
      default:
        return 'All Patients';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading patients...</div>
          <div className="mt-2 text-sm text-gray-500">Please wait</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-anixi-beige min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900">Error</h3>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-anixi-beige min-h-screen">
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{getFilterLabel()}</h1>
        <p className="mt-2 text-gray-600">
          Showing <span className="font-semibold">{filteredPatients.length}</span> {filteredPatients.length === 1 ? 'patient' : 'patients'}
        </p>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="p-8 bg-white border border-gray-200 rounded-lg text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No patients found</h3>
          <p className="text-gray-600">
            You currently have no {filterParam !== 'total' && filterParam !== 'all' ? filterParam : ''} patients.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              status={getPatientStatus(patient)}
              onClick={() => navigate(`/patient-profile/${patient.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
