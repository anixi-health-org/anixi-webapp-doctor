export type DashboardWidgetType =
  | 'hero'
  | 'stat'
  | 'stat_row'
  | 'list'
  | 'schedule'
  | 'attention'
  | 'progress'
  | 'note'
  | 'divider'
  | 'sparkline';

export type DashboardAccent = 'green' | 'blue' | 'amber' | 'rose' | 'slate' | 'teal';

export type DashboardDataBinding =
  | 'today_appointments'
  | 'upcoming_appointments'
  | 'patient_count'
  | 'stable_patients'
  | 'critical_patients'
  | 'inactive_patients'
  | 'pending_requests'
  | 'pending_appointments'
  | 'attention_items'
  | 'recent_patients'
  | 'next_patient'
  | 'patient_growth'
  | 'attendance_rate'
  | 'attention_count'
  | 'today_appointment_count'
  | 'upcoming_appointment_count'
  | 'week_appointments'
  | 'week_appointment_count'
  | 'all_appointments'
  | 'all_appointment_count';

export type DoctorDashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title?: string;
  subtitle?: string;
  span?: 3 | 4 | 6 | 8 | 12;
  order?: number;
  accent?: DashboardAccent;
  dataBinding?: DashboardDataBinding | string;
  config?: Record<string, unknown>;
};

export type DoctorDashboardLayout = {
  id: string;
  title: string;
  subtitle?: string;
  theme?: 'light' | 'minimal' | 'contrast';
  widgets: DoctorDashboardWidget[];
  updatedAt?: Date;
  createdBy?: 'ayah' | 'doctor';
};

/** One saved board inside the doctor's Ayah workspace. */
export type DoctorDashboardBoard = DoctorDashboardLayout;

export type DoctorDashboardWorkspace = {
  activeBoardId: string | null;
  boards: DoctorDashboardBoard[];
  updatedAt?: Date;
};

export const DASHBOARD_STARTER_PROMPTS = [
  'Build me a morning clinic command center',
  'I want a minimalist dashboard, just today’s schedule and who needs attention',
  'Create a dashboard for all my appointments',
  'Create a patient caseload overview with stable vs critical counts',
  'Design a pre-clinic briefing board for my next 5 patients',
  'Make a follow-up tracker dashboard',
  'Reset my dashboard and start fresh',
] as const;
