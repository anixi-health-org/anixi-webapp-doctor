import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookableBlocksEditor } from '../practice/BookableBlocksEditor';
import { SoftBlocksEditor } from '../practice/SoftBlocksEditor';
import { usePracticeSettings } from '../../hooks/usePracticeSettings';
import type { ConsultType, PracticeLocation } from '../../types';
import { clinicButtonClasses } from './clinicButtonStyles';

type DoctorBookingSchedulePanelProps = {
  practiceId: string;
  doctorId: string;
  doctorDisplayName: string;
  timezone: string;
  locations: PracticeLocation[];
  practiceConsultTypes?: ConsultType[];
  canManageSchedules: boolean;
  canManageSoftBlocks: boolean;
  onPracticeUpdated?: () => void | Promise<void>;
};

export const DoctorBookingSchedulePanel: React.FC<DoctorBookingSchedulePanelProps> = ({
  practiceId,
  doctorId,
  doctorDisplayName,
  timezone,
  locations,
  practiceConsultTypes,
  canManageSchedules,
  canManageSoftBlocks,
  onPracticeUpdated,
}) => {
  const { bookableBlocks, softBlocks, isLoading, error, reload } = usePracticeSettings();

  const doctorBlocks = useMemo(
    () => bookableBlocks.filter((block) => block.doctorId === doctorId),
    [bookableBlocks, doctorId],
  );

  const doctorSoftBlocks = useMemo(
    () => softBlocks.filter((block) => block.doctorId === doctorId),
    [softBlocks, doctorId],
  );

  if (!canManageSchedules && !canManageSoftBlocks) {
    return (
      <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
          Patient booking schedule
        </p>
        <p className="mt-2 text-sm text-[#65758b]">
          You don&apos;t have permission to edit {doctorDisplayName}&apos;s bookable hours. Ask a
          practice manager or open{' '}
          <Link to="/clinic/settings?tab=schedules" className="font-semibold text-anixi-green hover:underline">
            Clinic settings → Doctor schedules
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section
      id="booking-schedule"
      className="scroll-mt-6 space-y-6 rounded-2xl border border-[#e1e7ef] bg-white p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
            Patient booking schedule
          </p>
          <p className="mt-1 max-w-2xl text-sm text-[#65758b]">
            Set when warriors can book {doctorDisplayName} in the app. The clinic still confirms
            visits and handles invoicing after booking.
          </p>
        </div>
        <Link
          to="/clinic/settings?tab=schedules"
          className={clinicButtonClasses('outline', 'sm')}
        >
          All doctors
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-[#65758b]">Loading schedule…</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {locations.length === 0 ? (
        <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add a clinic location under{' '}
          <Link to="/clinic/settings" className="font-semibold text-anixi-green hover:underline">
            Clinic settings
          </Link>{' '}
          before saving bookable hours.
        </p>
      ) : null}

      {canManageSchedules ? (
        <BookableBlocksEditor
          practiceId={practiceId}
          blocks={doctorBlocks}
          locations={locations}
          timezone={timezone}
          practiceConsultTypes={practiceConsultTypes}
          onChanged={() => void reload()}
          onPracticeUpdated={() => void onPracticeUpdated?.()}
          doctorId={doctorId}
        />
      ) : null}

      {canManageSoftBlocks ? (
        <SoftBlocksEditor
          practiceId={practiceId}
          softBlocks={doctorSoftBlocks}
          onChanged={() => void reload()}
          doctorId={doctorId}
        />
      ) : null}
    </section>
  );
};

export default DoctorBookingSchedulePanel;
