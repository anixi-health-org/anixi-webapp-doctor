import type { StoredAyahMessage } from './ayahChatStorage';
import { ayahDoctorGreeting } from './ayahDoctorWelcome';

function formatTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function buildAyahClinicWelcomeMessage(options: {
  displayName?: string;
}): StoredAyahMessage {
  const greeting = ayahDoctorGreeting();
  const firstName = options.displayName?.trim().split(/\s+/)[0] || 'there';
  return {
    id: 'welcome',
    role: 'assistant',
    content: `${greeting}, ${firstName}. I'm Ayah for clinic operations — I can handle roster, team, schedule, room bookings, billing, and more. Ready whenever you're!`,
    time: formatTime(),
  };
}
