# Anixi Doctor Web Portal

A React web application for doctors to manage their patients and appointments, connected to the Anixi mobile application backend.

## Features

- **Doctor Authentication**: Secure login for medical professionals
- **Dashboard**: Overview of patient statistics and key metrics
- **Patient Management**: View and manage patient registry with adherence tracking
- **Appointment Scheduling**: Manage and track patient appointments
- **Profile Management**: Update professional information

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State Management**: Zustand
- **Data Fetching**: React Query (TanStack Query)
- **Backend**: Firebase (Firestore, Authentication, Storage)
`


## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Card, etc.)
│   ├── Layout.tsx      # Main application layout
│   └── ProtectedRoute.tsx # Authentication wrapper
├── hooks/              # Custom React hooks
│   └── useAuth.ts      # Authentication hook
├── lib/                # External libraries configuration
│   └── firebase.ts     # Firebase configuration
├── pages/              # Page components
│   ├── Login.tsx       # Login page
│   ├── Dashboard.tsx   # Doctor dashboard
│   ├── Patients.tsx    # Patient management
│   ├── Appointments.tsx # Appointment management
│   └── Profile.tsx     # Doctor profile
├── services/           # API services
│   ├── authService.ts  # Authentication services
│   ├── doctorService.ts # Doctor-related services
│   └── appointmentService.ts # Appointment services
├── shared/             # Shared constants and utilities
│   └── constants.ts    # Firebase collection names
├── store/              # State management
│   └── authStore.ts    # Authentication state
├── types/              # TypeScript type definitions
│   └── index.ts        # Main types
└── App.tsx             # Main application component
```

## Available Scripts

- `npm install`
- `npm run build` - Builds the app for production
- `npm start` - Starts the development server

The application will be available at `http://localhost:3000`





