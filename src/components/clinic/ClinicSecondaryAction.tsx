import React from 'react';

type Props = {
  open: boolean;
  onToggle: () => void;
  revealLabel: string;
  hideLabel?: string;
};

export const ClinicSecondaryAction: React.FC<Props> = ({
  open,
  onToggle,
  revealLabel,
  hideLabel = 'Hide',
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="rounded-full border-2 border-anixi-green bg-white px-5 py-2.5 text-sm font-semibold text-anixi-green transition hover:bg-anixi-green/5"
  >
    {open ? hideLabel : revealLabel}
  </button>
);
