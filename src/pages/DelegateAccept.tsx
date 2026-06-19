import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { acceptDelegateInvitation } from '../services/permissions/practicePermissionsService';

export const DelegateAccept: React.FC = () => {
  const [searchParams] = useSearchParams();
  const doctorId = searchParams.get('doctorId') || '';
  const delegateId = searchParams.get('delegateId') || '';
  const { user, isLoading: authLoading, isAuthenticated, refreshPracticeSession } = useAuth();
  const navigate = useNavigate();
  const acceptStartedRef = useRef(false);

  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user || !doctorId || !delegateId) return;
    if (acceptStartedRef.current) return;
    acceptStartedRef.current = true;

    const run = async () => {
      setStatus('accepting');
      try {
        const authEmail = auth.currentUser?.email ?? user.email;
        await acceptDelegateInvitation(doctorId, delegateId, {
          uid: user.id,
          email: authEmail,
          displayName: user.displayName,
        });
        await refreshPracticeSession();
        setStatus('success');
        setMessage('Invitation accepted. You now have delegate access.');
        setTimeout(() => navigate('/practice-settings'), 2000);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to accept invitation');
      }
    };

    void run();
  }, [
    authLoading,
    isAuthenticated,
    user,
    doctorId,
    delegateId,
    refreshPracticeSession,
    navigate,
  ]);

  if (!doctorId || !delegateId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Invalid invitation link</h1>
          <p className="mt-2 text-sm text-gray-600">
            This link is missing required parameters. Please use the link from your invitation email.
          </p>
          <Link to="/login" className="mt-4 inline-block text-sm text-[#516059] underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-b-2 border-[#516059] rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnUrl = `/delegate/accept?doctorId=${encodeURIComponent(doctorId)}&delegateId=${encodeURIComponent(delegateId)}`;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Accept delegate invitation</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in with the email address that received this invitation, then we&apos;ll complete setup
            automatically.
          </p>
          <Link
            to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
            className="mt-6 inline-block rounded-lg bg-[#516059] text-white px-6 py-3 text-sm font-semibold"
          >
            Sign in to accept
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border p-6 text-center">
        {status === 'accepting' && (
          <>
            <div className="mx-auto animate-spin h-10 w-10 border-b-2 border-[#516059] rounded-full" />
            <p className="mt-4 text-sm text-gray-600">Accepting invitation...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-xl font-semibold text-green-800">You&apos;re all set</h1>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-semibold text-red-800">Could not accept invitation</h1>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            <button
              type="button"
              onClick={async () => {
                acceptStartedRef.current = false;
                setStatus('idle');
                window.location.reload();
              }}
              className="mt-4 block w-full text-sm text-[#516059] underline"
            >
              Try again
            </button>
            <Link to="/practice-settings" className="mt-2 inline-block text-sm underline">
              Go to practice settings
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default DelegateAccept;
