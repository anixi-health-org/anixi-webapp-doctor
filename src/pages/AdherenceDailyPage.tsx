import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { DailyAdherenceView } from '../components/DailyAdherenceView';
import { PageHeader, PageShell } from '../components/page-layout';
import { useAuth } from '../hooks/useAuth';
import { addDays, getDateString, parseLocalDate } from '../utils/dateFormatter';

export const AdherenceDailyPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId, date } = useParams<{ patientId: string; date: string }>();
  const { user } = useAuth();

  const selectedDate = parseLocalDate(date ?? '');

  if (!patientId || !selectedDate) {
    return (
      <PageShell>
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Invalid patient or date
        </div>
      </PageShell>
    );
  }

  const goToDate = (target: Date) => {
    navigate(`/patient-profile/${patientId}/adherence-daily/${getDateString(target)}`);
  };

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => navigate(`/patient-profile/${patientId}/adherence-calendar`)}
        className="mb-4 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Calendar
      </button>
      <PageHeader
        title="Daily Adherence"
        description="Medication, mood, and vitals for the selected date."
      />
      <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm sm:p-6">
        <DailyAdherenceView
          patientId={patientId}
          doctorId={user?.id}
          date={selectedDate}
          onPreviousDay={() => goToDate(addDays(selectedDate, -1))}
          onNextDay={() => goToDate(addDays(selectedDate, 1))}
        />
      </div>
    </PageShell>
  );
};

export default AdherenceDailyPage;
