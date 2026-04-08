import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { useAuth } from '../hooks/useAuth';
import { getDashboardStats, getDoctorPatients } from '../services/doctorService';
import { DashboardStats, Patient } from '../types';

type FilterType = 'all' | 'total' | 'stable' | 'warning' | 'inactive';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      console.log('Dashboard: useEffect triggered, user:', user);
      if (!user) {
        console.log('Dashboard: user is null or undefined');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Dashboard: Fetching dashboard data for user:', user.id);
        
        // Fetch patients and stats in parallel
        const [patientsData, dashboardStats] = await Promise.all([
          getDoctorPatients(user.id),
          getDashboardStats(user.id),
        ]);

        console.log('Dashboard: Received', patientsData.length, 'patients and stats:', dashboardStats);
        
        setPatients(patientsData);
        setStats(dashboardStats);
        
        // Apply initial filter
        applyFilter(patientsData, 'all', dashboardStats);
      } catch (err) {
        console.error('Dashboard: Error fetching data:', err);
        setError('Failed to load dashboard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Apply filter logic
  const applyFilter = (allPatients: Patient[], filterType: FilterType, stats: DashboardStats) => {
    console.log(`Dashboard: Applying filter: ${filterType}`);
    
    let filtered: Patient[] = [];
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    switch (filterType) {
      case 'total':
        filtered = allPatients;
        console.log(`   → Showing all ${filtered.length} patients`);
        break;

      case 'stable':
        filtered = allPatients.filter((patient) => {
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          return lastActive >= fiveDaysAgo;
        });
        console.log(`   → Showing ${filtered.length} stable patients`);
        break;

      case 'warning':
        filtered = allPatients.filter((patient) => {
          // For now, warning patients are those who haven't been added to stable/inactive
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          // In production: check medication logs and vital signs
          return false; // Placeholder for actual warning logic
        });
        console.log(`   → Showing ${filtered.length} patients requiring attention`);
        break;

      case 'inactive':
        filtered = allPatients.filter((patient) => {
          const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
          return lastActive < fiveDaysAgo;
        });
        console.log(`   → Showing ${filtered.length} inactive patients`);
        break;

      case 'all':
      default:
        filtered = allPatients;
        console.log(`   → Showing all ${filtered.length} patients`);
        break;
    }

    setFilteredPatients(filtered);
    setActiveFilter(filterType);
  };

  const handleCardClick = (filter: FilterType) => {
    
    const filterParam = filter === 'all' ? 'total' : filter;
    navigate(`/patient-list?filter=${filterParam}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading dashboard...</div>
          <div className="mt-2 text-sm text-gray-500">Fetching your patient data</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert type="error" title="Error Loading Dashboard">
          {error}
        </Alert>
      </div>
    );
  }

  const hasPatients = stats && stats.totalPatients > 0;

  return (
    <div className="min-h-screen bg-anixi-beige">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#425950] mb-2">Medical Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card variant="elevated" className="cursor-pointer hover:shadow-xl" onClick={() => handleCardClick('total')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm font-semibold tracking-wide uppercase">Total Patients</span>
                <span className="text-2xl">👥</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#425950] mb-2">{stats?.totalPatients || 0}</div>
              <p className="text-xs text-gray-500">All active patients</p>
            </CardContent>
          </Card>

          <Card variant="elevated" className="cursor-pointer hover:shadow-xl" onClick={() => handleCardClick('warning')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm font-semibold tracking-wide uppercase">Action Required</span>
                <span className="text-2xl">⚠️</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-red-600 mb-2">{stats?.warningPatients || 0}</div>
              <p className="text-xs text-gray-500">Requiring attention</p>
            </CardContent>
          </Card>

          <Card variant="elevated" className="cursor-pointer hover:shadow-xl" onClick={() => handleCardClick('stable')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm font-semibold tracking-wide uppercase">Stable Status</span>
                <span className="text-2xl">✅</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 mb-2">{stats?.stablePatients || 0}</div>
              <p className="text-xs text-gray-500">Doing well</p>
            </CardContent>
          </Card>

          <Card variant="elevated" className="cursor-pointer hover:shadow-xl" onClick={() => handleCardClick('inactive')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm font-semibold tracking-wide uppercase">Inactive</span>
                <span className="text-2xl">🔔</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-600 mb-2">{stats?.inactivePatients || 0}</div>
              <p className="text-xs text-gray-500">&gt; 5 days inactive</p>
            </CardContent>
          </Card>
        </div>

        {hasPatients && (
          <Card variant="elevated">
            <CardHeader>
              <h2 className="text-2xl font-bold text-[#425950]">
                {activeFilter === 'total' && 'All Patients'}
                {activeFilter === 'stable' && 'Stable Patients'}
                {activeFilter === 'warning' && 'Patients Requiring Attention'}
                {activeFilter === 'inactive' && 'Inactive Patients'}
                {activeFilter === 'all' && 'Your Patients'}
              </h2>
            </CardHeader>
            <CardContent>
              {filteredPatients.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No patients in this category</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200 bg-gray-50">
                        <th className="px-6 py-4 text-left text-sm font-bold text-[#425950] tracking-wide">Patient Name</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-[#425950] tracking-wide">Email</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-[#425950] tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((patient) => {
                        const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
                        const daysInactive = Math.floor(
                          (new Date().getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
                        );

                        return (
                          <tr key={patient.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{patient.displayName}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{patient.email}</td>
                            <td className="px-6 py-4 text-sm">
                              {daysInactive > 5 ? (
                                <Badge variant="warning" size="sm">Inactive</Badge>
                              ) : (
                                <Badge variant="success" size="sm">Active</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!hasPatients && (
          <Alert type="info" title="No Patients Yet">
            You don't have any patients linked to your account yet. Patients will appear here once they approve your access. Your ID: {user?.id}
          </Alert>
        )}
      </div>
    </div>
  );
};
