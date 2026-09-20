import {
  ArrowPathIcon,
  BeakerIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  InboxIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import React, { useRef, useState, type ComponentType, type SVGProps } from 'react';
import type { AskAnixiContext } from '../../services/askAnixiService';
import type { StoredAyahMessage } from '../../lib/ayahChatStorage';
import { PATIENT_COMMANDS, PRACTICE_COMMANDS, type AyahCommand } from '../../lib/ayahCommands';
import {
  patientComposerPhrases,
  PRACTICE_COMPOSER_PHRASES,
} from '../../lib/ayahComposerPhrases';
import { displayUserMessage } from '../../lib/ayahUserMessage';
import type { DoctorAgentDraft } from '../../services/askAnixiService';
import { AyahAvatar } from './AyahAvatar';
import { AyahBriefingContent } from './AyahBriefingContent';
import { AyahComposer } from './AyahComposer';
import { AyahDraftReview } from './AyahDraftReview';
import { AyahChartSources } from './AyahChartSources';
import { AyahFadeIn, ayahMessageClass } from './AyahMotion';

export type AyahFileUpload = {
  file: File;
  content: string;
  type: 'patient_csv' | 'staff_csv' | 'unknown';
};

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const COMMAND_ICONS: Record<string, IconType> = {
  today: SparklesIcon,
  'prepare-next': UserIcon,
  attention: ExclamationTriangleIcon,
  panel: UsersIcon,
  inbox: InboxIcon,
  'follow-ups-practice': ClockIcon,
  'thirty-sec': ChatBubbleLeftRightIcon,
  'what-changed': ArrowPathIcon,
  overview: ClipboardDocumentListIcon,
  medications: HeartIcon,
  results: BeakerIcon,
  story: DocumentTextIcon,
  'draft-note': ClipboardDocumentListIcon,
  'draft-message': ChatBubbleBottomCenterTextIcon,
  'meds-review': HeartIcon,
  'result-review': BeakerIcon,
  trends: ChartBarIcon,
  'follow-ups': ClockIcon,
  questions: QuestionMarkCircleIcon,
  handoff: UsersIcon,
  referral: DocumentTextIcon,
  'care-plan': ClipboardDocumentListIcon,
  instructions: ChatBubbleBottomCenterTextIcon,
};

type Props = {
  context: AskAnixiContext;
  messages: StoredAyahMessage[];
  streaming: boolean;
  hydrated: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  onCommand: (command: AyahCommand) => void;
  onClearPatient: () => void;
  onNewConversation?: () => void;
  onFileUpload?: (upload: AyahFileUpload) => void;
  pendingDrafts?: DoctorAgentDraft[];
  onResolveDraft?: (draft: DoctorAgentDraft, decision: 'approved' | 'rejected') => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onVoiceMode?: () => void;
};

function fileKind(type: AyahFileUpload['type']) {
  if (type === 'patient_csv') return 'Patient roster';
  if (type === 'staff_csv') return 'Staff list';
  return 'CSV';
}

function CommandPills({
  commands,
  extra,
  showMore,
  onToggleMore,
  onCommand,
  disabled,
  stagger,
}: {
  commands: AyahCommand[];
  extra: AyahCommand[];
  showMore: boolean;
  onToggleMore: () => void;
  onCommand: (command: AyahCommand) => void;
  disabled: boolean;
  stagger?: boolean;
}) {
  const visible = showMore ? [...commands, ...extra] : commands;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {visible.map((command, index) => {
        const Icon = COMMAND_ICONS[command.id] ?? SparklesIcon;
        const pill = (
          <button
            type="button"
            disabled={disabled}
            title={command.hint}
            onClick={() => onCommand(command)}
            className="ayah-pill inline-flex items-center gap-2 rounded-full border border-[#e4e2de] bg-white px-3.5 py-2 text-[13px] font-medium text-[#344256] shadow-[0_1px_2px_rgba(28,39,49,0.04)]"
          >
            <Icon className="h-4 w-4 text-[#65758b]" />
            {command.shortLabel ?? command.label}
          </button>
        );
        return stagger ? (
          <AyahFadeIn key={command.id} delay={280 + index * 55} variant="up">
            {pill}
          </AyahFadeIn>
        ) : (
          <React.Fragment key={command.id}>{pill}</React.Fragment>
        );
      })}
      {extra.length > 0 ? (
        <button
          type="button"
          onClick={onToggleMore}
          className="ayah-pill rounded-full px-3 py-2 text-[13px] font-medium text-[#65758b] hover:text-[#344256]"
        >
          {showMore ? 'Less' : 'More'}
        </button>
      ) : null}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      <span className="ayah-typing-dot h-1.5 w-1.5 rounded-full bg-[#427160]" />
      <span className="ayah-typing-dot h-1.5 w-1.5 rounded-full bg-[#427160]" />
      <span className="ayah-typing-dot h-1.5 w-1.5 rounded-full bg-[#427160]" />
    </div>
  );
}

