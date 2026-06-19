import React, { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useCreateSharingRequest, useSearchDoctors } from '../hooks/usePatientSharingRequests';
import { usePatientSharingRequests } from '../hooks/usePatientSharingRequests';

export const DoctorSearch: React.FC = () => {
  const { user } = useAuth();
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [requestSentFor, setRequestSentFor] = useState<Record<string, boolean>>({});

  const filters = useMemo(
    () => ({
      medicalSpecialty: specialtyFilter.trim() || undefined,
      practiceCity: cityFilter.trim() || undefined,
      maxResults: 20,
    }),
    [specialtyFilter, cityFilter]
  );

  const { data: doctors = [], isLoading, error: searchError } = useSearchDoctors(filters);
  const { requests: myRequests } = usePatientSharingRequests(user?.id);
  const createRequest = useCreateSharingRequest(user?.id);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingDoctorIds = useMemo(
    () =>
      new Set(
        myRequests.filter((r) => r.status === 'pending').map((r) => r.doctorId)
      ),
    [myRequests]
  );

  const handleSendRequest = async (doctorId: string) => {
    if (!user?.id) {
      setError('You must be logged in as a patient');
      return;
    }
    try {
      setError(null);
      await createRequest.mutateAsync(doctorId);
      setRequestSentFor((prev) => ({ ...prev, [doctorId]: true }));
      setSuccessMessage('Request sent successfully! The doctor will review it soon.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-anixi-beige flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-anixi-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-anixi-beige">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Find a Doctor</h1>
          <p className="text-gray-600 mt-1">
            Browse doctors and send a connection request (same flow as the mobile app)
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            placeholder="Filter by specialty"
            className="text-sm border border-gray-300 rounded-lg px-3 py-2.5"
          />
          <input
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Filter by city"
            className="text-sm border border-gray-300 rounded-lg px-3 py-2.5"
          />
        </div>

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
            {successMessage}
          </div>
        )}
        {(error || searchError) && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || (searchError instanceof Error ? searchError.message : 'Search failed')}
          </div>
        )}

        {doctors.length === 0 ? (
          <p className="text-center text-gray-500 py-16">No doctors found in the doctors collection.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doctor) => {
              const alreadySent =
                requestSentFor[doctor.id] || pendingDoctorIds.has(doctor.id);
              return (
                <Card key={doctor.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{doctor.displayName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {doctor.medicalSpecialty && (
                      <div>
                        <p className="text-sm text-gray-600">Specialty</p>
                        <p className="font-medium">{doctor.medicalSpecialty}</p>
                      </div>
                    )}
                    {doctor.practiceCity && (
                      <div>
                        <p className="text-sm text-gray-600">City</p>
                        <p className="font-medium">{doctor.practiceCity}</p>
                      </div>
                    )}
                    {doctor.yearsInPractice != null && (
                      <div>
                        <p className="text-sm text-gray-600">Experience</p>
                        <p className="font-medium">{doctor.yearsInPractice} years</p>
                      </div>
                    )}
                    <div className="pt-4 border-t">
                      {alreadySent ? (
                        <Button variant="success" disabled className="w-full">
                          Request Sent
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => handleSendRequest(doctor.id)}
                          disabled={createRequest.isPending && createRequest.variables === doctor.id}
                          className="w-full"
                        >
                          {createRequest.isPending && createRequest.variables === doctor.id
                            ? 'Sending...'
                            : 'Send Request'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
