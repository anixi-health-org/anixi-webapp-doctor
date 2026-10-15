import { classifyDashboardIntent } from './dashboardIntent';
import { inferDashboardLayout, prepareDashboardWidgets } from './dashboardPresets';

describe('classifyDashboardIntent', () => {
  it('maps all-appointments wording to the appointments board', () => {
    const intent = classifyDashboardIntent(
      'Create a dashboard for all my appointments',
    );
    expect(intent.kind).toBe('appointments');
    expect(intent.applyPreset).toBe(true);
  });

  it('does not collapse a custom request into a today-only board', () => {
    const intent = classifyDashboardIntent(
      'Build a board with my invoices next to team hours',
    );
    expect(intent.kind).toBe('custom');
    expect(intent.applyPreset).toBe(false);
    expect(inferDashboardLayout('Build a board with my invoices next to team hours')).toBeNull();
  });

  it('keeps reset, morning, and caseload distinct', () => {
    expect(classifyDashboardIntent('Reset my dashboard and start fresh').kind).toBe(
      'reset',
    );
    expect(classifyDashboardIntent('Build me a morning clinic command center').kind).toBe(
      'morning',
    );
    expect(
      classifyDashboardIntent(
        'Create a patient caseload overview with stable vs critical counts',
      ).kind,
    ).toBe('caseload');
  });
});

describe('appointments preset', () => {
  it('includes today and upcoming schedule widgets', () => {
    const preset = inferDashboardLayout('Create a dashboard for all my appointments');
    expect(preset?.title).toBe('Appointments');
    const widgets = prepareDashboardWidgets(preset?.widgets ?? []);
    const bindings = widgets.map((widget) => widget.dataBinding);
    expect(bindings).toContain('today_appointments');
    expect(bindings).toContain('upcoming_appointments');
    const schedules = widgets.filter((widget) => widget.type === 'schedule');
    expect(schedules).toHaveLength(2);
    expect(schedules.every((widget) => widget.span === 6)).toBe(true);
  });
});
