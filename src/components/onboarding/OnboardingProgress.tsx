import clsx from 'clsx';
import React from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

export type OnboardingFlow = 'clinic' | 'solo' | 'market_partner';

export type OnboardingStep = {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
};

const CLINIC_STEPS: OnboardingStep[] = [
  {
    id: 'clinic',
    label: 'Clinic details',
    shortLabel: 'Clinic',
    description: 'Name, timezone, and location',
  },
  {
    id: 'team',
    label: 'Invite doctors',
    shortLabel: 'Doctors',
    description: 'Bulk upload & email invites',
  },
  {
    id: 'patients',
    label: 'Import patients',
    shortLabel: 'Patients',
    description: 'CSV roster + login invite emails',
  },
  {
    id: 'launch',
    label: 'Go live',
    shortLabel: 'Launch',
    description: 'Open your clinic portal',
  },
];

const SOLO_STEPS: OnboardingStep[] = [
  {
    id: 'profile',
    label: 'Your profile',
    shortLabel: 'Profile',
    description: 'Personal and professional details',
  },
  {
    id: 'review',
    label: 'Admin review',
    shortLabel: 'Review',
    description: 'Approval before go-live',
  },
];

const MARKET_PARTNER_STEPS: OnboardingStep[] = [
  {
    id: 'business',
    label: 'Business profile',
    shortLabel: 'Business',
    description: 'Type, name, and how patients see you',
  },
  {
    id: 'location',
    label: 'Location & contact',
    shortLabel: 'Location',
    description: 'Where you operate and how to reach you',
  },
  {
    id: 'offerings',
    label: 'Products & services',
    shortLabel: 'Offerings',
    description: 'What appears on the patient Market',
  },
  {
    id: 'submit',
    label: 'Review & submit',
    shortLabel: 'Submit',
    description: 'Confirm details for admin approval',
  },
];

export function getOnboardingSteps(flow: OnboardingFlow): OnboardingStep[] {
  if (flow === 'clinic') return CLINIC_STEPS;
  if (flow === 'market_partner') return MARKET_PARTNER_STEPS;
  return SOLO_STEPS;
}

export function useOnboardingProgress(flow: OnboardingFlow, currentStep: number) {
  const steps = getOnboardingSteps(flow);
  const total = steps.length;
  const clampedCurrent = Math.min(Math.max(currentStep, 1), total);
  const completedCount = clampedCurrent - 1;
  const barPercent = Math.round(((completedCount + 0.35) / total) * 100);

  return { steps, total, clampedCurrent, barPercent };
}

export type OnboardingNavProgressProps = {
  flow: OnboardingFlow;
  currentStep: number;
  className?: string;
};

