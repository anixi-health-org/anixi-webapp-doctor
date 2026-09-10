import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
  Squares2X2Icon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { DASHBOARD_STARTER_PROMPTS } from '../types/doctorDashboard';

export type DashboardStarterPrompt = {
  prompt: string;
  shortLabel: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const DASHBOARD_STARTERS: DashboardStarterPrompt[] = [
  {
    prompt: DASHBOARD_STARTER_PROMPTS[0],
    shortLabel: 'Morning command center',
    icon: SparklesIcon,
  },
  {
    prompt: DASHBOARD_STARTER_PROMPTS[1],
    shortLabel: 'Minimal schedule',
    icon: Squares2X2Icon,
  },
  {
    prompt: DASHBOARD_STARTER_PROMPTS[2],
    shortLabel: 'All appointments',
    icon: CalendarIcon,
  },
  {
    prompt: DASHBOARD_STARTER_PROMPTS[3],
    shortLabel: 'Caseload overview',
    icon: ChartBarIcon,
  },
  {
    prompt: DASHBOARD_STARTER_PROMPTS[4],
    shortLabel: 'Pre-clinic briefing',
    icon: CalendarDaysIcon,
  },
  {
    prompt: DASHBOARD_STARTER_PROMPTS[5],
    shortLabel: 'Follow-up tracker',
    icon: ClipboardDocumentListIcon,
  },
  {
    prompt: DASHBOARD_STARTER_PROMPTS[6],
    shortLabel: 'Reset dashboard',
    icon: ArrowPathIcon,
  },
];
