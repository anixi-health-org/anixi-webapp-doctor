import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { usePatientData } from '../hooks/usePatientData';
import { useAuth } from '../hooks/useAuth';
import { AdherenceCalendar } from '../components/AdherenceCalendar';
import { DailyAdherenceView } from '../components/DailyAdherenceView';
import { AdherenceLogs } from '../components/AdherenceLogs';
import { MoodCalendar } from '../components/MoodCalendar';
import { formatTimestamp } from '../utils/dateFormatter';


export const PatientHealthDashboard: React.FC<{ patientId: string }> = ({ patientId }) => {
  const { user } = useAuth();
  const { patient, isLoading, error } = usePatientData(patientId);
  const [activeView, setActiveView] = useState<
    'overview' | 'mood-calendar' | 'adherence-calendar' | 'daily-adherence' | 'adherence-logs'
  >('overview');
  const [selectedDate, setSelectedDate] = useState(new Date());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading patient health data...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900">Error</h3>
        <p className="text-red-700 mt-2">{error || 'Patient not found'}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen p-6 space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">Patient Health Dashboard</h1>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Patient Name</p>
            <p className="text-lg font-semibold text-gray-900">{patient.displayName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Date of Birth</p>
            <p className="text-lg font-semibold text-gray-900">
              {patient.dateOfBirth ? formatTimestamp(patient.dateOfBirth, 'short') : ''}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Member Since</p>
            <p className="text-lg font-semibold text-gray-900">
              {patient.createdAt ? formatTimestamp(patient.createdAt, 'short') : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white p-4 rounded-lg border border-gray-200">
        <button
          onClick={() => setActiveView('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'overview'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveView('mood-calendar')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'mood-calendar'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          😊 Mood Calendar
        </button>
        <button
          onClick={() => setActiveView('adherence-calendar')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'adherence-calendar'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          💊 Adherence Calendar
        </button>
        <button
          onClick={() => setActiveView('adherence-logs')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'adherence-logs'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📋 Adherence Logs
        </button>
      </div>

      <div>
        {activeView === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Last Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Last updated:{' '}
                  <span className="font-semibold">
                    {formatTimestamp(patient.updatedAt, 'datetime')}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {patient.email && (
                    <p className="text-sm">
                      <span className="text-gray-600">Email:</span> {patient.email}
                    </p>
                  )}
                  {patient.phoneNumber && (
                    <p className="text-sm">
                      <span className="text-gray-600">Phone:</span> {patient.phoneNumber}
                    </p>
                  )}
                  {patient.address && (
                    <p className="text-sm">
                      <span className="text-gray-600">Address:</span> {patient.address}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {patient.currentTreatments && patient.currentTreatments.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Current Treatments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {patient.currentTreatments.map((treatment, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="font-semibold text-gray-900">{treatment.name}</p>
                        <p className="text-sm text-gray-600">
                          {treatment.dosage} • {treatment.frequency}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Started:{' '}
                          {treatment.startDate
                            ? formatTimestamp(treatment.startDate, 'short')
                            : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeView === 'mood-calendar' && (
          <Card>
            <CardHeader>
              <CardTitle>Mood Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <MoodCalendar patientId={patientId} />
            </CardContent>
          </Card>
        )}

        {activeView === 'adherence-calendar' && (
          <Card>
            <CardHeader>
              <CardTitle>Medication Adherence</CardTitle>
            </CardHeader>
            <CardContent>
              <AdherenceCalendar
                patientId={patientId}
                onDayClick={(date) => {
                  setSelectedDate(date);
                  setActiveView('daily-adherence');
                }}
              />
            </CardContent>
          </Card>
        )}

        {activeView === 'daily-adherence' && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Adherence Details</CardTitle>
            </CardHeader>
            <CardContent>
              <DailyAdherenceView
                patientId={patientId}
                date={selectedDate}
                onPreviousDay={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() - 1);
                  setSelectedDate(newDate);
                }}
                onNextDay={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setSelectedDate(newDate);
                }}
              />
            </CardContent>
          </Card>
        )}

        {activeView === 'adherence-logs' && (
          <Card>
            <CardHeader>
              <CardTitle>Adherence History</CardTitle>
            </CardHeader>
            <CardContent>
              <AdherenceLogs patientId={patientId} />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="text-xs text-gray-500 p-4 bg-white rounded-lg border border-gray-200">
        <p>
          ✅ All timestamps are automatically converted from Firestore format before rendering.
          This prevents React errors like "Objects are not valid as a React child".
        </p>
      </div>
    </div>
  );
};

export default PatientHealthDashboard;
