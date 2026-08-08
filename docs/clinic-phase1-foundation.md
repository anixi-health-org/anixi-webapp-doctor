# Clinic / Practice Multi-Tenancy — Phase 1 Foundation

## What shipped

### Data model
- `Practice.orgType`: `solo` | `clinic`
- Expanded `PracticeRole`: owner, practice_manager, doctor, receptionist, billing_clerk, delegate
- Expanded `PracticePermissions`: managePatients, manageMembers, viewAllDoctors, viewBilling (+ existing scheduling flags)
- `PracticeInvite` + `practices/{id}/invites`
- `Patient.practiceId` for shared clinic patient pool
- Role permission presets in `src/lib/practiceRoles.ts`

### Seamless onboarding
1. **Join** (`/join`) — choose Private practitioner / Clinic / Invite / Caregiver
2. **Solo doctor** — existing register → credential onboarding → review
3. **Clinic owner** — register → **Clinic setup** (name, timezone, first location) → invite team → doctor profile
4. **Invite** — `/join/invite?practiceId=&inviteId=&token=` → create account or sign in → auto-join practice (no second practice auto-created)

### Team & access
- **Practice Settings → Team** — invite/revoke/change roles
- Auth skips solo auto-provision when `joinIntent` is clinic/invite
- Staff role supported for non-clinician portal members
- Firestore rules: practice patient access, invites, expanded member management

### Clinic operations foundations
- Multi-doctor booking: doctor picker when `viewAllDoctors`
- Practice patient pool listing (`practicePatientService`)
- Practice dashboard volume stats on clinic dashboards

## Still Phase 1 / next
- Full room/resource allocation UI
- Practice-wide calendar of all doctors (read path exists; UI still doctor-scoped in places)
- Medical aid claims (Phase 2)
- Deeper staff-only shell (nav tailored to receptionist vs doctor)

## Deploy notes
- Deploy updated `firestore.rules`
- Composite indexes may be needed for practice appointment count queries (fallback scan exists)
