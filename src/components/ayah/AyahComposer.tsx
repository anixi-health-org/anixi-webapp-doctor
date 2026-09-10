import { ArrowRightIcon, PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React, { useState } from 'react';
import { AyahTypewriterPlaceholder } from './AyahTypewriterPlaceholder';

export type AyahComposerFile = {
  file: File;
  label: string;
};

type Props = {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  streaming: boolean;
  /** Static fallback when typewriter is off (e.g. while focused). */
  placeholder: string;
  /** Rotating typewriter phrases, Ayah composer fields only. */
  typewriterPhrases?: string[];
  tall?: boolean;
  compact?: boolean;
  /** Extra-tight dock sizing (dashboard footer). */
  dense?: boolean;
  pendingFile?: AyahComposerFile | null;
  onClearFile?: () => void;
  onPickFile?: () => void;
  className?: string;
};

type TextareaProps = {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  streaming: boolean;
  placeholder: string;
  typewriterPhrases?: string[];
  canSend: boolean;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  rows: number;
  className: string;
  typewriterClassName: string;
};

function AyahComposerTextarea({
  input,
  onInputChange,
  onSend,
  streaming,
  placeholder,
  typewriterPhrases,
  canSend,
  focused,
  onFocus,
  onBlur,
  rows,
  className,
  typewriterClassName,
}: TextareaProps) {
  const showTypewriter =
    Boolean(typewriterPhrases?.length) && !input && !focused && !streaming;

  return (
    <div className="relative min-w-0 flex-1">
      {showTypewriter ? (
        <AyahTypewriterPlaceholder
          phrases={typewriterPhrases!}
          enabled
          className={typewriterClassName}
        />
      ) : null}
      <textarea
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
        placeholder={showTypewriter ? '' : placeholder}
        rows={rows}
        disabled={streaming}
        aria-label={typewriterPhrases?.[0] ?? placeholder}
        className={className}
      />
    </div>
  );
}

export function AyahComposer({
  input,
  onInputChange,
  onSend,
  streaming,
  placeholder,
  typewriterPhrases,
  tall,
  compact,
  dense,
  pendingFile,
  onClearFile,
  onPickFile,
  className,
}: Props) {
  const [focused, setFocused] = useState(false);
  const canSend = !streaming && (input.trim().length > 0 || Boolean(pendingFile));

  const submit = () => {
    if (!canSend) return;
    onSend(input);
  };

  if (compact) {
    return (
      <form
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div
          className={clsx(
            'flex items-end gap-1.5 border bg-white transition-all duration-300 ease-out motion-reduce:transition-none',
            dense ? 'rounded-xl px-2 py-1' : 'rounded-2xl px-3 py-2 gap-2',
            focused
              ? 'border-[#427160]/30 shadow-[0_2px_16px_rgba(66,113,96,0.12)] motion-reduce:translate-y-0'
              : 'border-[#eceae6] shadow-[0_1px_2px_rgba(28,39,49,0.04)]',
          )}
        >
          <AyahComposerTextarea
            input={input}
            onInputChange={onInputChange}
            onSend={submit}
            streaming={streaming}
            placeholder={placeholder}
            typewriterPhrases={typewriterPhrases}
            canSend={canSend}
            focused={focused}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={1}
            typewriterClassName={dense ? 'px-0 py-1' : 'px-0 py-2'}
            className={clsx(
              'w-full resize-none bg-transparent text-[#344256] outline-none placeholder:text-[#94a3b8]',
              dense
                ? 'max-h-16 min-h-[32px] py-1 text-[13px] leading-snug'
                : 'max-h-24 min-h-[40px] py-2 text-[15px] leading-relaxed',
            )}
          />
          <button
            type="submit"
            disabled={!canSend}
            className={clsx(
              'mb-0.5 flex shrink-0 items-center justify-center rounded-full text-white transition-all duration-200',
              dense ? 'h-7 w-7' : 'h-9 w-9',
              canSend
                ? 'bg-[#427160] hover:scale-105 hover:bg-[#365c4e] active:scale-95'
                : 'bg-[#c5ccd3]',
            )}
          >
            <ArrowRightIcon className={dense ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={clsx(
          'rounded-[22px] border bg-white transition-all duration-300 ease-out motion-reduce:transition-none',
          focused
            ? '-translate-y-0.5 border-[#427160]/30 shadow-[0_4px_24px_rgba(66,113,96,0.12),0_12px_40px_rgba(28,39,49,0.08)] motion-reduce:translate-y-0'
            : clsx(
                'border-[#eceae6] shadow-[0_1px_2px_rgba(28,39,49,0.04),0_10px_28px_rgba(28,39,49,0.06)]',
                tall && 'animate-ayah-composer-breathe motion-reduce:animate-none',
              ),
        )}
      >
        {pendingFile ? (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-[#f4f3ef] px-3 py-1.5">
            <PaperClipIcon className="h-4 w-4 shrink-0 text-[#6b7280]" />
            <span className="min-w-0 truncate text-xs font-medium text-[#344256]">
              {pendingFile.file.name}
              <span className="ml-1 text-[#65758b]">({pendingFile.label})</span>
            </span>
            {onClearFile ? (
              <button
                type="button"
                onClick={onClearFile}
                className="ml-auto shrink-0 text-[#65758b] transition hover:text-red-500"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
        <AyahComposerTextarea
          input={input}
          onInputChange={onInputChange}
          onSend={submit}
          streaming={streaming}
          placeholder={placeholder}
          typewriterPhrases={typewriterPhrases}
          canSend={canSend}
          focused={focused}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={tall ? 5 : 3}
          typewriterClassName="px-5 pt-4"
          className={clsx(
            'w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-relaxed text-[#344256] outline-none transition-colors duration-200 placeholder:text-[#94a3b8]',
            tall ? 'min-h-[108px]' : 'min-h-[72px]',
            focused && 'placeholder:text-[#b0b6bd]',
          )}
        />
        <div
          className={clsx(
            'flex items-center px-4 pb-3.5',
            onPickFile ? 'justify-between' : 'justify-end',
          )}
        >
          {onPickFile ? (
            <button
              type="button"
              className="text-[#9aa3ad] transition-all duration-200 hover:scale-110 hover:text-[#427160]"
              tabIndex={-1}
              onClick={onPickFile}
            >
              <PaperClipIcon className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!canSend}
            className={clsx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200',
              canSend
                ? 'bg-[#427160] shadow-[0_2px_8px_rgba(66,113,96,0.35)] hover:scale-105 hover:bg-[#365c4e] active:scale-95 animate-ayah-send-ready motion-reduce:animate-none'
                : 'bg-[#c5ccd3]',
            )}
          >
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
