import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DevicePhoneMobileIcon,
  HeartIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useNavigateWithFallback } from '../hooks/useNavigateWithFallback';
import { PageHeader, PageShell } from '../components/page-layout';
import { DetailPageSkeleton } from '../components/ui';
import {
  getPatientWearableSummary,
  type PatientWearableSummary,
} from '../services/wearableService';

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  placeholder,
}: {
  label: string;
  value: number | null;
  unit: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  placeholder?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#D8DEE5] bg-white p-5 shadow-sm">
      <Icon className="mb-3 h-8 w-8 text-[#4D6159]" />
      <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-4xl font-bold text-[#0E2340]">
          {value !== null ? value : '—'}
        </p>
        {value !== null ? (
          <span className="text-base font-medium text-[#65758b]">{unit}</span>
        ) : null}
      </div>
      {value === null && placeholder ? (
        <p className="mt-2 text-sm italic text-[#E8A06A]">{placeholder}</p>
      ) : null}
    </div>
  );
}

export const WearableDataPage: React.FC = () => {
  const { navigateBack } = useNavigateWithFallback();
  const { patientId } = useParams<{ patientId: string }>();
  const [summary, setSummary] = useState<PatientWearableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPatientWearableSummary(patientId);
        setSummary(data);
      } catch {
        setError('Unable to load wearable data for this patient.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [patientId]);

  if (!patientId) {
    return (
      <PageShell>
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Patient ID not found
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell>
        <DetailPageSkeleton />
      </PageShell>
    );
  }

  const hasData = Boolean(summary?.lastSyncAt);

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => navigateBack(`/patient-profile/${patientId}`)}
        className="mb-4 inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm font-medium text-[#344256] hover:border-[#427160]/40 hover:text-[#427160]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Patient Profile
      </button>

      <PageHeader
        title="Wearable data"
        description="Synced steps, heart rate, and device activity from the patient app."
      />

      {error ? (
        <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-6 rounded-[20px] border border-[#D8DEE5] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4F1]">
            <DevicePhoneMobileIcon className="h-6 w-6 text-[#4D6159]" />
          </span>
          <div>
            <p className="font-semibold text-[#0E2340]">Device sync status</p>
            <p className="text-sm text-[#65758b]">
              {hasData
                ? `Last synced ${summary?.lastSyncAt?.toLocaleString()}`
                : 'No wearable sync recorded yet'}
            </p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-[20px] border border-dashed border-[#D8DEE5] bg-[#F8FAFB] p-8 text-center">
          <p className="text-lg font-semibold text-[#0E2340]">No wearable data yet</p>
          <p className="mt-2 text-sm text-[#65758b]">
            Ask the patient to link their Apple Watch or Health app from the Wearables
            section in the mobile app.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            label="Steps today"
            value={summary?.steps ?? null}
            unit="steps"
            icon={DevicePhoneMobileIcon}
          />
          <MetricCard
            label="Avg heart rate"
            value={summary?.averageHeartRate ?? null}
            unit="bpm"
            icon={HeartIcon}
          />
          <MetricCard
            label="Sleep"
            value={summary?.sleepHours ?? null}
            unit="hrs"
            icon={MoonIcon}
            placeholder="Coming soon"
          />
        </div>
      )}
    </PageShell>
  );
};

export default WearableDataPage;
