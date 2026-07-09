import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout';
import { RoleSelector } from '../components/auth/RoleSelector';
import { SignInPrompt } from '../components/auth/AuthLinks';
import { AuthRole } from '../types/auth';

export const Join: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<AuthRole | null>(null);
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!selectedRole) return;
    navigate(`/register?role=${selectedRole}`);
  };

  return (
    <AuthLayout
      title="Join Anixi Health"
      subtitle="Anixi Health is changing the chronic illness journey with technology that supports, and community that understands."
      maxWidth="lg"
    >
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-8 shadow-lg sm:px-8">
        <div className="mb-8 text-center">
          <h2 className="font-heading text-xl font-semibold text-gray-900">Choose your role</h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Select how you&apos;d like to join our community
          </p>
        </div>

        <RoleSelector selectedRole={selectedRole} onSelect={setSelectedRole} />

        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedRole}
          className="mt-8 w-full rounded-full py-3.5 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:bg-gray-300 enabled:bg-anixi-green enabled:hover:opacity-90 enabled:hover:shadow-md"
        >
          Continue
        </button>

        <div className="mt-6">
          <SignInPrompt />
        </div>
      </div>
    </AuthLayout>
  );
};
