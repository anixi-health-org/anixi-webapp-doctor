import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdherenceCalendar } from '../components/AdherenceCalendar';
import { useAuth } from '../hooks/useAuth';
import { getDateString } from '../utils/dateFormatter';

export const AdherenceCalendarPage: React.FC = () => {
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
    <div className="px-4 py-6 sm:px-6 bg-anixi-beige min-h-screen">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/patient-profile/${patientId}`)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-anixi-green px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          ← Back to Patient Profile
        </button>
        <h1 className="font-heading text-2xl font-bold text-anixi-green">Adherence Calendar</h1>
        <p className="mt-1 text-sm text-gray-600">View medication adherence by date</p>

        <div className="mt-5">
          <AdherenceCalendar
            patientId={patientId}
            doctorId={user?.id}
            onDayClick={(date) => {
              navigate(`/patient-profile/${patientId}/adherence-daily/${getDateString(date)}`);
            }}
          />
        </div>
      </div>
    </div>
  );
};
export default AdherenceCalendarPage;