/** Thin progress bar for the top navigation */
export const OnboardingNavProgress: React.FC<OnboardingNavProgressProps> = ({
  flow,
  currentStep,
  className,
}) => {
  const { total, clampedCurrent, barPercent } = useOnboardingProgress(flow, currentStep);

  return (
    <div className={clsx('min-w-0 flex-1', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] sm:text-xs">
        <span className="truncate font-medium text-[#65758b]">
          Step {clampedCurrent} of {total}
        </span>
        <span className="shrink-0 font-semibold text-anixi-green">{barPercent}%</span>
      </div>
      <div
        className="relative h-1.5 overflow-hidden rounded-full bg-[#e8eeec] sm:h-2"
        role="progressbar"
        aria-valuenow={barPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-anixi-green to-[#5a8a75] transition-all duration-500 ease-out"
          style={{ width: `${barPercent}%` }}
        />
      </div>
    </div>
  );
};

export type OnboardingStepSidebarProps = {
  flow: OnboardingFlow;
  currentStep: number;
  subProgress?: {
    current: number;
    total: number;
    label: string;
  };
  /** Called when the user clicks a completed (or current) step to jump back to it */
  onStepClick?: (step: OnboardingStep, stepNumber: number) => void;
  className?: string;
};

/** Vertical step list for the left sidebar */
export const OnboardingStepSidebar: React.FC<OnboardingStepSidebarProps> = ({
  flow,
  currentStep,
  subProgress,
  onStepClick,
  className,
}) => {
  const { steps, clampedCurrent } = useOnboardingProgress(flow, currentStep);

  return (
    <nav
      aria-label="Onboarding steps"
      className={clsx('flex flex-col', className)}
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
        {flow === 'clinic'
          ? 'Clinic setup'
          : flow === 'market_partner'
            ? 'Market Partner setup'
            : 'Getting started'}
      </p>

      <ol className="space-y-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < clampedCurrent;
          const isCurrent = stepNumber === clampedCurrent;
          const isUpcoming = stepNumber > clampedCurrent;
          const isLast = index === steps.length - 1;
          const isClickable = Boolean(onStepClick) && (isComplete || isCurrent) && !isCurrent;

          return (
            <li key={step.id} className="relative flex gap-3">
              {!isLast && (
                <span
                  aria-hidden
                  className={clsx(
                    'absolute left-[15px] top-9 h-[calc(100%-4px)] w-0.5 -translate-x-1/2',
                    isComplete ? 'bg-anixi-green' : 'bg-[#e1e7ef]'
                  )}
                />
              )}

              <div className="relative z-[1] shrink-0 pt-0.5">
                <div
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300',
                    isComplete && 'border-anixi-green bg-anixi-green text-white',
                    isCurrent &&
                      'border-anixi-green bg-white text-anixi-green shadow-[0_0_0_4px_rgba(66,89,80,0.1)]',
                    isUpcoming && 'border-[#d1ddd8] bg-white text-[#b0bdb8]'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? (
                    <CheckIcon className="h-4 w-4" aria-hidden />
                  ) : (
                    stepNumber
                  )}
                </div>
              </div>

              <div className={clsx('min-w-0 pb-6', isLast && 'pb-0')}>
                {isClickable ? (
                  <button
                    type="button"
                    onClick={() => onStepClick?.(step, stepNumber)}
                    className="group -mx-1.5 -my-1 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-anixi-green/[0.06]"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight text-[#344256] group-hover:text-anixi-green">
                      {step.label}
                      <ArrowUturnLeftIcon
                        className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </span>
                    {step.description && (
                      <span className="mt-0.5 block text-xs leading-snug text-[#b0bdb8] group-hover:text-[#65758b]">
                        {step.description}
                      </span>
                    )}
                  </button>
                ) : (
                  <div>
                    <p
                      className={clsx(
                        'text-sm font-semibold leading-tight',
                        isCurrent && 'text-anixi-green',
                        isComplete && 'text-[#344256]',
                        isUpcoming && 'text-[#94a3b8]'
                      )}
                    >
                      {step.label}
                    </p>
                    {step.description && (
                      <p
                        className={clsx(
                          'mt-0.5 text-xs leading-snug',
                          isCurrent ? 'text-[#65758b]' : 'text-[#b0bdb8]'
                        )}
                      >
                        {step.description}
                      </p>
                    )}
                  </div>
                )}

                {isCurrent && subProgress && (
                  <div className="mt-3 rounded-lg border border-[#e1e7ef] bg-[#fafcfb] px-3 py-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-[#344256]">{subProgress.label}</span>
                      <span className="text-[#94a3b8]">
                        {subProgress.current}/{subProgress.total}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[#e8eeec]">
                      <div
                        className="h-full rounded-full bg-anixi-green/75 transition-all duration-300"
                        style={{
                          width: `${Math.round((subProgress.current / subProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export function getOnboardingStepMeta(
  flow: OnboardingFlow,
  currentStep: number
): { title: string; subtitle: string } {
  if (flow === 'clinic') {
    switch (currentStep) {
      case 1:
        return {
          title: 'Set up your clinic',
          subtitle:
            'Add your clinic name, timezone, and first location. You can refine hours and branding later.',
        };
      case 2:
        return {
          title: 'Invite your doctors',
          subtitle:
            'Upload or paste your doctor list. Each person receives an email to create their own login under your clinic.',
        };
      case 3:
        return {
          title: 'Import your patients',
          subtitle:
            'Add existing patients in bulk. They can download the Anixi app to view records and manage adherence.',
        };
      case 4:
        return {
          title: 'Your clinic is ready',
          subtitle:
            'Open the portal to manage bookings, team, and patients. Doctors complete their own profiles when they accept their invite.',
        };
      default:
        return { title: 'Getting started', subtitle: '' };
    }
  }

  if (flow === 'market_partner') {
    switch (currentStep) {
      case 1:
        return {
          title: 'Tell us about your business',
          subtitle:
            'Choose wellness or pharmacy, then describe how patients should discover you on the Anixi Market.',
        };
      case 2:
        return {
          title: 'Where do you operate?',
          subtitle:
            'Add your address and contact details so patients and Anixi admin can reach you.',
        };
      case 3:
        return {
          title: 'List your products & services',
          subtitle:
            'These offerings appear on the patient Market tab after Anixi admin approves your listing.',
        };
      case 4:
        return {
          title: 'Review and submit',
          subtitle:
            'Confirm everything looks right. Admin will verify before your listing goes live.',
        };
      default:
        return { title: 'Market Partner onboarding', subtitle: '' };
    }
  }

  switch (currentStep) {
    case 1:
      return {
        title: 'Complete your doctor application',
        subtitle:
          'Fill in your personal, professional, and practice details for Anixi Admin review.',
      };
    case 2:
      return {
        title: 'Application under review',
        subtitle: 'We will notify you once your account is approved.',
      };
    default:
      return { title: 'Getting started', subtitle: '' };
  }
}

/** @deprecated Use OnboardingNavProgress + OnboardingStepSidebar in OnboardingShell */
export const OnboardingProgress: React.FC<{
  flow: OnboardingFlow;
  currentStep: number;
  subProgress?: OnboardingStepSidebarProps['subProgress'];
  className?: string;
}> = ({ flow, currentStep, subProgress, className }) => (
  <div className={className}>
    <OnboardingNavProgress flow={flow} currentStep={currentStep} />
    <div className="mt-4">
      <OnboardingStepSidebar
        flow={flow}
        currentStep={currentStep}
        subProgress={subProgress}
      />
    </div>
  </div>
);
