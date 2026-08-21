import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { auth } from './lib/firebase';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppointmentsPage from './pages/AppointmentsPage';
import AppointmentDebug from './pages/AppointmentDebug';
import FirestoreInspector from './pages/FirestoreInspector';
import { Dashboard } from './pages/Dashboard';
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
import { ClinicAdminLayout } from './components/ClinicAdminLayout';
import { ClinicAdminRoute } from './components/ClinicAdminRoute';
import ClinicAdminDashboard from './pages/clinic/ClinicAdminDashboard';
import ClinicAdminTeamPage from './pages/clinic/ClinicAdminTeamPage';
import ClinicAdminPatientsPage from './pages/clinic/ClinicAdminPatientsPage';
import ClinicAdminSettingsPage from './pages/clinic/ClinicAdminSettingsPage';
import ClinicAdminSchedulePage from './pages/clinic/ClinicAdminSchedulePage';
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

const checkPatientFields = async () => {
  try {

    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    const doctorId = currentUser.uid;

    const approvedRef = collection(db, 'Users', doctorId, 'approved_patients');
    const approvedSnapshot = await getDocs(approvedRef);


    for (const approvedDoc of approvedSnapshot.docs) {
      const approvedData = approvedDoc.data();
      const patientId = approvedData.patientId || approvedDoc.id;

      const patientRef = doc(db, 'patients', patientId);
      const patientSnap = await getDoc(patientRef);

      if (patientSnap.exists()) {
      } else {
      }
    }

  } catch (error) {
    ;
  }
};

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).checkPatientFields = checkPatientFields;
}

const debugSharingRequests = async () => {
  try {

    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    const doctorId = currentUser.uid;

    const sharingRef = collection(db, 'Users', doctorId, 'incoming_sharing_requests');
    const sharingSnapshot = await getDocs(sharingRef);

    sharingSnapshot.docs.forEach((doc, idx) => {
    });

    const patientsRef = collection(db, 'patients');
    const patientsSnapshot = await getDocs(patientsRef);

    patientsSnapshot.docs.forEach((doc, idx) => {
    });

    const patientIdsFromRequests = sharingSnapshot.docs.map(doc => doc.data().patientId);
    const patientIdsFromPatients = patientsSnapshot.docs.map(doc => doc.id);

    patientIdsFromRequests.forEach(requestPatientId => {
      const exists = patientIdsFromPatients.includes(requestPatientId);
      
      if (exists) {
        const patientDoc = patientsSnapshot.docs.find(doc => doc.id === requestPatientId);
        if (patientDoc) {
        }
      } else {
      }
    });

  } catch (error) {
    ;
  }
};

const debugSharingRequestsData = async () => {
  try {

    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    const doctorId = currentUser.uid;

    const { getIncomingSharingRequests } = await import('./services/sharing');
    const requests = await getIncomingSharingRequests(doctorId);
    requests.forEach(() => {});

  } catch (error) {
    ;
  }
};

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).checkPatientFields = checkPatientFields;
  (window as any).debugSharingRequests = debugSharingRequests;
  (window as any).debugSharingRequestsData = debugSharingRequestsData;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/join" element={<Join />} />
          <Route path="/join/invite" element={<InviteAcceptPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
            <Route path="appointments" element={<Navigate to="/clinic/schedule" replace />} />
            <Route path="calendar" element={<Navigate to="/clinic/schedule" replace />} />
            <Route path="settings" element={<ClinicAdminSettingsPage />} />
            <Route path="support" element={<Support />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="delete-account" element={<DeleteAccount />} />
          </Route>
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
                    {process.env.NODE_ENV === 'development' && (
                      <>
                        <Route path="/debug/appointments" element={<AppointmentDebug />} />
                        <Route path="/debug/firestore" element={<FirestoreInspector />} />
                      </>
                    )}
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
