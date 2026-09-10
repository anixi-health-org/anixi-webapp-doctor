import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { JoinPath } from '../../types/auth';
import { getJoinPathConfig, JOIN_PATH_JOIN_PAGE_HINT } from '../../lib/joinPathConfig';

type RegisterPathPreviewProps = {
  joinPath: JoinPath;
};

/** Shows what happens after account creation for the selected join path. */
export const RegisterPathPreview: React.FC<RegisterPathPreviewProps> = ({ joinPath }) => {
  const config = getJoinPathConfig(joinPath);

  return (
    <div className="mb-5 rounded-xl border border-[#e8eeec] bg-[#fafcfb] px-4 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
        What happens next
      </p>
      <ul className="mt-2.5 space-y-2">
        {config.nextSteps.map((step, index) => (
          <li key={step} className="flex items-start gap-2.5 text-sm text-[#344256]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-anixi-green/10 text-[11px] font-bold text-anixi-green">
              {index + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

type JoinPathSelectionHintProps = {
  joinPath: JoinPath;
};

/** Compact preview on the join page when a path is selected. */
export const JoinPathSelectionHint: React.FC<JoinPathSelectionHintProps> = ({ joinPath }) => {
  const hint = getJoinPathConfig(joinPath);
  const pageHint = JOIN_PATH_JOIN_PAGE_HINT[joinPath];

  return (
    <div className="mt-4 rounded-xl border border-anixi-green/20 bg-anixi-green/[0.04] px-4 py-3.5 animate-in fade-in duration-200">
      <p className="flex items-center gap-2 text-sm font-semibold text-anixi-green">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        {pageHint.title}
      </p>
      <ol className="mt-2 space-y-1 pl-6 text-sm text-gray-600 [list-style:decimal]">
        {pageHint.steps.map((step: string) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-gray-500">{hint.cardDescription}</p>
    </div>
  );
};
