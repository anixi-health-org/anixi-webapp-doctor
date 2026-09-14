import React, { useMemo, useState } from 'react';
import { AyahAvatar } from '../ayah/AyahAvatar';
import { AyahComposer } from '../ayah/AyahComposer';
import { useAuth } from '../../hooks/useAuth';
import { formatAskAnixiError, streamAskAnixi } from '../../services/askAnixiService';
import type { OnboardingFlow } from './OnboardingProgress';
import { getOnboardingSteps } from './OnboardingProgress';

type Props = {
  flow: OnboardingFlow;
  currentStep: number;
};

const STARTERS: Record<string, string[]> = {
  'clinic:1': ['What belongs in clinic details?', 'Which timezone should I use?'],
  'clinic:2': ['How do I invite doctors?', 'What columns does the CSV need?'],
  'clinic:3': ['How do I import patients?', 'What is the clinic activation code?'],
  'clinic:4': ['What happens after I launch?', 'What should I set up next?'],
  'solo:1': ['What HPCSA details do I need?', 'What goes in the practice step?'],
  'solo:2': ['What happens during review?', 'How long does approval take?'],
};

export function OnboardingAyahCoach({ flow, currentStep }: Props) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const steps = getOnboardingSteps(flow);
  const step = steps[Math.max(0, currentStep - 1)];
  const starters = STARTERS[`${flow}:${currentStep}`] ?? ['What should I do on this step?'];

  const context = useMemo(
    () => ({
      onboardingFlow: flow,
      onboardingStep: currentStep,
      onboardingStepLabel: step?.label,
    }),
    [flow, currentStep, step?.label],
  );

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !user?.id) return;
    setBusy(true);
    setError('');
    setReply('');
    setInput('');
    try {
      await streamAskAnixi({
        message: trimmed,
        context,
        threadId: `onboarding-${user.id}`,
        onChunk: (chunk) => {
          setReply((prev) => prev + chunk);
        },
      });
    } catch (err) {
      setError(formatAskAnixiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-[#eef2f6] pt-4">
      <div className="flex items-center gap-2">
        <AyahAvatar size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#344256]">Ayah</p>
          <p className="text-xs leading-snug text-[#65758b]">
            I can walk you through {step?.label?.toLowerCase() || 'this step'}.
          </p>
        </div>
      </div>

      {(reply || busy || error) && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-[#f4f7f5] px-3 py-2 text-sm leading-relaxed text-[#344256]">
          {error || reply || (busy ? 'Ayah is thinking…' : '')}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {starters.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={busy}
            onClick={() => void send(prompt)}
            className="rounded-full border border-[#e1e7ef] bg-white px-2.5 py-1 text-[11px] font-medium text-[#344256] hover:border-[#427160]/30 disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <AyahComposer
          compact
          dense
          input={input}
          onInputChange={setInput}
          onSend={(text) => void send(text)}
          streaming={busy}
          placeholder="Ask Ayah about this step"
        />
      </div>
    </div>
  );
}
