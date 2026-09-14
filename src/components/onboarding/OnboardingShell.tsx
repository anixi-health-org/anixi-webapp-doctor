import React from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { AnixiLogo } from '../brand/AnixiLogo';
import {
  OnboardingNavProgress,
  OnboardingStepSidebar,
  type OnboardingFlow,
  type OnboardingStepSidebarProps,
} from './OnboardingProgress';
import { OnboardingAyahCoach } from './OnboardingAyahCoach';

type OnboardingShellProps = {
  children: React.ReactNode;
  flow: OnboardingFlow;
  currentStep: number;
  subProgress?: OnboardingStepSidebarProps['subProgress'];
  title: string;
  subtitle?: string;
  onStepClick?: OnboardingStepSidebarProps['onStepClick'];
  onBack?: () => void;
  backLabel?: string;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '5xl' | 'full';
};

const contentWidthClass = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-none',
};

export const OnboardingShell: React.FC<OnboardingShellProps> = ({
  children,
  flow,
  currentStep,
  subProgress,
  title,
  subtitle,
  onStepClick,
  onBack,
  backLabel,
  maxWidth = '2xl',
}) => (
  <div className="flex min-h-screen flex-col bg-[#f4f7f5]">
    {/* Navbar with progress bar */}
    <header className="sticky top-0 z-30 border-b border-[#e1e7ef] bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6 lg:px-8">
        <div className="shrink-0">
          <AnixiLogo variant="header" linkTo={null} />
        </div>

        <OnboardingNavProgress
          flow={flow}
          currentStep={currentStep}
          className="hidden min-w-0 sm:block"
        />
      </div>

      {/* Mobile progress bar */}
      <div className="border-t border-[#eef2f6] px-4 py-2.5 sm:hidden">
        <OnboardingNavProgress flow={flow} currentStep={currentStep} />
      </div>
    </header>

    <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-0 lg:gap-10 lg:px-8 lg:py-8">
      {/* Left sidebar: step-by-step */}
      <aside className="hidden w-[240px] shrink-0 lg:block xl:w-[260px]">
        <div className="sticky top-[72px] rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm">
          <OnboardingStepSidebar
            flow={flow}
            currentStep={currentStep}
            subProgress={subProgress}
            onStepClick={onStepClick}
          />
          <OnboardingAyahCoach flow={flow} currentStep={currentStep} />
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-0 lg:py-0">
        {/* Mobile horizontal step pills */}
        <div className="mb-5 overflow-x-auto lg:hidden">
          <MobileStepPills flow={flow} currentStep={currentStep} />
        </div>

        <div className={`mx-auto w-full ${contentWidthClass[maxWidth]} lg:mx-0`}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-anixi-green">
                {flow === 'clinic' ? 'Clinic onboarding' : 'Doctor onboarding'}
              </p>
              <h1 className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-[#344256] sm:text-[1.75rem]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#65758b]">
                  {subtitle}
                </p>
              )}
            </div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border-2 border-[#344256] bg-white px-5 py-2.5 text-sm font-semibold text-[#344256] shadow-sm transition hover:bg-[#f8fafc] sm:mt-1"
              >
                <ChevronLeftIcon className="h-4 w-4" aria-hidden />
                {backLabel || 'Back'}
              </button>
            )}
          </div>

          {children}
          <div className="mt-6 lg:hidden">
            <div className="rounded-2xl border border-[#e1e7ef] bg-white p-4 shadow-sm">
              <OnboardingAyahCoach flow={flow} currentStep={currentStep} />
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
);

const MobileStepPills: React.FC<{ flow: OnboardingFlow; currentStep: number }> = ({
  flow,
  currentStep,
}) => {
  const steps =
    flow === 'clinic'
      ? ['Clinic', 'Doctors', 'Patients', 'Launch']
      : ['Profile', 'Review'];

  return (
    <div className="flex gap-2">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <div
            key={label}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              isCurrent
                ? 'bg-anixi-green text-white'
                : isComplete
                  ? 'bg-anixi-green/10 text-anixi-green'
                  : 'bg-white text-[#94a3b8] ring-1 ring-[#e1e7ef]'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                isCurrent ? 'bg-white/20' : isComplete ? 'bg-anixi-green/15' : 'bg-[#f1f5f3]'
              }`}
            >
              {isComplete ? '✓' : stepNumber}
            </span>
            {label}
          </div>
        );
      })}
    </div>
  );
};
