import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
export const VitalsHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  if (!patientId) {
    return (
      <div className="p-6 bg-anixi-beige min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">Patient ID not found</p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-6 bg-anixi-beige min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 px-4 py-2 bg-anixi-green text-white hover:opacity-90 rounded-lg transition-all"
          >
            ← Back to Patient Profile
          </button>
          <h1 className="text-3xl font-bold text-anixi-green">❤️ Vitals History</h1>
          <p className="mt-2 text-anixi-green">View patient vital signs and health measurements</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Patient Vital Signs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#f0f2f1] p-6 rounded-lg border border-[#cbd5d2]">
                  <p className="text-sm text-gray-600 font-semibold mb-2">Blood Pressure</p>
                  <p className="text-3xl font-bold text-[#425950]">-</p>
                  <p className="text-xs text-gray-500 mt-2">mmHg</p>
                </div>
                <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                  <p className="text-sm text-gray-600 font-semibold mb-2">Heart Rate</p>
                  <p className="text-3xl font-bold text-red-600">-</p>
                  <p className="text-xs text-gray-500 mt-2">bpm</p>
                </div>
                <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                  <p className="text-sm text-gray-600 font-semibold mb-2">Body Temperature</p>
                  <p className="text-3xl font-bold text-orange-600">-</p>
                  <p className="text-xs text-gray-500 mt-2">°C</p>
                </div>
                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600 font-semibold mb-2">Weight</p>
                  <p className="text-3xl font-bold text-green-600">-</p>
                  <p className="text-xs text-gray-500 mt-2">kg</p>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-6">
                <p className="text-sm text-gray-600">No vitals data available. Vitals will be recorded in Firestore.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default VitalsHistoryPage;
