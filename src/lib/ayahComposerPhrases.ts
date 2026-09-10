import { PATIENT_COMMANDS, PRACTICE_COMMANDS } from './ayahCommands';
import { DASHBOARD_STARTERS } from './dashboardStarterPrompts';

export const PRACTICE_COMPOSER_PHRASES = [
  'Ask a question…',
  ...PRACTICE_COMMANDS.map((command) => command.label),
];

export function patientComposerPhrases(firstName: string): string[] {
  const name = firstName.trim() || 'this patient';
  return [
    `Ask about ${name}…`,
    ...PATIENT_COMMANDS.map((command) => command.label),
  ];
}

export const DASHBOARD_LANDING_PHRASES = [
  'Describe the dashboard you want…',
  ...DASHBOARD_STARTERS.filter((starter) => starter.shortLabel !== 'Reset dashboard').map(
    (starter) => starter.prompt,
  ),
];

export const DASHBOARD_DOCK_PHRASES = [
  'e.g. Add a follow-up tracker next to my schedule…',
  'Show all my appointments on one board',
  'Add a caseload overview widget',
  'Make the schedule widget wider',
  'Reset my dashboard and start fresh',
];
