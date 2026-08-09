import React from 'react';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  FaceSmileIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface QuickLink {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick: () => void;
  accent: string;
  iconBg: string;
}

interface PatientCareQuickLinksProps {
  onMoodChecker: () => void;
  onAdherenceCalendar: () => void;
  onAdherenceLogs: () => void;
  onVitalsHistory: () => void;
  onWearableData: () => void;
  onScheduleFollowUp: () => void;
}

export const PatientCareQuickLinks: React.FC<PatientCareQuickLinksProps> = ({
  onMoodChecker,
  onAdherenceCalendar,
  onAdherenceLogs,
  onVitalsHistory,
  onWearableData,
  onScheduleFollowUp,
}) => {
  const monitoringLinks: QuickLink[] = [
    {
      id: 'mood',
      title: 'Mood checker',
      description: 'Emotional well-being trends',
      icon: FaceSmileIcon,
      onClick: onMoodChecker,
      accent: 'hover:border-violet-200 hover:bg-violet-50/50',
      iconBg: 'bg-violet-50 text-violet-700',
    },
    {
      id: 'calendar',
      title: 'Adherence calendar',
      description: 'Medication by date',
      icon: CalendarDaysIcon,
      onClick: onAdherenceCalendar,
      accent: 'hover:border-sky-200 hover:bg-sky-50/50',
      iconBg: 'bg-sky-50 text-sky-700',
    },
    {
      id: 'logs',
      title: 'Adherence logs',
      description: 'Full medication history',
      icon: ClipboardDocumentListIcon,
      onClick: onAdherenceLogs,
      accent: 'hover:border-emerald-200 hover:bg-emerald-50/50',
      iconBg: 'bg-emerald-50 text-emerald-700',
    },
    {
      id: 'vitals',
      title: 'Vitals history',
      description: 'Heart rate, BP & more',
      icon: HeartIcon,
      onClick: onVitalsHistory,
      accent: 'hover:border-rose-200 hover:bg-rose-50/50',
      iconBg: 'bg-rose-50 text-rose-700',
    },
    {
      id: 'wearable',
      title: 'Wearable data',
      description: 'Steps, heart rate & device sync',
      icon: ChartBarIcon,
      onClick: onWearableData,
      accent: 'hover:border-teal-200 hover:bg-teal-50/50',
      iconBg: 'bg-teal-50 text-teal-700',
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <ChartBarIcon className="h-5 w-5 text-anixi-green" />
        <h3 className="font-heading text-lg font-semibold text-gray-900">Care & monitoring</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {monitoringLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.id}
              type="button"
              onClick={link.onClick}
              className={clsx(
                'group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md',
                link.accent
              )}
            >
              <span
                className={clsx(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:scale-105',
                  link.iconBg
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900">{link.title}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{link.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onScheduleFollowUp}
        className="group mt-4 flex w-full items-center justify-between gap-4 rounded-xl border border-anixi-green/30 bg-gradient-to-r from-anixi-green to-anixi-green/90 p-4 text-left text-white shadow-md transition-all hover:shadow-lg hover:brightness-105"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <CalendarDaysIcon className="h-6 w-6 text-white" />
          </span>
          <span>
            <span className="block font-heading text-base font-semibold">Schedule follow-up</span>
            <span className="mt-0.5 block text-sm text-white/85">
              Book the patient&apos;s next visit in one step
            </span>
          </span>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
          <ArrowRightIcon className="h-5 w-5 text-white" />
        </span>
      </button>
    </div>
  );
};
