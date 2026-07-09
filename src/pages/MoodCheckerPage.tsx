import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Card, CardContent } from '../components/ui/Card';
import { PageHeader } from '../components/page-layout/PageHeader';
import { MoodCalendar } from '../components/MoodCalendar';

export const MoodCheckerPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();

  if (!patientId) {
    return (
      <div className="min-h-screen bg-anixi-beige p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">Patient ID not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-anixi-beige p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(`/patient-profile/${patientId}`)}
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-anixi-green px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Patient Profile
        </button>

        <PageHeader
          title="Mood Checker"
          description="Track patient mood and emotional well-being over time."
        />

        <Card>
          <CardContent className="p-4 sm:p-6">
            <MoodCalendar patientId={patientId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MoodCheckerPage;
