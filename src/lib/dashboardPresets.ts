import type { DoctorDashboardLayout, DoctorDashboardWidget } from '../types/doctorDashboard';
import { normalizeDashboardLayout } from './dashboardLayout';

type Preset = Pick<DoctorDashboardLayout, 'title' | 'subtitle' | 'widgets'>;

export function matchDashboardPreset(prompt: string): Preset | null {
  const q = prompt.trim().toLowerCase();

  if (q.includes('reset') || q.includes('start fresh') || q.includes('clear')) {
    return PRESETS.reset;
  }
  if (q.includes('minimal') || (q.includes('schedule') && q.includes('attention'))) {
    return PRESETS.minimal;
  }
  if (q.includes('caseload') || (q.includes('stable') && q.includes('critical'))) {
    return PRESETS.caseload;
  }
  if (q.includes('pre-clinic') || q.includes('next 5') || q.includes('briefing board')) {
    return PRESETS.preClinic;
  }
  if (q.includes('follow-up') || q.includes('follow up')) {
    return PRESETS.followUps;
  }
  if (q.includes('morning') || q.includes('command center')) {
    return PRESETS.morning;
  }
  if (q.includes('appointment') || q.includes('appointments')) {
    return PRESETS.appointments;
  }
  return null;
}

/** Match starter prompts and infer layouts from natural-language dashboard requests. */
export function inferDashboardLayout(prompt: string): Preset | null {
  const exact = matchDashboardPreset(prompt);
  if (exact) return exact;

  const q = prompt.trim().toLowerCase();

  if (
    /appointment|appointments|schedule|calendar|booking|booked|clinic day/.test(q)
  ) {
    return PRESETS.appointments;
  }
  if (/patient|caseload|panel|roster|stable|critical/.test(q)) {
    return PRESETS.caseload;
  }
  if (/follow.?up|pending|needs attention|needs me|action item/.test(q)) {
    return PRESETS.followUps;
  }
  if (/brief|prepare|pre-clinic|before clinic|next patient/.test(q)) {
    return PRESETS.preClinic;
  }
  if (/dashboard|layout|build|create|design|show me|make me|set up/.test(q)) {
    return PRESETS.minimal;
  }

  return null;
}

const PRESETS: Record<string, Preset> = {
  reset: {
    title: 'My dashboard',
    subtitle: 'Tell Ayah what you want to see',
    widgets: [],
  },
  minimal: {
    title: "Today's clinic",
    subtitle: 'Schedule and who needs you',
    widgets: [
      {
        id: 'schedule-today',
        type: 'schedule',
        title: "Today's schedule",
        subtitle: 'Appointments for today',
        span: 8,
        order: 0,
        accent: 'green',
        dataBinding: 'today_appointments',
      },
      {
        id: 'needs-attention',
        type: 'attention',
        title: 'Needs attention',
        subtitle: 'Patients waiting on you',
        span: 4,
        order: 1,
        accent: 'amber',
        dataBinding: 'attention_items',
      },
    ],
  },
  morning: {
    title: 'Morning command center',
    subtitle: 'Everything you need before clinic starts',
    widgets: [
      {
        id: 'stats-row',
        type: 'stat_row',
        span: 12,
        order: 0,
        config: {
          stats: [
            { label: 'Total patients', accent: 'blue', dataBinding: 'patient_count' },
            { label: 'Stable', accent: 'green', dataBinding: 'stable_patients' },
            { label: 'Pending', accent: 'amber', dataBinding: 'pending_appointments' },
            { label: 'Growth', accent: 'teal', dataBinding: 'patient_growth' },
          ],
        },
      },
      {
        id: 'schedule',
        type: 'schedule',
        title: "Today's schedule",
        span: 8,
        order: 1,
        accent: 'green',
        dataBinding: 'today_appointments',
      },
      {
        id: 'attention',
        type: 'attention',
        title: 'Needs you',
        span: 4,
        order: 2,
        accent: 'amber',
        dataBinding: 'attention_items',
      },
      {
        id: 'next-patient',
        type: 'list',
        title: 'Up next',
        span: 12,
        order: 3,
        accent: 'teal',
        dataBinding: 'next_patient',
      },
    ],
  },
  caseload: {
    title: 'Caseload overview',
    subtitle: 'Stable vs critical at a glance',
    widgets: [
      {
        id: 'caseload-kpis',
        type: 'stat_row',
        span: 12,
        order: 0,
        config: {
          stats: [
            { label: 'Total patients', accent: 'blue', dataBinding: 'patient_count' },
            { label: 'Stable', accent: 'green', dataBinding: 'stable_patients' },
            { label: 'Critical', accent: 'rose', dataBinding: 'critical_patients' },
            { label: 'Inactive', accent: 'slate', dataBinding: 'inactive_patients' },
          ],
        },
      },
      {
        id: 'attendance',
        type: 'progress',
        title: 'Attendance rate',
        subtitle: 'Confirmed and completed today',
        span: 6,
        order: 1,
        accent: 'blue',
        dataBinding: 'attendance_rate',
      },
      {
        id: 'growth',
        type: 'sparkline',
        title: 'Patient growth',
        span: 6,
        order: 2,
        accent: 'teal',
        dataBinding: 'patient_growth',
        config: { points: [2, 3, 2, 5, 4, 6, 7] },
      },
      {
        id: 'recent',
        type: 'list',
        title: 'Recent patients',
        span: 12,
        order: 3,
        accent: 'green',
        dataBinding: 'recent_patients',
      },
    ],
  },
  preClinic: {
    title: 'Pre-clinic briefing',
    subtitle: 'Next patients and open items',
    widgets: [
      {
        id: 'next',
        type: 'list',
        title: 'Next up',
        span: 6,
        order: 0,
        dataBinding: 'next_patient',
        accent: 'teal',
      },
      {
        id: 'schedule-upcoming',
        type: 'schedule',
        title: 'Upcoming appointments',
        span: 6,
        order: 1,
        dataBinding: 'upcoming_appointments',
        accent: 'green',
      },
      {
        id: 'attention-pre',
        type: 'attention',
        title: 'Before you start',
        span: 12,
        order: 2,
        dataBinding: 'attention_items',
        accent: 'amber',
      },
    ],
  },
  appointments: {
    title: 'Appointments',
    subtitle: 'Today and upcoming across your practice',
    widgets: [
      {
        id: 'appt-kpis',
        type: 'stat_row',
        span: 12,
        order: 0,
        config: {
          stats: [
            { label: 'Today', accent: 'green', dataBinding: 'today_appointment_count' },
            { label: 'Upcoming', accent: 'teal', dataBinding: 'upcoming_appointment_count' },
            { label: 'Pending confirmation', accent: 'amber', dataBinding: 'pending_appointments' },
          ],
        },
      },
      {
        id: 'today-appointments',
        type: 'schedule',
        title: "Today's appointments",
        subtitle: 'Everyone booked for today',
        span: 8,
        order: 1,
        accent: 'green',
        dataBinding: 'today_appointments',
      },
      {
        id: 'next-patient-appt',
        type: 'list',
        title: 'Up next',
        span: 4,
        order: 2,
        accent: 'blue',
        dataBinding: 'next_patient',
      },
    ],
  },
  followUps: {
    title: 'Follow-up tracker',
    subtitle: 'Open items across your panel',
    widgets: [
      {
        id: 'followup-kpis',
        type: 'stat_row',
        span: 12,
        order: 0,
        config: {
          stats: [
            { label: 'Pending bookings', accent: 'amber', dataBinding: 'pending_appointments' },
            { label: 'Patient requests', accent: 'blue', dataBinding: 'pending_requests' },
            { label: 'Open items', accent: 'rose', dataBinding: 'attention_count' },
          ],
        },
      },
      {
        id: 'attention-follow',
        type: 'attention',
        title: 'Needs follow-up',
        subtitle: 'Patients and tasks waiting on you',
        span: 12,
        order: 1,
        accent: 'amber',
        dataBinding: 'attention_items',
      },
    ],
  },
};

/** Drop hero banners, normalize layout, and hydrate bindings. */
export function prepareDashboardWidgets(widgets: DoctorDashboardWidget[]): DoctorDashboardWidget[] {
  return hydratePresetWidgets(
    normalizeDashboardLayout(widgets).map((widget, index) => ({ ...widget, order: index })),
  );
}

/** Hydrate stat_row presets with live binding keys for client-side resolution. */
export function hydratePresetWidgets(widgets: DoctorDashboardWidget[]): DoctorDashboardWidget[] {
  return widgets.map((widget) => {
    if (widget.type !== 'stat_row' || !Array.isArray(widget.config?.stats)) {
      return widget;
    }
    const config = widget.config ?? {};
    const stats = (config.stats as Array<Record<string, unknown>>).map((stat, index) => {
      if (stat.dataBinding) return stat;
      const bindings = ['patient_count', 'stable_patients', 'pending_appointments', 'patient_growth'];
      return { ...stat, dataBinding: bindings[index] };
    });
    return { ...widget, config: { ...config, stats } };
  });
}

export function getPresetByKey(key: keyof typeof PRESETS): Preset {
  return PRESETS[key];
}
