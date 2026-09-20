import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  inferDashboardLayout,
  prepareDashboardWidgets,
} from '../../../lib/dashboardPresets';
import {
  buildDashboardAyahBrief,
  classifyDashboardIntent,
} from '../../../lib/dashboardIntent';
import { DASHBOARD_STARTERS } from '../../../lib/dashboardStarterPrompts';
import {
  fetchDoctorDashboardWorkspace,
  saveDoctorDashboardBoard,
  slugBoardId,
} from '../../../services/doctorDashboardService';
import { streamAskAnixi, formatAskAnixiError } from '../../../services/askAnixiService';
import { useAuth } from '../../../hooks/useAuth';
import { AyahComposer } from '../../ayah/AyahComposer';
import {
  DASHBOARD_DOCK_PHRASES,
  DASHBOARD_LANDING_PHRASES,
} from '../../../lib/ayahComposerPhrases';
import type { DoctorDashboardWorkspace } from '../../../types/doctorDashboard';

type Props = {
  mode: 'landing' | 'dock';
  practiceSnapshot?: Record<string, unknown>;
  onCreatingChange?: (creating: boolean) => void;
  onWorkspaceSaved?: (workspace: DoctorDashboardWorkspace) => void;
  initialPrompt?: string;
};

function StarterPills({
  onSelect,
  disabled,
  micro,
  centered,
}: {
  onSelect: (prompt: string) => void;
  disabled: boolean;
  micro?: boolean;
  centered?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1.5',
        centered
          ? 'flex-wrap justify-center'
          : 'overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {DASHBOARD_STARTERS.map((starter) => {
        const Icon = starter.icon;
        return (
          <button
            key={starter.prompt}
            type="button"
            disabled={disabled}
            title={starter.prompt}
            onClick={() => onSelect(starter.prompt)}
            className={clsx(
              'ayah-pill inline-flex shrink-0 items-center rounded-md border border-[#e8eaed] bg-white font-medium text-[#344256] hover:border-[#427160]/25',
              micro && !centered
                ? 'gap-1 px-2 py-1 text-[10px]'
                : centered
                  ? 'gap-1.5 px-2.5 py-1.5 text-[11px]'
                  : 'gap-1.5 px-2.5 py-1.5 text-[11px]',
            )}
          >
            <Icon
              className={clsx(
                'text-[#65758b]',
                micro && !centered ? 'h-3 w-3' : 'h-3.5 w-3.5',
              )}
            />
            <span className={micro && !centered ? 'hidden sm:inline' : 'whitespace-nowrap'}>
              {starter.shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DashboardAyahChat({
  mode,
  practiceSnapshot,
  onCreatingChange,
  onWorkspaceSaved,
  initialPrompt,
}: Props) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const seededRef = useRef(false);

  const runPrompt = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !user) return;
    if (lastSentRef.current === trimmed) return;
    lastSentRef.current = trimmed;

    const intent = classifyDashboardIntent(trimmed);
    const preset = intent.applyPreset ? inferDashboardLayout(trimmed) : null;
    const isReset = intent.kind === 'reset';

    if (!isReset && mode === 'landing') {
      onCreatingChange?.(true);
    }
    setBusy(true);
    setStreamError(null);
    setInput('');

    const persistPreset = async (): Promise<boolean> => {
      if (!preset || !user.id) return false;

      try {
        const widgets = prepareDashboardWidgets(preset.widgets);
        const workspace = await saveDoctorDashboardBoard(
          user.id,
          {
            id: slugBoardId(preset.title),
            title: preset.title,
            subtitle: preset.subtitle,
            widgets,
            theme: 'light',
          },
          { replaceAll: Boolean(isReset) },
        );
        if (widgets.length > 0 || isReset) {
          onWorkspaceSaved?.(workspace);
        }
        return widgets.length > 0 || Boolean(isReset);
      } catch (saveErr) {
        console.error('[DashboardAyahChat] layout save failed', saveErr);
        return false;
      }
    };

    const presetSaved = await persistPreset();

    // Known starter layouts are saved directly — no need to wait on Ayah.
    if (presetSaved && preset) {
      setBusy(false);
      onCreatingChange?.(false);
      setTimeout(() => {
        lastSentRef.current = null;
      }, 500);
      return;
    }

    const dashboardPrompt = buildDashboardAyahBrief(
      trimmed,
      intent,
      practiceSnapshot,
    );

    try {
      await streamAskAnixi({
        message: dashboardPrompt,
        context: {
          practiceId: practiceSnapshot?.practiceId as string | undefined,
          practiceSnapshot,
          dashboardIntent: intent.kind,
        },
        threadId: `${user.id}:dashboard`,
        onChunk: () => {},
      });

      const workspace = await fetchDoctorDashboardWorkspace(user.id);
      if (workspace.boards.length > 0) {
        onWorkspaceSaved?.(workspace);
      }
    } catch (err) {
      const message = formatAskAnixiError(err);
      setStreamError(message);
      console.warn('[DashboardAyahChat] Ayah stream failed', message);
      try {
        const workspace = await fetchDoctorDashboardWorkspace(user.id);
        if (workspace.boards.length > 0) {
          onWorkspaceSaved?.(workspace);
        }
      } catch (fetchErr) {
        console.warn('[DashboardAyahChat] dashboard refresh failed', fetchErr);
      }
    } finally {
      setBusy(false);
      if (!isReset) {
        onCreatingChange?.(false);
      }
      setTimeout(() => {
        lastSentRef.current = null;
      }, 500);
    }
  };

  useEffect(() => {
    if (seededRef.current || !initialPrompt?.trim()) return;
    seededRef.current = true;
    void runPrompt(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const placeholder =
    mode === 'landing'
      ? 'Describe the dashboard you want…'
      : 'Ask Ayah to add or change something…';

  const typewriterPhrases =
    mode === 'landing' ? DASHBOARD_LANDING_PHRASES : DASHBOARD_DOCK_PHRASES;

  const composer = (
    <AyahComposer
      input={input}
      onInputChange={setInput}
      onSend={(text) => void runPrompt(text)}
      streaming={busy}
      placeholder={placeholder}
      typewriterPhrases={typewriterPhrases}
      tall={mode === 'landing'}
      compact={mode === 'dock'}
      dense={mode === 'dock'}
    />
  );

  if (mode === 'landing') {
    return (
      <div className="flex w-full max-w-[640px] flex-col gap-5">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-[#344256] sm:text-4xl">
            How should your dashboard look?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#65758b]">
            Tell Ayah what you want to see. She builds it live from your practice data.
          </p>
        </div>

        <StarterPills onSelect={(prompt) => void runPrompt(prompt)} disabled={busy} centered />

        {streamError ? (
          <p className="rounded-lg border border-[#f3d4d4] bg-[#fff5f5] px-3 py-2 text-center text-sm text-[#9b2c2c]">
            {streamError}
          </p>
        ) : null}

        {composer}
      </div>
    );
  }

  return (
    <footer className="shrink-0 border-t border-[#eceae6] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl px-3 py-2.5 sm:px-4">
        <div className="flex flex-col items-center gap-2">
          {streamError ? (
            <p className="w-full rounded-lg border border-[#f3d4d4] bg-[#fff5f5] px-3 py-2 text-center text-xs text-[#9b2c2c]">
              {streamError}
            </p>
          ) : null}
          <StarterPills
            onSelect={(prompt) => void runPrompt(prompt)}
            disabled={busy}
            centered
          />
          <div className="w-full">{composer}</div>
        </div>
      </div>
    </footer>
  );
}
