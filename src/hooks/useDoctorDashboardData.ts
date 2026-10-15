import { useMemo, useEffect, useState } from 'react';
import { getDoctorPatientGrowth, type DoctorPatientGrowth } from '../services/patientManagementService';
import { useDoctorBriefingData } from './useDoctorBriefingData';
import { useAuth } from './useAuth';
import {
  allOpenAppointments,
  toDashboardAppointmentItem,
  type DashboardListItem,
} from '../lib/dashboardAppointmentItems';
import { detectBrowserTimezone } from '../lib/timezones';

export type { DashboardListItem };

export type DashboardResolvedData = {
  stats: Record<string, string | number>;
  lists: Record<string, DashboardListItem[]>;
  notes: Record<string, string>;
};

export function useDoctorDashboardData() {
  const { user, practiceSession } = useAuth();
  const { snapshot, loading: briefingLoading } = useDoctorBriefingData();
  const [growth, setGrowth] = useState<DoctorPatientGrowth | null>(null);
  const timeZone =
    practiceSession?.practice?.timezone?.trim() || detectBrowserTimezone();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getDoctorPatientGrowth(user.id)
      .then((g) => {
        if (!cancelled) setGrowth(g);
      })
      .catch(() => {
        if (!cancelled) setGrowth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, snapshot.totalPatients]);

  const criticalCount = useMemo(
    () => snapshot.patients.filter((p) => p.status === 'critical').length,
    [snapshot.patients],
  );

  const inactiveCount = useMemo(
    () => snapshot.patients.filter((p) => p.status === 'inactive').length,
    [snapshot.patients],
  );

  const attendanceRate = useMemo(() => {
    const today = snapshot.todayAppointments;
    if (!today.length) return 0;
    const ok = today.filter(
      (a) => a.status === 'completed' || a.status === 'confirmed',
    ).length;
    return Math.round((ok / today.length) * 100);
  }, [snapshot.todayAppointments]);

  const resolved = useMemo<DashboardResolvedData>(() => {
    const growthLabel =
      growth?.changePct != null
        ? `${growth.changePct > 0 ? '+' : ''}${growth.changePct}%`
        : growth
          ? `+${growth.addedThisMonth}`
          : '-';

    const booked = [
      ...snapshot.todayAppointments,
      ...snapshot.upcomingAppointments,
    ].filter(
      (apt, index, rows) => rows.findIndex((row) => row.id === apt.id) === index,
    );
    const allOpen = allOpenAppointments(booked);

    const stats: Record<string, string | number> = {
      patient_count: snapshot.totalPatients,
      stable_patients: snapshot.stablePatients,
      critical_patients: criticalCount,
      inactive_patients: inactiveCount,
      pending_requests: snapshot.pendingPatientRequests,
      pending_appointments: snapshot.pendingAppointments,
      patient_growth: growthLabel,
      attendance_rate: `${attendanceRate}%`,
      attention_count: snapshot.attentionItems.length,
      today_appointment_count: snapshot.todayAppointments.length,
      upcoming_appointment_count: snapshot.upcomingAppointments.length,
      week_appointment_count: snapshot.weekAppointments.length,
      all_appointment_count: allOpen.length,
    };

    const todayItems = snapshot.todayAppointments.map((apt) =>
      toDashboardAppointmentItem(apt, timeZone, false),
    );
    const upcomingItems = snapshot.upcomingAppointments.map((apt) =>
      toDashboardAppointmentItem(apt, timeZone, true),
    );
    const weekItems = snapshot.weekAppointments.map((apt) =>
      toDashboardAppointmentItem(apt, timeZone, true),
    );
    const allItems = allOpen.map((apt) =>
      toDashboardAppointmentItem(apt, timeZone, true),
    );

    const attentionItems: DashboardListItem[] = snapshot.attentionItems.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.detail,
      badge: item.tone,
      tone: item.tone,
    }));

    const recentPatients: DashboardListItem[] = snapshot.patients.slice(0, 8).map((p) => ({
      id: p.id,
      title: p.displayName,
      subtitle: p.chronicConditions?.slice(0, 2).join(', ') || p.status,
      badge: p.status,
      tone:
        p.status === 'critical' ? 'urgent' : p.status === 'recovering' ? 'soon' : 'neutral',
    }));

    const nextPatient = snapshot.nextAppointment
      ? [
          {
            id: snapshot.nextAppointment.id,
            title: snapshot.nextAppointment.patientName || 'Next patient',
            subtitle: snapshot.nextAppointment.time
              ? `Today at ${snapshot.nextAppointment.time}`
              : 'Up next',
            badge: snapshot.nextAppointment.status,
          },
        ]
      : [];

    const lists: Record<string, DashboardListItem[]> = {
      today_appointments: todayItems,
      upcoming_appointments: upcomingItems,
      week_appointments: weekItems,
      all_appointments: allItems,
      attention_items: attentionItems,
      recent_patients: recentPatients,
      next_patient: nextPatient,
    };

    return { stats, lists, notes: {} };
  }, [
    attendanceRate,
    criticalCount,
    growth,
    inactiveCount,
    snapshot,
    timeZone,
  ]);

  return { resolved, loading: briefingLoading, snapshot };
}

export function resolveWidgetStat(
  binding: string | undefined,
  config: Record<string, unknown> | undefined,
  resolved: DashboardResolvedData,
): { value: string; hint?: string } {
  if (binding && resolved.stats[binding] != null) {
    return {
      value: String(resolved.stats[binding]),
      hint: config?.hint as string | undefined,
    };
  }
  return {
    value: String(config?.value ?? '-'),
    hint: (config?.hint as string | undefined) ?? undefined,
  };
}

export function resolveWidgetList(
  binding: string | undefined,
  config: Record<string, unknown> | undefined,
  resolved: DashboardResolvedData,
): DashboardListItem[] {
  if (binding && Object.prototype.hasOwnProperty.call(resolved.lists, binding)) {
    return resolved.lists[binding];
  }
  const items = config?.items;
  if (Array.isArray(items)) {
    return items.map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        id: String(row.id ?? index),
        title: String(row.title ?? 'Item'),
        subtitle: row.subtitle ? String(row.subtitle) : undefined,
        badge: row.badge ? String(row.badge) : undefined,
        tone: row.tone as DashboardListItem['tone'],
      };
    });
  }
  return [];
}
