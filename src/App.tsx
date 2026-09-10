import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppointmentsPage from './pages/AppointmentsPage';
import { Dashboard } from './pages/Dashboard';
import AyahPage from './pages/AyahPage';
import AppointmentSummary from './pages/AppointmentSummary';
import TeleconsultPage from './pages/TeleconsultPage';
import { Login } from './pages/Login';
import { Join } from './pages/Join';
import { Register } from './pages/Register';
import { CaregiverDashboard } from './components/caregiver/CaregiverDashboard';
import { CaregiverRoute } from './components/CaregiverRoute';
import { CaregiverLayout } from './components/CaregiverLayout';
import { CaregiverPatientsPage } from './pages/caregiver/CaregiverPatientsPage';
import { CaregiverPatientDetailPage } from './pages/caregiver/CaregiverPatientDetailPage';
import { CaregiverProfilePage } from './pages/caregiver/CaregiverProfilePage';
import { CaregiverSupportPage } from './pages/caregiver/CaregiverSupportPage';
import { CaregiverSharePage } from './pages/caregiver/CaregiverSharePage';
import { PatientProfile } from './pages/PatientProfile';
import { PatientFullDetailsPage } from './pages/PatientFullDetailsPage';
import { Patients } from './pages/Patients';
import DelegateAccept from './pages/DelegateAccept';
import ProfessionalProfile from './pages/Profile';
import PracticeSettingsPage from './pages/PracticeSettingsPage';
import PracticeCalendarPage from './pages/PracticeCalendarPage';
import ShareAnixi from './pages/ShareAnixi';
import ChangePassword from './pages/ChangePassword';
import Support from './pages/Support';
import DeleteAccount from './pages/DeleteAccount';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import { DoctorOnboardingPage } from './pages/DoctorOnboardingPage';
import { AccountUnderReviewPage } from './pages/AccountUnderReviewPage';
import ClinicSetupPage from './pages/ClinicSetupPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
import CaregiverOnboardingPage from './pages/CaregiverOnboardingPage';
import { ClinicAdminLayout } from './components/ClinicAdminLayout';
import { ClinicAdminRoute } from './components/ClinicAdminRoute';
import ClinicAdminDashboard from './pages/clinic/ClinicAdminDashboard';
import ClinicAdminTeamPage from './pages/clinic/ClinicAdminTeamPage';
import ClinicAdminPatientsPage from './pages/clinic/ClinicAdminPatientsPage';
import ClinicAdminSettingsPage from './pages/clinic/ClinicAdminSettingsPage';
import ClinicAdminSchedulePage from './pages/clinic/ClinicAdminSchedulePage';
import ClinicAdminInvoicesPage from './pages/clinic/ClinicAdminInvoicesPage';
import ClinicAdminClaimsPage from './pages/clinic/ClinicAdminClaimsPage';
import ClinicAdminQueuePage from './pages/clinic/ClinicAdminQueuePage';
import ClinicAdminRoomsPage from './pages/clinic/ClinicAdminRoomsPage';
import ClinicAdminReportsPage from './pages/clinic/ClinicAdminReportsPage';
import ClinicAdminAuditLogPage from './pages/clinic/ClinicAdminAuditLogPage';
import EmployerDashboardPage from './pages/employer/EmployerDashboardPage';
import { EmployerRoute } from './components/EmployerRoute';
import {
  AnalyticsPage,
  HealthMonitorPage,
  MedicalRecordsPage,
  MessagesPage,
  NotificationsPage,
} from './pages/V2FeaturePages';
import MoodCheckerPage from './pages/MoodCheckerPage';
import AdherenceCalendarPage from './pages/AdherenceCalendarPage';
import AdherenceLogsPage from './pages/AdherenceLogsPage';
import AdherenceDailyPage from './pages/AdherenceDailyPage';
import VitalsHistoryPage from './pages/VitalsHistoryPage';
import WearableDataPage from './pages/WearableDataPage';
import PostConsultPage from './pages/PostConsultPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceCreate from './pages/InvoiceCreate';
import InvoiceDetails from './pages/InvoiceDetails';
import PrintDocumentsPage from './pages/PrintDocumentsPage';
const queryClient = new QueryClient();

const SignUpRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const target = ref
    ? `/register?role=patient&ref=${encodeURIComponent(ref)}`
    : '/register?role=patient';
  return <Navigate to={target} replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/join" element={<Join />} />
          <Route path="/join/invite" element={<InviteAcceptPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/register/caregiver"
            element={<Navigate to="/register?role=caregiver&path=caregiver" replace />}
          />
          <Route path="/sign-up" element={<SignUpRedirect />} />
          <Route path="/delegate/accept" element={<DelegateAccept />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/clinic-setup"
            element={
              <ProtectedRoute>
                <ClinicSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <DoctorOnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account-review"
            element={
              <ProtectedRoute>
                <AccountUnderReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clinic"
            element={
              <ProtectedRoute>
                <ClinicAdminRoute>
                  <ClinicAdminLayout />
                </ClinicAdminRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<ClinicAdminDashboard />} />
            <Route path="team" element={<ClinicAdminTeamPage />} />
            <Route path="patients" element={<ClinicAdminPatientsPage />} />
            <Route path="schedule" element={<ClinicAdminSchedulePage />} />
            <Route path="invoices" element={<ClinicAdminInvoicesPage />} />
            <Route path="claims" element={<ClinicAdminClaimsPage />} />
            <Route path="queue" element={<ClinicAdminQueuePage />} />
            <Route path="rooms" element={<ClinicAdminRoomsPage />} />
            <Route path="reports" element={<ClinicAdminReportsPage />} />
            <Route path="audit" element={<ClinicAdminAuditLogPage />} />
            <Route path="appointments" element={<Navigate to="/clinic/schedule" replace />} />
            <Route path="calendar" element={<Navigate to="/clinic/schedule" replace />} />
            <Route path="settings" element={<ClinicAdminSettingsPage />} />
            <Route path="support" element={<Support />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="delete-account" element={<DeleteAccount />} />
          </Route>
          <Route
            path="/employer"
            element={
              <EmployerRoute>
                <EmployerDashboardPage />
              </EmployerRoute>
            }
          />
          <Route
            path="/caregiver/onboarding"
            element={
              <CaregiverRoute skipOnboardingCheck>
                <CaregiverOnboardingPage />
              </CaregiverRoute>
            }
          />
          <Route
            path="/caregiver"
            element={
              <CaregiverRoute>
                <CaregiverLayout />
              </CaregiverRoute>
            }
          >
            <Route index element={<CaregiverDashboard />} />
            <Route path="patients" element={<CaregiverPatientsPage />} />
            <Route path="patients/:patientId" element={<CaregiverPatientDetailPage />} />
            <Route path="profile" element={<CaregiverProfilePage />} />
            <Route path="support" element={<CaregiverSupportPage />} />
            <Route path="share" element={<CaregiverSharePage />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="delete-account" element={<DeleteAccount />} />
          </Route>
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/onboarding" element={<DoctorOnboardingPage />} />
                    <Route path="/account-review" element={<AccountUnderReviewPage />} />
                    <Route path="/ayah" element={<AyahPage />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/patient-list" element={<Navigate to="/patients" replace />} />
                    <Route path="/patient-profile/:patientId" element={<PatientProfile />} />
                    <Route path="/patient-profile/:patientId/details" element={<PatientFullDetailsPage />} />
                    <Route path="/patient-profile/:patientId/mood-checker" element={<MoodCheckerPage />} />
                    <Route path="/patient-profile/:patientId/adherence-calendar" element={<AdherenceCalendarPage />} />
                    <Route path="/patient-profile/:patientId/adherence-logs" element={<AdherenceLogsPage />} />
                    <Route path="/patient-profile/:patientId/adherence-daily/:date" element={<AdherenceDailyPage />} />
                    <Route path="/patient-profile/:patientId/vitals-history" element={<VitalsHistoryPage />} />
                    <Route path="/patient-profile/:patientId/wearable" element={<WearableDataPage />} />
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/appointments" element={<AppointmentsPage />} />
                    <Route path="/appointments/:appointmentId" element={<AppointmentSummary />} />
                    <Route path="/appointments/:appointmentId/post-consult" element={<PostConsultPage />} />
                    <Route path="/teleconsult/:appointmentId" element={<TeleconsultPage />} />
                    <Route path="/medical-records" element={<MedicalRecordsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/messages" element={<MessagesPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/health-monitor" element={<HealthMonitorPage />} />
                    <Route path="/invoices" element={<InvoicesPage />} />
                    <Route path="/invoices/new/:appointmentId" element={<InvoiceCreate />} />
                    <Route path="/invoices/:invoiceId" element={<InvoiceDetails />} />
                    <Route path="/appointments/:appointmentId/print-docs" element={<PrintDocumentsPage />} />
                    <Route path="/professional-profile" element={<ProfessionalProfile />} />
                    <Route path="/practice-settings" element={<PracticeSettingsPage />} />
                    <Route path="/practice-calendar" element={<PracticeCalendarPage />} />
                    <Route path="/share-anixi" element={<ShareAnixi />} />
                    <Route path="/change-password" element={<ChangePassword />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/delete-account" element={<DeleteAccount />} />
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
