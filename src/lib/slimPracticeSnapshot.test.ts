import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMPANION_PRACTICE_SNAPSHOT_PATIENT_CAP,
  slimPracticeSnapshotForCompanion,
} from './slimPracticeSnapshot';
import type { PracticeSnapshot } from '../hooks/useDoctorBriefingData';

describe('slimPracticeSnapshotForCompanion', () => {
  it('passes through small rosters unchanged', () => {
    const snapshot: PracticeSnapshot = {
      patients: [{ id: '1', displayName: 'A', status: 'active' }],
      todayAppointments: [],
      upcomingAppointments: [],
      pendingAppointments: 0,
      pendingPatientRequests: 0,
    };
    assert.deepEqual(slimPracticeSnapshotForCompanion(snapshot), snapshot);
  });

  it('caps large rosters and preserves totals in counts', () => {
    const patients = Array.from({ length: 200 }, (_, i) => ({
      id: `p${i}`,
      displayName: `Patient ${i}`,
      status: i === 0 ? 'active' : 'pending',
    }));
    const snapshot: PracticeSnapshot = {
      patients,
      todayAppointments: [
        { id: 'apt1', patientId: 'p0', patientName: 'Patient 0', status: 'confirmed' },
      ],
      upcomingAppointments: [],
      pendingAppointments: 1,
      pendingPatientRequests: 0,
    };
    const slim = slimPracticeSnapshotForCompanion(snapshot);
    assert.equal(slim.patients.length, COMPANION_PRACTICE_SNAPSHOT_PATIENT_CAP);
    assert.equal(slim.counts?.patients, 200);
    assert.equal(slim.counts?.patientsTruncated, true);
    assert.equal(slim.patients.some((p) => p.id === 'p0'), true);
  });
});
