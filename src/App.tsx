import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { auth } from './lib/firebase';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppointmentsPage from './pages/AppointmentsPage';
import AppointmentDebug from './pages/AppointmentDebug';
import FirestoreInspector from './pages/FirestoreInspector';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { PatientList } from './pages/PatientList';
import { PatientProfile } from './pages/PatientProfile';
import { Patients } from './pages/Patients';
import { DoctorSearch } from './pages/DoctorSearch';
import ProfessionalProfile from './pages/Profile';
import PracticeSettingsPage from './pages/PracticeSettingsPage';
import PracticeCalendarPage from './pages/PracticeCalendarPage';
import ShareAnixi from './pages/ShareAnixi';
import ChangePassword from './pages/ChangePassword';
import Support from './pages/Support';
import DeleteAccount from './pages/DeleteAccount';
import MoodCheckerPage from './pages/MoodCheckerPage';
import AdherenceCalendarPage from './pages/AdherenceCalendarPage';
import AdherenceLogsPage from './pages/AdherenceLogsPage';
import AdherenceDailyPage from './pages/AdherenceDailyPage';
import VitalsHistoryPage from './pages/VitalsHistoryPage';
const queryClient = new QueryClient();

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

if (typeof window !== 'undefined') {
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

    const { getDoctorSharingRequests } = await import('./services/patientManagementService');
    
    const requests = await getDoctorSharingRequests(doctorId);
    
    requests.forEach((req, idx) => {
      
      if (req.patientInfo) {
      } else {
      }
    });

  } catch (error) {
    ;
  }
};

if (typeof window !== 'undefined') {
  (window as any).checkPatientFields = checkPatientFields;
  (window as any).debugSharingRequests = debugSharingRequests;
  (window as any).debugSharingRequestsData = debugSharingRequestsData;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/patient-list" element={<PatientList />} />
                    <Route path="/patient-profile/:patientId" element={<PatientProfile />} />
                    <Route path="/patient-profile/:patientId/mood-checker" element={<MoodCheckerPage />} />
                    <Route path="/patient-profile/:patientId/adherence-calendar" element={<AdherenceCalendarPage />} />
                    <Route path="/patient-profile/:patientId/adherence-logs" element={<AdherenceLogsPage />} />
                    <Route path="/patient-profile/:patientId/adherence-daily/:date" element={<AdherenceDailyPage />} />
                    <Route path="/patient-profile/:patientId/vitals-history" element={<VitalsHistoryPage />} />
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/find-doctor" element={<DoctorSearch />} />
                    <Route path="/appointments" element={<AppointmentsPage />} />
                    <Route path="/debug/appointments" element={<AppointmentDebug />} />
                    <Route path="/debug/firestore" element={<FirestoreInspector />} />
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
