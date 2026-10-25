# Seed doctor login (local only)

Set in `.env.local` (not committed):

- `REACT_APP_SEED_DOCTOR_EMAIL` (default `doctor@test.com`)
- `REACT_APP_SEED_DOCTOR_PASSWORD` (required for seed; use a local-only test password)

```bash
# Django must be running
npm run seed:doctors
```