export function AyahWorkspace({
  context,
  messages,
  streaming,
  hydrated,
  input,
  onInputChange,
  onSend,
  onCommand,
  onClearPatient,
  onNewConversation,
  onFileUpload,
  pendingDrafts = [],
  onResolveDraft,
  scrollRef,
  onVoiceMode,
}: Props) {
  const [showMore, setShowMore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<AyahFileUpload | null>(null);

  const handleFileSelect = async (file: File) => {
    const text = await file.text();
    const lowerName = file.name.toLowerCase();
    const lowerContent = text.slice(0, 500).toLowerCase();

    let type: AyahFileUpload['type'] = 'unknown';
    if (
      lowerName.includes('patient') ||
      lowerContent.includes('patient') ||
      lowerContent.includes('date_of_birth') ||
      lowerContent.includes('birth_date') ||
      lowerContent.includes('chart_id') ||
      lowerContent.includes('mrn')
    ) {
      type = 'patient_csv';
    } else if (
      lowerContent.includes('role') ||
      lowerContent.includes('hpcsa') ||
      lowerName.includes('staff') ||
      lowerName.includes('doctor') ||
      lowerName.includes('team')
    ) {
      type = 'staff_csv';
    }

    const upload: AyahFileUpload = { file, content: text, type };
    setPendingFile(upload);
    onFileUpload?.(upload);
  };

  const empty = hydrated && messages.length === 0 && !streaming;
  const primaryCommands = context.patientId
    ? PATIENT_COMMANDS.slice(0, 4)
    : PRACTICE_COMMANDS.slice(0, 4);
  const moreCommands = context.patientId
    ? PATIENT_COMMANDS.slice(4)
    : PRACTICE_COMMANDS.slice(4);
  const landingCommands = context.patientId
    ? PATIENT_COMMANDS.slice(0, 5)
    : PRACTICE_COMMANDS.slice(0, 5);
  const landingExtra = context.patientId
    ? PATIENT_COMMANDS.slice(5)
    : PRACTICE_COMMANDS.slice(5);
  const visibleDrafts = context.patientId
    ? pendingDrafts.filter((draft) => !draft.patientId || draft.patientId === context.patientId)
    : pendingDrafts;

  const placeholder = context.patientName
    ? `Ask about ${context.patientName.split(' ')[0]}…`
    : 'Ask a question...';

  const typewriterPhrases = context.patientName
    ? patientComposerPhrases(context.patientName.split(' ')[0])
    : PRACTICE_COMPOSER_PHRASES;

  const heading = context.patientName
    ? `How can I help with ${context.patientName.split(' ')[0]}?`
    : 'How can I help?';

  const submit = (text: string) => {
    if (pendingFile && onFileUpload) {
      onFileUpload(pendingFile);
      setPendingFile(null);
    }
    onSend(text);
  };

  const composerProps = {
    input,
    onInputChange,
    onSend: submit,
    streaming,
    placeholder,
    typewriterPhrases,
    pendingFile: pendingFile
      ? { file: pendingFile.file, label: fileKind(pendingFile.type) }
      : null,
    onClearFile: () => setPendingFile(null),
    onPickFile: () => fileInputRef.current?.click(),
    onVoiceMode,
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f6f3]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,.xlsx"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelect(file);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      {!empty || context.patientId ? (
        <AyahFadeIn className="px-5 py-4 lg:px-8" variant="subtle">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65758b]">
                Ayah
              </p>
              <h2 className="truncate font-heading text-xl font-semibold tracking-tight text-[#344256] sm:text-2xl">
                {context.patientName ?? 'Practice conversation'}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onNewConversation && !empty ? (
                <button
                  type="button"
                  onClick={onNewConversation}
                  className="rounded-full border border-[#e4e2de] bg-white px-3 py-1.5 text-xs font-medium text-[#6b7280] hover:text-[#1c2731]"
                >
                  New conversation
                </button>
              ) : null}
              {context.patientId ? (
                <button
                  type="button"
                  onClick={onClearPatient}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e4e2de] bg-white px-3 py-1.5 text-xs font-medium text-[#6b7280] hover:text-[#1c2731]"
                >
                  Close patient
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </AyahFadeIn>
      ) : null}

      {context.patientId ? (
        <div className="px-5 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <AyahChartSources patientName={context.patientName} />
          </div>
        </div>
      ) : null}

      {empty ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-8 lg:px-8">
          <div className="flex w-full max-w-[640px] flex-col gap-5">
            <div className="text-center">
              <AyahFadeIn delay={0}>
                <h3 className="font-heading text-3xl font-bold tracking-tight text-[#344256] sm:text-4xl">
                  {heading}
                </h3>
              </AyahFadeIn>
            </div>
            <AyahFadeIn delay={120}>
              <AyahComposer {...composerProps} tall />
            </AyahFadeIn>
            <CommandPills
              commands={landingCommands}
              extra={landingExtra}
              showMore={showMore}
              onToggleMore={() => setShowMore((open) => !open)}
              onCommand={onCommand}
              disabled={streaming}
              stagger
            />
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 lg:px-8">
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((message) => {
                const isUser = message.role === 'user';
                if (!isUser && !message.content && streaming) return null;
                return (
                  <article
                    key={message.id}
                    className={ayahMessageClass(
                      `flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`,
                    )}
                  >
                    {!isUser ? <AyahAvatar size="md" className="mb-5 shrink-0" /> : null}
                    <div className={`min-w-0 max-w-[92%] ${isUser ? 'text-right' : 'text-left'}`}>
                      <div
                        className={
                          isUser
                            ? 'inline-block rounded-2xl rounded-br-md bg-[#1c2731] px-4 py-2.5 text-left text-white'
                            : 'rounded-2xl bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(28,39,49,0.04)] ring-1 ring-[#eceae6]'
                        }
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                            {displayUserMessage(message.content)}
                          </p>
                        ) : message.content ? (
                          <AyahBriefingContent content={message.content} />
                        ) : (
                          <span className="text-sm text-[#6b7280]">…</span>
                        )}
                      </div>
                      <p className="mt-1 px-1 text-[11px] text-[#9aa3ad]">{message.time}</p>
                    </div>
                  </article>
                );
              })}

              {streaming &&
              messages.length > 0 &&
              messages[messages.length - 1]?.role === 'assistant' &&
              !messages[messages.length - 1]?.content ? (
                <div className={ayahMessageClass('flex items-end gap-2.5')}>
                  <AyahAvatar size="md" className="mb-1" />
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(28,39,49,0.04)] ring-1 ring-[#eceae6]">
                    <div className="flex items-center gap-2 text-sm text-[#65758b]">
                      <SparklesIcon className="h-4 w-4 animate-pulse text-[#427160]" />
                      Looking at the record…
                      <TypingIndicator />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="px-5 pb-5 pt-1 lg:px-8">
            <div className="mx-auto max-w-2xl">
              {onResolveDraft ? (
                <AyahDraftReview drafts={visibleDrafts} onResolve={onResolveDraft} />
              ) : null}
              <div className="mb-3">
                <CommandPills
                  commands={primaryCommands}
                  extra={moreCommands}
                  showMore={showMore}
                  onToggleMore={() => setShowMore((open) => !open)}
                  onCommand={onCommand}
                  disabled={streaming}
                />
              </div>
              <AyahComposer {...composerProps} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
