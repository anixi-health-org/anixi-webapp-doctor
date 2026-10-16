import type { PracticeRole } from '../types';
import type { StoredAyahMessage } from './ayahChatStorage';
import { practiceMemberGreetingLabel } from './practiceMemberDisplay';

export const AYAH_WELCOME_MESSAGE_ID = 'welcome';

function formatTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function ayahDoctorGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function ayahDoctorWelcomeContent(options: {
  greeting?: string;
  displayName?: string;
  patientName?: string;
  practiceRoles?: PracticeRole[];
}): string {
  const greeting = options.greeting ?? ayahDoctorGreeting();
  const roles = options.practiceRoles ?? [];
  const nameLabel = practiceMemberGreetingLabel(options.displayName, roles);
  if (options.patientName) {
    const patientFirst = options.patientName.trim().split(/\s+/)[0];
    return `${greeting}, ${nameLabel}. I'm Ayah. I can help you prepare for ${patientFirst}, review the chart, or draft notes — just tell me what you need when you're ready.`;
  }
  return `${greeting}, ${nameLabel}. I'm Ayah, your clinical copilot. Ask about your panel, a patient, or today's visits — I'm here whenever you need me.`;
}

export function buildAyahDoctorWelcomeMessage(options: {
  displayName?: string;
  patientName?: string;
  practiceRoles?: PracticeRole[];
}): StoredAyahMessage {
  return {
    id: AYAH_WELCOME_MESSAGE_ID,
    role: 'assistant',
    content: ayahDoctorWelcomeContent(options),
    time: formatTime(),
  };
}

export function isAyahWelcomeMessage(message: StoredAyahMessage): boolean {
  return message.id === AYAH_WELCOME_MESSAGE_ID;
}

/** Sessions that only contain an auto-generated morning briefing (pre-welcome UX). */
export function isLegacyAutoBriefSession(messages: StoredAyahMessage[]): boolean {
  if (messages.length === 0) return false;
  if (messages.some((message) => message.role === 'user')) return false;
  if (messages.every(isAyahWelcomeMessage)) return false;

  const assistantText = messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content)
    .join('\n')
    .trim();
  if (!assistantText) return false;

  return (
    /practice briefing/i.test(assistantText) ||
    (/\bTODAY\b/.test(assistantText) &&
      /\b(ATTENTION|UPCOMING|NEEDS YOU)\b/.test(assistantText))
  );
}
