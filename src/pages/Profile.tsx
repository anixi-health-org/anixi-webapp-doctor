import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import { updateDoctorProfile } from '../services/doctorService';
import { Doctor } from '../types';
import { formatTimestamp } from '../utils/dataFormatter';


export const ProfessionalProfile: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Doctor>>({
    displayName: user?.displayName || '',
    specialty: user?.specialty || '',
    licenseNumber: user?.licenseNumber || '',
    phoneNumber: user?.phoneNumber || '',
    officeAddress: user?.officeAddress || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setMessage('');

    try {
      await updateDoctorProfile(user.id, formData);
      setMessage('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      setMessage('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="p-6 bg-anixi-beige min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-anixi-green\">Professional Profile</h1>
        <p className="mt-2 text-anixi-green\">Manage your professional information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Professional Information</CardTitle>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="displayName"
                        value={formData.displayName}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={user?.email}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Specialty
                      </label>
                      <input
                        type="text"
                        name="specialty"
                        value={formData.specialty}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        License Number
                      </label>
                      <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Office Address
                    </label>
                    <textarea
                      name="officeAddress"
                      value={formData.officeAddress}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {message && (
                    <div className={`mt-4 p-3 rounded-md text-sm ${
                      message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {message}
                    </div>
                  )}

                  <div className="mt-6 flex space-x-3">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">Full Name :</span>
                    <p className="text-sm text-gray-900">{user?.displayName}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">Email :</span>
                    <p className="text-sm text-gray-900">{user?.email}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">Specialty :</span>
                    <p className="text-sm text-gray-900">{user?.specialty}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">License Number :</span>
                    <p className="text-sm text-gray-900">{user?.licenseNumber}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">Phone Number :</span>
                    <p className="text-sm text-gray-900">{user?.phoneNumber}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-600 min-w-fit">Office Address :</span>
                    <p className="text-sm text-gray-900">{user?.officeAddress}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Security</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <button className="w-full text-left px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Change Password</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
                <button className="w-full text-left px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Two-Factor Authentication</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Account Type</span>
                  <span className="text-sm font-medium text-gray-900">Doctor</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Member Since</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatTimestamp(user?.createdAt, 'short')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalProfile;