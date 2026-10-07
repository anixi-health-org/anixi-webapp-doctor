/**
 * Local/dev seed doctor login.
 * Used by `npm run seed:doctors` — do NOT use in production.
 */

export type SeedAuthRole = 'doctor' | 'staff' | 'caregiver';

export type SeedLogin = {
  email: string;
  password: string;
  displayName: string;
  role: SeedAuthRole;
  practiceRole?: string;
  notes?: string;
};

export const SEED_PASSWORD = 'Test12345!!';

export const SEED_DOCTOR_LOGINS: SeedLogin[] = [
  {
    email: 'doctor@test.com',
    password: SEED_PASSWORD,
    displayName: 'Test Doctor',
    role: 'doctor',
    practiceRole: 'doctor',
    notes: 'Primary local seed doctor',
  },
];

export function formatSeedLoginsTable(): string {
  const header = '| Email | Password | Auth role | Practice role |\n| --- | --- | --- | --- |';
  const rows = SEED_DOCTOR_LOGINS.map(
    (u) =>
      `| \`${u.email}\` | \`${u.password}\` | ${u.role} | ${u.practiceRole ?? '—'} |`
  );
  return [header, ...rows].join('\n');
}
