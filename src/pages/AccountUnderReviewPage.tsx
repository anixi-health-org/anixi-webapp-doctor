import React from 'react';
import { ClockIcon, ExclamationTriangleIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { AnixiLogo } from '../components/brand/AnixiLogo';
import { useAuth } from '../hooks/AuthContext';
import { getDoctorAccessState } from '../lib/doctorAccess';
import type { Doctor } from '../types';

export const AccountUnderReviewPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;
  const state = doctor ? getDoctorAccessState(doctor) : 'under_review';

  const copy =
    state === 'rejected'
      ? {
          icon: ExclamationTriangleIcon,
          title: 'Application not approved',
          body:
            doctor?.rejectionReason ||
            'Your doctor application was not approved. Please update your details and contact Anixi Support if you need help.',
          tone: 'text-amber-700 bg-amber-50 border-amber-200',
        }
      : state === 'suspended'
        ? {
            icon: NoSymbolIcon,
            title: 'Account suspended',
            body:
              doctor?.rejectionReason ||
              'Your doctor account has been suspended. Please contact Anixi Support for assistance.',
            tone: 'text-red-700 bg-red-50 border-red-200',
          }
        : {
            icon: ClockIcon,
            title: 'Account under review',
            body: 'Thanks for submitting your personal and practice details. Anixi Admin is reviewing your application. You can sign in anytime — full access unlocks once your account is approved.',
            tone: 'text-[#344256] bg-[#eef4f1] border-[#427160]/20',
          };

  const Icon = copy.icon;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-10">
      <div className="mb-8">
        <AnixiLogo variant="auth" linkTo={null} />
      </div>

      <div className="w-full max-w-lg rounded-[16px] border border-[#e1e7ef] bg-white p-8 shadow-sm">
        <div className={`mb-6 flex items-start gap-3 rounded-[12px] border p-4 ${copy.tone}`}>
          <Icon className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <h1 className="text-lg font-bold">{copy.title}</h1>
            <p className="mt-1 text-sm leading-relaxed opacity-90">{copy.body}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-[#65758b]">
          <p>
            Signed in as{' '}
            <span className="font-medium text-[#344256]">
              {doctor?.displayName || doctor?.email || 'Doctor'}
            </span>
          </p>
          {state === 'under_review' && (
            <p>
              Typical review time is 1–2 business days. You will gain access to patients,
              appointments, and tele-consultations after approval.
            </p>
          )}
          {(state === 'rejected' || state === 'suspended') && (
            <button
              type="button"
              onClick={() => navigate('/onboarding')}
              className="inline-flex h-10 items-center rounded-[10px] border border-[#e1e7ef] px-4 font-medium text-[#344256] hover:bg-[#f8fafc]"
            >
              Update application details
            </button>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center rounded-[10px] bg-[#427160] px-4 text-sm font-medium text-white hover:bg-[#365c4f]"
          >
            Check approval status
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="inline-flex h-10 items-center rounded-[10px] border border-[#e1e7ef] px-4 text-sm font-medium text-[#344256] hover:bg-[#f8fafc]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
