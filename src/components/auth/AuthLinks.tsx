import React from 'react';
import { Link } from 'react-router-dom';

/** Shown on login — sends new users to role selection before register. */
export const RegisterPrompt: React.FC = () => (
  <p className="text-center text-sm text-gray-600">
    Don&apos;t have an account?{' '}
    <Link to="/join" className="font-semibold text-anixi-green hover:underline">
      Register as a doctor or caregiver
    </Link>
  </p>
);

/** Shown on join / register — back to sign in. */
export const SignInPrompt: React.FC = () => (
  <p className="text-center text-sm text-gray-600">
    Already have an account?{' '}
    <Link to="/login" className="font-semibold text-anixi-green hover:underline">
      Sign in
    </Link>
  </p>
);

/** Shown on register — change role before completing signup. */
export const ChangeRoleLink: React.FC = () => (
  <p className="text-center text-sm text-gray-500">
    <Link to="/join" className="font-medium text-anixi-green hover:underline">
      Choose a different role
    </Link>
  </p>
);
