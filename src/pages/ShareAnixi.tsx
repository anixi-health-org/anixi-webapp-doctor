import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface Referral {
  invitationsSent: number;
  invitationsAccepted: number;
}

export const ShareAnixi: React.FC = () => {
  const { user } = useAuth();
  const [referral] = useState<Referral>({ invitationsSent: 0, invitationsAccepted: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [user?.id]);

  if (loading) return <div className="p-8">Loading referral link...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-anixi-beige min-h-screen">
      <h1 className="text-3xl font-bold mb-2">Share Anixi</h1>
      <p className="opacity-90 mb-6">Invite colleagues and patients to join the platform</p>

      <div className="bg-anixi-card border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Download Anixi Health App</h3>
          <p className="text-gray-600 mb-4">Share the Anixi Health app with your patients and colleagues!</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="https://apps.apple.com/app/anixi-health"
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
              <a
                href="https://play.google.com/store/apps/details?id=com.anixi.health"
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
  );
};

export default ShareAnixi;
