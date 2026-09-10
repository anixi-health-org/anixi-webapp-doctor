import type { DoctorDashboardWidget } from '../types/doctorDashboard';

const PANEL_TYPES = new Set(['schedule', 'attention', 'list', 'progress', 'sparkline', 'note']);

/** Merge loose stat tiles into a KPI row and assign balanced panel spans. */
export function normalizeDashboardLayout(widgets: DoctorDashboardWidget[]): DoctorDashboardWidget[] {
  const sorted = [...widgets]
    .filter((widget) => widget.type !== 'hero')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const merged: DoctorDashboardWidget[] = [];
  let index = 0;

  while (index < sorted.length) {
    const widget = sorted[index];

    if (widget.type === 'stat') {
      const group: DoctorDashboardWidget[] = [];
      while (index < sorted.length && sorted[index].type === 'stat') {
        group.push(sorted[index]);
        index += 1;
      }
      merged.push({
        id: `kpi-${group.map((item) => item.id).join('-')}`,
        type: 'stat_row',
        span: 12,
        order: merged.length,
        config: {
          stats: group.map((item) => ({
            label: item.title ?? 'Metric',
            accent: item.accent,
            dataBinding: item.dataBinding,
          })),
        },
      });
      continue;
    }

    merged.push({ ...widget, order: merged.length });
    index += 1;
  }

  const panels = merged.filter((widget) => PANEL_TYPES.has(widget.type));
  const panelCount = panels.length;
  const hasSchedule = panels.some((panel) => panel.type === 'schedule');

  return merged.map((widget) => {
    if (widget.type === 'stat' || widget.type === 'stat_row') {
      return { ...widget, span: 12 };
    }

    if (!PANEL_TYPES.has(widget.type)) {
      return widget;
    }

    if (panelCount === 1) {
      return { ...widget, span: 12 };
    }

    if (panelCount === 2) {
      if (hasSchedule && widget.type === 'schedule') {
        return { ...widget, span: 8 };
      }
      if (hasSchedule) {
        return { ...widget, span: 4 };
      }
      return { ...widget, span: 6 };
    }

    if (widget.type === 'attention') {
      return { ...widget, span: 12 };
    }
    if (widget.type === 'schedule') {
      return { ...widget, span: 8 };
    }
    return { ...widget, span: 6 };
  });
}
