import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, LinkIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { getDoctorReferral, logInvitation, getReferralStats } from '../services/referralService';
import { Referral } from '../services/referralService';


export const ShareAnixi: React.FC = () => {
  const { user } = useAuth();
  const [referral, setReferral] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const fetchReferral = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        console.log('🔗 ShareAnixi: Fetching referral...');
        const data = await getDoctorReferral(user.id);
        if (data) {
          setReferral(data);
          console.log('✅ ShareAnixi: Referral loaded');
        }
      } catch (err) {
        console.error('❌ ShareAnixi: Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReferral();
  }, [user?.id]);

  if (loading) return <div className="p-8">Loading referral link...</div>;
  if (error && !referral) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-anixi-beige min-h-screen">
      <div className="bg-white rounded-lg shadow">
        <div className="bg-gradient-to-r from-anixi-green to-anixi-green px-6 py-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Share Anixi</h1>
          <p className="text-anixi-beige opacity-90">Invite colleagues and patients to join the platform</p>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Invitation Stats</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-3xl font-bold text-purple-600">{referral?.invitationsSent || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Invitations Sent</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-3xl font-bold text-blue-600">{referral?.invitationsAccepted || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Accepted</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-3xl font-bold text-green-600">0</p>
                <p className="text-sm text-gray-600 mt-1">Rewards Available</p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
            <h4 className="font-semibold text-gray-900 mb-2">Benefits of Sharing</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>✓ Build your professional network</li>
              <li>✓ Help colleagues discover Anixi</li>
              <li>✓ Earn rewards for successful referrals</li>
              <li>✓ Track all your invitations in real-time</li>
            </ul>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Download Anixi Health App</h3>
            <p className="text-gray-600 mb-4">Share the Anixi Health app with your patients and colleagues!</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* iOS Download */}
              <a
                href="https://apps.apple.com/za/app/anixi-health/id6677038697"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-lg hover:shadow-lg transition-shadow flex items-center justify-center space-x-3"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 13.5c-.91 0-1.82.5-2.27 1.5H8.22c-.45-1-1.36-1.5-2.27-1.5-1.66 0-3 1.34-3 3s1.34 3 3 3c.91 0 1.82-.5 2.27-1.5h6.56c.45 1 1.36 1.5 2.27 1.5 1.66 0 3-1.34 3-3s-1.34-3-3-3zm-9.27 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm9.27 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
                <div className="text-left">
                  <p className="text-xs opacity-75">Download for</p>
                  <p className="text-lg font-semibold">iOS</p>
                </div>
              </a>

              {/* Android Download */}
              <a
                href="https://play.google.com/store/apps/details?id=com.anixihealth.anixihealth"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-lg transition-shadow flex items-center justify-center space-x-3"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 13.5h8v8H3z M13 3h8v8h-8z M6 6L17 17 M17 6L6 17"/>
                </svg>
                <div className="text-left">
                  <p className="text-xs opacity-75">Download for</p>
                  <p className="text-lg font-semibold">Android</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareAnixi;
