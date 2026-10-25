import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { CaregiverPatientDetailSkeleton } from '../../components/ui/Skeleton';
import { TabPill } from '../../components/ui/TabPill';
import { MedicationAdherenceCalendar } from '../../components/dashboard/MedicationAdherenceCalendar';
import { MoodCalendar } from '../../components/MoodCalendar';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchCaregiverPatientDetail,
  revokeCaregiverPatientLink,
  type CaregiverLatestVitals,
  type CaregiverUpcomingAppointment,
} from '../../services/caregiverService';
import { getAdherenceStats } from '../../services/adherenceService';
import { Patient } from '../../types';
import { calculateAge } from '../../utils/dataFormatter';

type Tab = 'overview' | 'adherence' | 'mood' | 'vitals';

export const CaregiverPatientDetailPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [adherenceRate, setAdherenceRate] = useState<number | null>(null);
  const [latestVitals, setLatestVitals] = useState<CaregiverLatestVitals | null>(null);
  const [upcoming, setUpcoming] = useState<CaregiverUpcomingAppointment[]>([]);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!patientId || !user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchCaregiverPatientDetail(patientId);
        if (cancelled) return;
        if (!detail) {
          setError('Patient record not found.');
          return;
        }
        setPatient(detail.patient);
        setLatestVitals(detail.latestVitals);
        setUpcoming(detail.upcomingAppointments);
      } catch {
        if (!cancelled) setError('You do not have access to this patient.');
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Adherence is a secondary stat; a failure here must not hide the patient.
      try {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const stats = await getAdherenceStats(
          patientId,
          thirtyDaysAgo.toISOString().split('T')[0],
          today.toISOString().split('T')[0],
        );
        if (!cancelled) setAdherenceRate(stats.totalDays > 0 ? stats.averageAdherence : null);
      } catch {
        if (!cancelled) setAdherenceRate(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [patientId, user?.id]);

  const stopFollowing = async () => {
    if (!patientId) return;
    if (!window.confirm('Stop following this patient? They can invite you again from the Anixi app.')) return;
    setLeaving(true);
    try {
      await revokeCaregiverPatientLink(patientId);
      navigate('/caregiver/patients', { replace: true });
    } catch {
      setError('Could not update this link. Try again.');
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell className="max-w-6xl">
        <CaregiverPatientDetailSkeleton />
      </PageShell>
    );
  }

  if (error || !patient) {
    return (
      <PageShell className="max-w-3xl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error || 'Patient not found'}</p>
          <Link to="/caregiver/patients" className="mt-4 inline-block text-sm font-medium text-anixi-green hover:underline">
            Back to patients
          </Link>
        </div>
      </PageShell>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'adherence', label: 'Medications' },
    { id: 'mood', label: 'Mood' },
    { id: 'vitals', label: 'Vitals' },
  ];

  return (
    <PageShell className="max-w-6xl">
      <button
        type="button"
        onClick={() => navigate('/caregiver/patients')}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-anixi-green hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to patients
      </button>

      <PageHeader
        title={patient.displayName || 'Patient'}
        description={patient.email}
        badge={
          adherenceRate !== null ? (
            <span className="rounded-full bg-anixi-green/10 px-3 py-1 text-xs font-semibold text-anixi-green">
              {Math.round(adherenceRate)}% adherence (30d)
            </span>
          ) : undefined
        }
        actions={
          <button
            type="button"
            onClick={() => void stopFollowing()}
            disabled={leaving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {leaving ? 'Updating…' : 'Stop following'}
          </button>
        }
      />

      <div className="mb-6 flex gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
        {tabs.map((tab) => (
          <TabPill
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="min-w-0 flex-1 px-2 py-2.5 text-center text-xs sm:text-sm"
          >
            {tab.label}
          </TabPill>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {patient.dateOfBirth && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Age</span>
                  <span className="font-medium text-gray-900">{calculateAge(patient.dateOfBirth)}</span>
                </div>
              )}
              {patient.gender && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Gender</span>
                  <span className="font-medium capitalize text-gray-900">{patient.gender}</span>
                </div>
              )}
              {patient.phoneNumber && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Phone</span>
                  <span className="font-medium text-gray-900">{patient.phoneNumber}</span>
                </div>
              )}
              {patient.emergencyContact && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Emergency contact</p>
                  <p className="mt-1 font-medium text-gray-900">{patient.emergencyContact.name}</p>
                  <p className="text-gray-600">{patient.emergencyContact.phone}</p>
                  <p className="text-xs text-gray-500">{patient.emergencyContact.relationship}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Health summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {patient.chronicDiseases && patient.chronicDiseases.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Conditions</p>
                  <div className="flex flex-wrap gap-2">
                    {patient.chronicDiseases.map((c) => (
                      <span key={c} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {patient.allergies && patient.allergies.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Allergies</p>
                  <div className="flex flex-wrap gap-2">
                    {patient.allergies.map((a) => (
                      <span key={a} className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {latestVitals && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">BP</p>
                    <p className="font-semibold text-gray-900">{latestVitals.bloodPressure || '-'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">HR</p>
                    <p className="font-semibold text-gray-900">{latestVitals.heartRate ?? '-'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Glucose</p>
                    <p className="font-semibold text-gray-900">{latestVitals.glucose ?? '-'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Upcoming visits</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming visits booked.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {upcoming.map((visit) => (
                    <li key={visit.id} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="font-medium text-gray-900">{visit.doctorName || 'Doctor'}</span>
                      <span className="text-gray-600">
                        {new Date(visit.startAt).toLocaleString('en-ZA', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'adherence' && patientId && (
        <Card>
          <CardHeader>
            <CardTitle>Medication adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <MedicationAdherenceCalendar patientId={patientId} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'mood' && patientId && (
        <Card>
          <CardHeader>
            <CardTitle>Mood tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <MoodCalendar patientId={patientId} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'vitals' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent vitals</CardTitle>
          </CardHeader>
          <CardContent>
            {latestVitals ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">Blood pressure</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{latestVitals.bloodPressure || '-'}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">Heart rate</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {latestVitals.heartRate ? `${latestVitals.heartRate} bpm` : '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-5">
                  <p className="text-sm text-gray-500">Glucose</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{latestVitals.glucose ?? '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No vitals recorded yet for this patient.</p>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
};
