# Anixi Health — Doctor Portal

The **Doctor Portal** is the clinician-facing web application of the [Anixi Health](https://anixihealth.com) ecosystem — a complete chronic-care platform built for Africa. It gives doctors and their delegated caregivers a single, secure workspace to support patients ("Warriors") living with chronic conditions between visits: managing appointments, tracking medication adherence, mood and vitals, issuing invoices and referrals, and collaborating with caregivers and the Ayah AI companion.

This portal is part of a three-portal ecosystem:

| Surface | Audience | Stack |
| --- | --- | --- |
| **Doctor Portal** (this repo) | Doctors & caregivers | React + CRA |
| Admin Panel | Anixi operations team | Angular |
| Mobile app | Patients / Warriors | React Native (Expo) |

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Authentication & roles](#authentication--roles)
- [Deployment](#deployment)
- [Branching & workflow](#branching--workflow)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Patient management** — searchable patient list, full health dashboards, profiles, and status tracking.
- **Appointments & scheduling** — book, reschedule, and summarise appointments with a dedicated scheduling service.
- **Virtual teleconsult (LiveKit)** — join video visits for Virtual / teleconsult appointments from the doctor portal; WhatsApp/Phone consults show as Coming soon.
- **Practice calendar** — a grid calendar view of the doctor's practice availability and bookings.
- **Medication adherence** — daily, calendar, and log views with rich detail panels and an adherence data generator.
- **Mood & vitals tracking** — mood checker, mood calendar, and vitals history for longitudinal insight.
- **Consultation workspace** — capture notes, documents, and follow-ups during a visit and generate PDFs.
- **Invoicing** — create, list, and view invoices, with PDF export (`jspdf`) and per-doctor currency support.
- **Referrals** — generate and share referral links between providers.
- **Caregiver collaboration** — delegate access to caregivers with scoped, permission-based routes (`CaregiverRoute`, delegate accept flow).
- **Patient data sharing** — handle incoming/outgoing sharing requests between doctors and patients.
- **Doctor onboarding** — register, join, and complete a professional profile with logo upload and cropping.
- **Support & account** — support requests, change password, and account deletion flows.

## Tech stack

- **Framework:** [React 19](https://react.dev/) via [Create React App](https://create-react-app.dev/) (`react-scripts` 5)
- **Language:** TypeScript 4.9
- **Routing:** React Router 7 (`react-router-dom`)
- **Styling:** Tailwind CSS 3, `tailwind-merge`, `clsx`, custom brand theme (Lora + Inter fonts)
- **Backend / data:** Firebase 12 — Authentication, Cloud Firestore, Storage; Firebase Data Connect (`@dataconnect/generated`)
- **State & data fetching:** [Zustand](https://github.com/pmndrs/zustand) (client state) + [TanStack Query](https://tanstack.com/query) (server state)
- **UI & icons:** Headless UI, Heroicons, `lucide-react`
- **Utilities:** `date-fns`, `jspdf` (PDF generation), `react-easy-crop` (image cropping)

## Prerequisites

- **Node.js 18+** (Node 20 LTS recommended)
- **npm 9+**
- Access to the shared **Firebase project** (`anixihealth24`)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (http://localhost:3000)
npm run dev

# 3. Create a production build
npm run build
```

The dev server runs on **http://localhost:3000** and hot-reloads on save.

## Configuration

Firebase is initialised in `src/lib/firebase.ts` and exports `auth`, `db`, and `storage`:

```ts
const firebaseConfig = {
  apiKey: "…",
  authDomain: "anixihealth24.firebaseapp.com",
  projectId: "anixihealth24",
  storageBucket: "anixihealth24.appspot.com",
  messagingSenderId: "…",
  appId: "…",
};
```

> These are **client-side Firebase keys** — they are safe to ship in the bundle; access is enforced by Firestore/Storage security rules, not by hiding the keys. To point the portal at a different Firebase project, update the config in `src/lib/firebase.ts`.

### LiveKit teleconsult (Cloud Functions)

Video tokens are minted by Firebase callables in `anixi-mobile-expo/functions` (`getTeleconsultToken`, `endTeleconsult`, region `europe-west1`). Set these secrets before deploy:

```bash
cd anixi-mobile-expo/functions
firebase functions:secrets:set LIVEKIT_URL
firebase functions:secrets:set LIVEKIT_API_KEY
firebase functions:secrets:set LIVEKIT_API_SECRET
npm run build
firebase deploy --only functions:getTeleconsultToken,functions:endTeleconsult
```

`LIVEKIT_URL` should be your LiveKit Cloud WebSocket URL (e.g. `wss://your-project.livekit.cloud`). Without these secrets the Join flow returns a clear configuration error.

Doctor web joins at `/teleconsult/:appointmentId`. Ending the call marks `teleconsult.status = ended` and routes to the consultation workspace. Patient mobile join is not wired yet.

Firestore collection paths are centralised in `src/shared/firestorePaths.ts`.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` / `npm start` | Start the CRA dev server on port 3000 |
| `npm run build` | Produce an optimised production build in `build/` |
| `npm test` | Run the Jest + React Testing Library test suite |
| `npm run eject` | Eject CRA config (irreversible — avoid) |

## Project structure

```
src/
├── App.tsx                # Root component & route definitions
├── index.tsx             # App entry point
├── components/           # Reusable UI (auth, brand, dashboard, patients,
│                         #   appointments, calendar, caregiver, notifications, ui, …)
├── pages/                # Route-level screens (Login, Register, Dashboard,
│                         #   Patients, Invoices, PracticeCalendar, PostConsult, …)
│   └── caregiver/        # Caregiver-scoped pages
├── hooks/                # React hooks (useAuth, usePermissions, queries, …)
│   └── queries/          # TanStack Query hooks
├── services/             # Firebase-backed domain services (patients, appointments,
│                         #   invoices, adherence, scheduling, sharing, permissions, …)
├── store/                # Zustand stores (authStore)
├── lib/                  # Firebase init, currency, mappers, adapters
├── shared/               # Shared constants & Firestore paths
├── types/                # TypeScript types (auth, doctorProfile, permissions)
├── constants/            # Static data (countries)
├── utils/                # Formatters & image cropping helpers
└── styles/               # Global animations & CSS
```

## Authentication & roles

- Authentication is handled through **Firebase Auth** (`services/authService.ts`, `hooks/AuthContext.tsx`, `store/authStore.ts`).
- Routes are guarded by `ProtectedRoute` (authenticated doctors) and `CaregiverRoute` (delegated caregivers).
- Fine-grained access is resolved via the permissions layer (`hooks/usePermissions.ts`, `services/permissions/`), enabling caregivers to act on behalf of a doctor within a limited scope.

## Deployment

The portal deploys to **Vercel** as a static CRA build.

- **Build command:** `npm run build`
- **Output directory:** `build`

> ⚠️ **CI treats lint warnings as errors.** Vercel builds run with `CI=true`, so any ESLint warning (unused imports/vars, hook dependency issues, stray BOM) will fail the build. Keep the tree warning-free, or fix warnings before pushing.

## Branching & workflow

- `main` — production / deploy branch.
- `dev` — active development branch.
- Feature branches are merged via pull request into `dev`, then promoted to `main`.

## Troubleshooting

- **Build fails on Vercel with lint warnings** — resolve the reported ESLint warnings locally (`npm run build` reproduces CI behaviour) before pushing.
- **`No space left on device` during builds** — clear artifacts and caches: `rm -rf build node_modules/.cache && npm cache clean --force`.
- **Auth/permission errors** — confirm the account exists in the `anixihealth24` Firebase project and that Firestore security rules allow the operation.
