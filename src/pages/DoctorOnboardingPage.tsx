import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnixiLogo } from '../components/brand/AnixiLogo';
import ProfessionalProfileForm from '../components/ProfessionalProfileForm';
import { useAuth } from '../hooks/AuthContext';
import { doctorHomePath, getDoctorAccessState } from '../lib/doctorAccess';
import type { Doctor } from '../types';

export const DoctorOnboardingPage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const doctor = user?.role === 'doctor' ? (user as Doctor) : null;

  useEffect(() => {
    if (!doctor) return;
    const state = getDoctorAccessState(doctor);
    if (state !== 'onboarding' && state !== 'rejected' && state !== 'suspended') {
      navigate(doctorHomePath(doctor), { replace: true });
    }
  }, [doctor, navigate]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="border-b border-[#e1e7ef] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <AnixiLogo variant="header" linkTo={null} />
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="text-sm font-medium text-[#65758b] hover:text-[#344256]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 rounded-[12px] border border-[#427160]/15 bg-[#eef4f1] px-5 py-4">
          <h1 className="text-xl font-bold text-[#344256]">Complete your doctor application</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#65758b]">
            Fill in your personal details and practice information. Anixi Admin will review your
            application before you can start managing patients, appointments, and tele-consultations.
          </p>
        </div>

        <ProfessionalProfileForm
          mode="onboarding"
          onSubmitted={async () => {
            await refreshUser();
            navigate('/account-review', { replace: true });
          }}
        />
      </div>
    </div>
  );
};
