import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircleIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export type SetupStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
};

type Props = {
  steps: SetupStep[];
  className?: string;
};

export const ClinicAdminSetupBanner: React.FC<Props> = ({ steps, className }) => {
  const pending = steps.filter((s) => !s.done);
  if (pending.length === 0) return null;

  const doneCount = steps.length - pending.length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const nextStep = pending[0];

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-sm',
        className
      )}
    >
      <div className="border-b border-[#eef2f6] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#344256]">Get your clinic ready</p>
            <p className="mt-0.5 text-sm text-[#65758b]">
              {doneCount} of {steps.length} setup steps complete
            </p>
          </div>
          <div className="flex items-center gap-3 sm:min-w-[200px]">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eef2f6]">
              <div
                className="h-full rounded-full bg-anixi-green transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-[#65758b]">{progress}%</span>
          </div>
        </div>
      </div>

      {nextStep && (
        <Link
          to={nextStep.href}
          className="flex items-center gap-4 border-b border-[#eef2f6] bg-[#fafcfb] px-5 py-4 transition hover:bg-[#f4f7f5] sm:px-6"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-anixi-green/10 text-sm font-bold text-anixi-green">
            {doneCount + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#344256]">Next: {nextStep.label}</p>
            <p className="mt-0.5 truncate text-sm text-[#65758b]">{nextStep.description}</p>
          </div>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-[#94a3b8]" />
        </Link>
      )}

      <ul className="divide-y divide-[#eef2f6] px-1 pb-1">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.href}
              className={clsx(
                'flex items-start gap-3 rounded-xl px-4 py-3 transition sm:px-5',
                step.done ? 'opacity-60' : 'hover:bg-[#fafcfb]'
              )}
            >
              <CheckCircleIcon
                className={clsx(
                  'mt-0.5 h-5 w-5 shrink-0',
                  step.done ? 'text-emerald-500' : 'text-[#cbd5e1]'
                )}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={clsx(
                    'text-sm font-medium',
                    step.done ? 'text-[#94a3b8] line-through' : 'text-[#344256]'
                  )}
                >
                  {step.label}
                </p>
                {!step.done && step.id !== nextStep?.id && (
                  <p className="mt-0.5 text-xs leading-relaxed text-[#65758b]">{step.description}</p>
                )}
              </div>
              {!step.done && step.id !== nextStep?.id && (
                <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#cbd5e1]" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ClinicAdminSetupBanner;
