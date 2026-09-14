import { isBookableClinician, isClinicianRole } from './practiceRoles';
import type { PracticeMember, PracticeRole } from '../types';

const member = (role: PracticeRole, extras: Partial<PracticeMember> = {}): PracticeMember =>
  ({
    uid: `${role}-1`,
    practiceId: 'practice-1',
    role,
    permissions: {} as PracticeMember['permissions'],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extras,
  });

describe('isClinicianRole', () => {
  it('includes doctors, nurses, allied health, and locums', () => {
    expect(isClinicianRole('doctor')).toBe(true);
    expect(isClinicianRole('nurse')).toBe(true);
    expect(isClinicianRole('allied_health')).toBe(true);
    expect(isClinicianRole('locum')).toBe(true);
  });

  it('excludes clinic ops roles', () => {
    expect(isClinicianRole('owner')).toBe(false);
    expect(isClinicianRole('practice_manager')).toBe(false);
    expect(isClinicianRole('receptionist')).toBe(false);
    expect(isClinicianRole('billing_clerk')).toBe(false);
  });
});

describe('isBookableClinician', () => {
  it('keeps practicing clinicians on the diary', () => {
    expect(isBookableClinician(member('doctor'))).toBe(true);
    expect(isBookableClinician(member('nurse'))).toBe(true);
    expect(isBookableClinician(member('locum', { isClinician: true }))).toBe(true);
  });

  it('excludes administrators, receptionists, and other ops staff', () => {
    expect(isBookableClinician(member('owner'))).toBe(false);
    expect(isBookableClinician(member('owner', { isClinician: true }))).toBe(false);
    expect(isBookableClinician(member('practice_manager', { isClinician: true }))).toBe(false);
    expect(isBookableClinician(member('receptionist', { isClinician: true }))).toBe(false);
    expect(isBookableClinician(member('billing_clerk'))).toBe(false);
  });

  it('excludes inactive clinicians and people marked not bookable', () => {
    expect(isBookableClinician(member('doctor', { status: 'inactive' }))).toBe(false);
    expect(isBookableClinician(member('doctor', { isClinician: false }))).toBe(false);
  });
});
