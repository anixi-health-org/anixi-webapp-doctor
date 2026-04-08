import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getDoctorProfile } from '../services/doctorService';
import { Doctor } from '../types';


export const PublicProfile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        console.log('📋 PublicProfile: Fetching doctor profile...');
        const data = await getDoctorProfile(user.id);
        setProfile(data);
        console.log('✅ PublicProfile: Profile loaded');
      } catch (err) {
        console.error('❌ PublicProfile: Error:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  if (loading) return <div className="p-8">Loading profile...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!profile) return <div className="p-8">Profile not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-anixi-beige min-h-screen">
      <div className="bg-white rounded-lg shadow">
        <div className="bg-gradient-to-r from-anixi-green to-anixi-green px-6 py-8 text-white">
          <h1 className="text-3xl font-bold mb-2">{profile.displayName}</h1>
          <p className="text-anixi-beige opacity-90\">{profile.specialty || 'Medical Professional'}</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Professional Information</h2>
              
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <span className="text-sm font-medium text-gray-600 min-w-fit">Email :</span>
                  <p className="text-sm text-gray-900">{profile.email}</p>
                </div>

                {profile.specialty && (
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">Specialty :</span>
                    <p className="text-sm text-gray-900">{profile.specialty}</p>
                  </div>
                )}

                {profile.licenseNumber && (
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">License Number :</span>
                    <p className="text-sm text-gray-900">{profile.licenseNumber}</p>
                  </div>
                )}

                {profile.phoneNumber && (
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">Phone :</span>
                    <p className="text-sm text-gray-900">{profile.phoneNumber}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Location</h2>
              
              <div className="space-y-3">
                {profile.officeAddress && (
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">Office Address :</span>
                    <p className="text-sm text-gray-900">{profile.officeAddress}</p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    ℹ️ This is your public profile. Patients see this information when they search for you.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">
              ✓ Your public profile is visible to all Anixi users
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
