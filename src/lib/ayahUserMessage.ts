import { PATIENT_COMMANDS, PRACTICE_COMMANDS } from './ayahCommands';

const COMMANDS = [...PATIENT_COMMANDS, ...PRACTICE_COMMANDS];

/** Show the short command label instead of the internal prompt. */
export function displayUserMessage(content: string): string {
  const trimmed = content.trim();
  const match = COMMANDS.find(
    (command) =>
      trimmed === command.prompt ||
      trimmed.startsWith(command.prompt.slice(0, 48)) ||
      trimmed.includes(command.prompt.slice(0, 36)),
  );
  if (match) return match.label;
  if (trimmed.length > 160 && /use list-|use compare-|use prepare-|plain text only/i.test(trimmed)) {
    return trimmed.split(/[.?\n]/)[0]?.trim() || trimmed.slice(0, 80);
  }
  return trimmed;
}
