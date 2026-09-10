import React from 'react';
import { AyahAvatar } from '../../ayah/AyahAvatar';

function CreatingDots() {
  return (
    <span className="inline-flex items-center gap-1 pl-1">
      <span className="ayah-typing-dot h-1.5 w-1.5 rounded-full bg-[#427160]" />
      <span className="ayah-typing-dot h-1.5 w-1.5 rounded-full bg-[#427160]" />
      <span className="ayah-typing-dot h-1.5 w-1.5 rounded-full bg-[#427160]" />
    </span>
  );
}

export function DashboardCreatingState() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-[#f7f6f3] px-6">
      <AyahAvatar size="lg" />
      <p className="mt-5 font-heading text-lg font-medium text-[#344256] sm:text-xl">
        Ayah is creating your dashboard
        <CreatingDots />
      </p>
      <p className="mt-2 max-w-sm text-center text-sm text-[#65758b]">
        Pulling live data from your practice. This usually takes a few seconds.
      </p>
    </div>
  );
}
