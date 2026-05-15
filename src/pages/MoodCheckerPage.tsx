import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { MoodCalendar } from '../components/MoodCalendar';
export const MoodCheckerPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  if (!patientId) {
    return (
      <div className="p-6 bg-anixi-beige min-h-screen">
        <div className="p-4 bg-gray-50 border border-red-200 rounded-lg">
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
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 bg-anixi-green text-white hover:opacity-90 rounded-lg transition-all"
          >
            ← Back to Patient Profile
          </button>
          <h1 className="text-3xl font-bold text-anixi-green">🎭 Mood Checker</h1>
          <p className="mt-2 text-anixi-green">Track patient mood and emotional well-being</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Mood Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <MoodCalendar patientId={patientId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default MoodCheckerPage;
