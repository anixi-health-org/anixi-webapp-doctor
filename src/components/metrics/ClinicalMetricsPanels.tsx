import React from 'react';
import {
  attentionReasonLabel,
  type PatientClinicalMetrics,
  type RosterClinicalMetrics,
} from '../../services/clinicalMetricsService';
import { VitalSeverityBadge } from '../vitals/VitalSeverityBadge';

const Card: React.FC<{ label: string; value: string | number; hint?: string }> = ({
  label,
  value,
  hint,
}) => (
  <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-[#65758b]">{label}</p>
    <p className="mt-1.5 text-2xl font-bold text-[#344256]">{value}</p>
    {hint && <p className="mt-1 text-xs text-[#94a3b8]">{hint}</p>}
  </div>
);

export const RosterClinicalMetricsGrid: React.FC<{
  metrics: RosterClinicalMetrics;
}> = ({ metrics }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
    <Card label="Patients" value={metrics.patientCount} hint={`${metrics.daysBack}d window`} />
    <Card
      label="Needs attention"
      value={metrics.needingAttention}
      hint="Adherence, vitals, bookings"
    />
    <Card
      label="Avg adherence"
      value={metrics.avgAdherence != null ? `${metrics.avgAdherence}%` : '—'}
    />
    <Card
      label="Urgent vitals"
      value={metrics.vitalsUrgentPatients}
      hint={`${metrics.vitalsWarningPatients} with warnings`}
    />
    <Card
      label="Appointments"
      value={metrics.appointments.total}
      hint={`${metrics.appointments.completionRate}% completed`}
    />
    <Card label="Pending bookings" value={metrics.appointments.pending} />
    <Card label="Lab documents" value={metrics.labsDocuments} />
    <Card label="Symptom check-ins" value={metrics.symptomCheckIns} hint="Mood logs" />
    <Card label="Active treatments" value={metrics.activeTreatments} />
    <Card label="Chronic patients" value={metrics.chronicPatients} />
  </div>
);

export const PatientClinicalMetricsPanel: React.FC<{
  metrics: PatientClinicalMetrics;
}> = ({ metrics }) => (
  <div className="space-y-4">
    {metrics.needsAttention && (
      <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Needs attention</p>
        <p className="mt-1 flex flex-wrap gap-2">
          {metrics.attentionReasons.map((r) => (
            <span
              key={r}
              className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-100"
            >
              {attentionReasonLabel(r)}
            </span>
          ))}
        </p>
      </div>
    )}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Card
        label="Adherence"
        value={`${metrics.adherence.rate}%`}
        hint={`${metrics.adherence.band} · ${metrics.adherence.taken} taken`}
      />
      <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[#65758b]">Vitals</p>
          <VitalSeverityBadge severity={metrics.vitals.worst} />
        </div>
        <p className="mt-1.5 text-2xl font-bold text-[#344256]">{metrics.vitals.readings}</p>
        <p className="mt-1 text-xs text-[#94a3b8]">
          {metrics.vitals.urgent} urgent · {metrics.vitals.warning} warning
        </p>
      </div>
      <Card
        label="Appointments"
        value={metrics.appointments.total}
        hint={`${metrics.appointments.upcoming} upcoming · ${metrics.appointments.pending} pending`}
      />
      <Card label="Labs" value={metrics.labs.documentCount} hint="Lab-related files" />
      <Card label="Symptoms" value={metrics.symptoms.checkIns} hint="Mood / check-ins" />
      <Card
        label="Treatment"
        value={metrics.treatment.activeTreatments}
        hint={`${metrics.treatment.chronicConditions} conditions`}
      />
    </div>
  </div>
);
