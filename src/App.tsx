import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppointmentsPage from './pages/AppointmentsPage';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { PatientList } from './pages/PatientList';
import { PatientProfile } from './pages/PatientProfile';
import { Patients } from './pages/Patients';
import { DoctorSearch } from './pages/DoctorSearch';
import ProfessionalProfile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import ShareAnixi from './pages/ShareAnixi';
import Support from './pages/Support';
import MoodCheckerPage from './pages/MoodCheckerPage';
import AdherenceCalendarPage from './pages/AdherenceCalendarPage';
import AdherenceLogsPage from './pages/AdherenceLogsPage';
import VitalsHistoryPage from './pages/VitalsHistoryPage';
import './utils/debugUtils'; // Debug utilities exposed to window
import './utils/requestDiagnostics'; // Request diagnostics exposed to window
import './utils/testTimestampConversion'; // Timestamp conversion tests

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/patient-list" element={<PatientList />} />
                    <Route path="/patient-profile/:patientId" element={<PatientProfile />} />
                    <Route path="/patient-profile/:patientId/mood-checker" element={<MoodCheckerPage />} />
                    <Route path="/patient-profile/:patientId/adherence-calendar" element={<AdherenceCalendarPage />} />
                    <Route path="/patient-profile/:patientId/adherence-logs" element={<AdherenceLogsPage />} />
                    <Route path="/patient-profile/:patientId/vitals-history" element={<VitalsHistoryPage />} />
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/find-doctor" element={<DoctorSearch />} />
                    <Route path="/appointments" element={<AppointmentsPage />} />
                    <Route path="/professional-profile" element={<ProfessionalProfile />} />
                    <Route path="/public-profile" element={<PublicProfile />} />
                    <Route path="/share-anixi" element={<ShareAnixi />} />
                    <Route path="/support" element={<Support />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
