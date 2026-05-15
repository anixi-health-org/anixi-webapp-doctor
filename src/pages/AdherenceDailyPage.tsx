import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DailyAdherenceView } from '../components/DailyAdherenceView';
import { useAuth } from '../hooks/useAuth';

const parseRouteDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const AdherenceDailyPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId, date } = useParams<{ patientId: string; date: string }>();
  const { user } = useAuth();

  const selectedDate = parseRouteDate(date);

  if (!patientId || !selectedDate) {
    return (
      <div className="p-6 bg-anixi-beige min-h-screen">
        <div className="p-4 bg-gray-50 border border-red-200 rounded-lg">
          <p className="text-red-700">Invalid patient or date</p>
        </div>
      </div>
    );
  }

  const goToDate = (target: Date) => {
    const day = target.toISOString().split('T')[0];
    navigate(`/patient-profile/${patientId}/adherence-daily/${day}`);
  };

  return (
    <div className="p-6 bg-anixi-beige min-h-screen">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <button
            onClick={() => navigate(`/patient-profile/${patientId}/adherence-calendar`)}
            className="mb-3 px-4 py-2 bg-anixi-green text-white hover:opacity-90 rounded-lg transition-all"
          >
            ← Back to Calendar
          </button>
          <h1 className="text-3xl font-bold text-anixi-green">Daily Adherence</h1>
          <p className="mt-1 text-anixi-green">Medication, mood, and vitals for selected date</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyAdherenceView
              patientId={patientId}
              doctorId={user?.id}
              date={selectedDate}
              onPreviousDay={() => {
                const previous = new Date(selectedDate);
                previous.setDate(previous.getDate() - 1);
                goToDate(previous);
              }}
              onNextDay={() => {
                const next = new Date(selectedDate);
                next.setDate(next.getDate() + 1);
                goToDate(next);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdherenceDailyPage;
