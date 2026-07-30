import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { MoodCalendar } from '../components/MoodCalendar';
import { PageHeader, PageShell } from '../components/page-layout';

export const MoodCheckerPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();

  if (!patientId) {
    return (
      <PageShell>
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Patient ID not found
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => navigate(`/patient-profile/${patientId}`)}
        className="mb-4 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Patient Profile
      </button>
      <PageHeader
        title="Mood Checker"
        description="Track patient mood and emotional well-being over time."
      />
      <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm sm:p-6">
        <MoodCalendar patientId={patientId} />
      </div>
    </PageShell>
  );
};

export default MoodCheckerPage;
