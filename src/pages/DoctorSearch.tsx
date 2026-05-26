import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { sendPatientRequest } from '../services/patientManagementService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Doctor } from '../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
export const DoctorSearch: React.FC = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
  const [requestSentFor, setRequestSentFor] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        setError(null);
        const doctorsRef = collection(db, 'Users');
        const q = query(doctorsRef, where('role', '==', 'doctor'));
        const snapshot = await getDocs(q);
        const doctorsList: Doctor[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          doctorsList.push({
            id: doc.id,
            email: data.email,
            displayName: data.displayName,
            role: 'doctor' as const,
            specialty: data.specialty || 'General Medicine',
            licenseNumber: data.licenseNumber || 'N/A',
            phoneNumber: data.phoneNumber || '',
            officeAddress: data.officeAddress || '',
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as Doctor);
        });
        
        // Deduplicate doctors by email to prevent showing duplicates
        const seen = new Set<string>();
        const uniqueDoctors = doctorsList.filter((doctor) => {
          const key = doctor.email?.toLowerCase() || doctor.displayName?.toLowerCase() || doctor.id;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
        
        setDoctors(uniqueDoctors);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch doctors';
        ;
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, []);
  const handleSendRequest = async (doctorId: string) => {
    if (!user?.id) {
      setError('You must be logged in as a patient');
      return;
    }
    try {
      setSendingRequestId(doctorId);
      setError(null);
      await sendPatientRequest(user.id, doctorId);
      setRequestSentFor((prev) => ({
        ...prev,
        [doctorId]: true,
      }));
      setSuccessMessage('Request sent successfully! The doctor will review it soon.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send request';
      ;
      setError(errorMsg);
    } finally {
      setSendingRequestId(null);
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-anixi-beige">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-anixi-green"></div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-anixi-beige">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Find a Doctor</h1>
          <p className="text-gray-600 mt-1">
            Browse available doctors and send a connection request
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}
        {doctors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <svg
              className="w-16 h-16 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            <p className="text-lg font-medium">No doctors available</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doctor) => (
              <Card key={doctor.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{doctor.displayName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Specialty</p>
                    <p className="font-medium text-gray-900">{doctor.specialty}</p>
                  </div>
                  {doctor.licenseNumber && doctor.licenseNumber !== 'N/A' && (
                    <div>
                      <p className="text-sm text-gray-600">License</p>
                      <p className="font-medium text-gray-900">{doctor.licenseNumber}</p>
                    </div>
                  )}
                  {doctor.phoneNumber && (
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium text-gray-900">{doctor.phoneNumber}</p>
                    </div>
                  )}
                  {doctor.officeAddress && (
                    <div>
                      <p className="text-sm text-gray-600">Office</p>
                      <p className="font-medium text-gray-900 text-sm">{doctor.officeAddress}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900 text-sm break-all">{doctor.email}</p>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    {requestSentFor[doctor.id] ? (
                      <Button
                        variant="success"
                        disabled
                        className="w-full"
                      >
                        ✅ Request Sent
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => handleSendRequest(doctor.id)}
                        disabled={sendingRequestId === doctor.id}
                        className="w-full"
                      >
                        {sendingRequestId === doctor.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                            </svg>
                            Sending...
                          </span>
                        ) : (
                          'Send Request'
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
