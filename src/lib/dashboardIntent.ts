export type DashboardIntentKind =
  | 'reset'
  | 'morning'
  | 'minimal'
  | 'appointments'
  | 'caseload'
  | 'preClinic'
  | 'followUps'
  | 'custom';

export type DashboardIntent = {
  kind: DashboardIntentKind;
  /** Known recipes apply immediately. Custom always goes to Ayah. */
  applyPreset: boolean;
  summary: string;
};

const RESET = /\b(reset|start fresh|clear( the)? dashboard|wipe|start over)\b/i;
const MORNING = /\b(morning|command centre|command center)\b/i;
const MINIMAL =
  /\bminimal(ist)?\b|\bjust\b.{0,40}\bschedule\b|\bschedule\b.{0,40}\b(attention|who needs)/i;
const APPOINTMENTS =
  /\b(appointment|appointments|booking|bookings|visit|visits|calendar)\b|\bwho('?s| is) booked\b|\ball my (clinic )?days?\b/i;
const CASELOAD =
  /\b(caseload|patient panel|roster|stable vs critical|stable and critical)\b/i;
const PRE_CLINIC =
  /\b(pre-?clinic|briefing board|next 5|prepare( me)? for clinic|before clinic)\b/i;
const FOLLOW_UP =
  /\b(follow-?up|open items?|needs follow|waiting on me|action items?)\b/i;
const BUILD =
  /\b(dashboard|layout|board|build|create|design|show me|make me|set up|add)\b/i;

export const DASHBOARD_BINDING_GUIDE = [
  'today_appointments — every visit on the clinic calendar day (schedule/list)',
  'upcoming_appointments — remaining visits from now onward, including later days (schedule/list)',
  'week_appointments — this Monday–Sunday book (schedule/list)',
  'all_appointments — full book excluding cancelled visits (schedule/list)',
  'today_appointment_count / upcoming_appointment_count / week_appointment_count / all_appointment_count — KPI numbers',
  'pending_appointments — unconfirmed booking requests (KPI)',
  'patient_count / stable_patients / critical_patients / inactive_patients',
  'pending_requests — patients waiting to join the panel',
  'attention_items / attention_count — work queue',
  'recent_patients / next_patient / patient_growth / attendance_rate',
].join('\n');

export const DASHBOARD_LAYOUT_RECIPES = [
  'All appointments: KPI row (today, upcoming, pending) + today schedule (span 6) + upcoming schedule (span 6). Never substitute “today only”.',
  'This week: KPI row (week count, today, pending) + week schedule (span 12).',
  'Morning command center: KPI row + today schedule (8) + attention (4) + next patient.',
  'Minimal: today schedule (8) + attention (4).',
  'Caseload: patient KPIs + attendance + growth + recent patients.',
  'Follow-up: pending KPIs + attention wall.',
  'Pre-clinic: next patient + upcoming schedule + attention.',
].join('\n');

export function classifyDashboardIntent(prompt: string): DashboardIntent {
  const q = prompt.trim();
  if (!q) {
    return {
      kind: 'custom',
      applyPreset: false,
      summary: 'Empty request.',
    };
  }

  if (RESET.test(q)) {
    return {
      kind: 'reset',
      applyPreset: true,
      summary: 'Clear the workspace and start from a blank dashboard.',
    };
  }
  if (MINIMAL.test(q)) {
    return {
      kind: 'minimal',
      applyPreset: true,
      summary: 'A quiet clinic board: today’s schedule plus who needs attention.',
    };
  }
  if (CASELOAD.test(q)) {
    return {
      kind: 'caseload',
      applyPreset: true,
      summary: 'Panel health: stable vs critical counts and recent patients.',
    };
  }
  if (PRE_CLINIC.test(q)) {
    return {
      kind: 'preClinic',
      applyPreset: true,
      summary: 'Pre-clinic briefing: next patients, upcoming visits, and open items.',
    };
  }
  if (FOLLOW_UP.test(q) && !APPOINTMENTS.test(q)) {
    return {
      kind: 'followUps',
      applyPreset: true,
      summary: 'Follow-up tracker for open items across the panel.',
    };
  }
  if (MORNING.test(q)) {
    return {
      kind: 'morning',
      applyPreset: true,
      summary: 'Morning command center before clinic starts.',
    };
  }
  if (APPOINTMENTS.test(q)) {
    return {
      kind: 'appointments',
      applyPreset: true,
      summary:
        'The full appointment book: today, upcoming/later days, and pending confirmation — not today’s clinic only.',
    };
  }

  return {
    kind: 'custom',
    applyPreset: false,
    summary: BUILD.test(q)
      ? `Custom dashboard request. Interpret literally: "${q}".`
      : `Unclassified dashboard request: "${q}". Infer the board they want from the wording.`,
  };
}

export function buildDashboardAyahBrief(
  prompt: string,
  intent: DashboardIntent,
  practiceSnapshot?: Record<string, unknown>,
): string {
  const counts = practiceSnapshot?.counts as Record<string, unknown> | undefined;
  const live = counts
    ? [
        `Today visits: ${counts.today ?? 'unknown'}`,
        `Upcoming from now: ${counts.upcoming ?? 'unknown'}`,
        `This week: ${counts.week ?? 'unknown'}`,
        `Pending confirmation: ${counts.pendingAppointments ?? 'unknown'}`,
        `Patients on panel: ${counts.patients ?? 'unknown'}`,
        `Attention items: ${counts.attention ?? 'unknown'}`,
      ].join('\n')
    : 'Live counts were not attached. Prefer dataBinding anyway; never invent patients.';

  return `${prompt}

You are designing this doctor's Anixi dashboard. Follow the request literally.

Interpreted intent: ${intent.kind}
${intent.summary}

Live practice snapshot:
${live}

Workflow:
1. Call get-doctor-dashboard first so you can keep boards they still want.
2. Choose widgets that match the request. Prefer dataBinding over static config.
3. Call upsert-doctor-dashboard (mode replace for a new board, merge/append to tweak).
4. Confirm in one short sentence. No JSON in chat.

Bindings:
${DASHBOARD_BINDING_GUIDE}

Recipes:
${DASHBOARD_LAYOUT_RECIPES}

Rules:
- "All my appointments" / "all appointments" means today AND later days AND pending — never a today-only board.
- If today is empty but upcoming is not, still include an upcoming schedule so later visits are visible.
- span is a 12-column grid. Two schedules sit at span 6 each.
- Do not invent patient names, counts, or findings.`;
}
