import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { AdherenceCalendar } from '../components/AdherenceCalendar';
import { PageHeader, PageShell } from '../components/page-layout';
import { useAuth } from '../hooks/useAuth';
import { getDateString } from '../utils/dateFormatter';

export const AdherenceCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();

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
        className="mb-4 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] transition-colors hover:border-[#427160]/40 hover:text-[#427160]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Patient Profile
      </button>

      <PageHeader
        title="Adherence Calendar"
        description="View medication adherence by date."
      />

      <AdherenceCalendar
        patientId={patientId}
        doctorId={user?.id}
        onDayClick={(date) => {
          navigate(`/patient-profile/${patientId}/adherence-daily/${getDateString(date)}`);
        }}
      />
    </PageShell>
  );
};

export default AdherenceCalendarPage;
