import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AdherenceCalendar } from '../components/AdherenceCalendar';
import { useAuth } from '../hooks/useAuth';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { useNavigate } from 'react-router-dom';
export const AdherenceCalendarPage: React.FC = () => {
  const { navigateBack } = useNavigateWithFallback();
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  if (!patientId) {
    return (
      <div className="p-6 bg-anixi-beige min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">Patient ID not found</p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-6 bg-anixi-beige min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigateBack(`/patients`)}
            className="mb-4 px-4 py-2 bg-anixi-green text-white hover:opacity-90 rounded-lg transition-all"
          >
            ← Back to Patient Profile
          </button>
          <h1 className="text-3xl font-bold text-anixi-green">📅 Adherence Calendar</h1>
          <p className="mt-2 text-anixi-green">View medication adherence by date</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Medication Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <AdherenceCalendar
              patientId={patientId}
              doctorId={user?.id}
              onDayClick={(date) => {
                const day = date.toISOString().split('T')[0];
                navigate(`/patient-profile/${patientId}/adherence-daily/${day}`);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default AdherenceCalendarPage;
