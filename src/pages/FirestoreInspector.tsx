import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
export const FirestoreInspector: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const inspect = async () => {
      try {
        const appointmentsRef = collection(db, 'appointments');
        const snapshot = await getDocs(appointmentsRef);
        const appointments = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            doctorId: d.doctorId || 'MISSING',
            doctorIdType: typeof d.doctorId,
            patientName: d.patientName || 'N/A',
            status: d.status,
            date: d.date?.toDate?.()?.toLocaleDateString() || d.date,
          };
        });
        const byDoctor: { [key: string]: any[] } = {};
        appointments.forEach((apt) => {
          if (!byDoctor[apt.doctorId]) {
            byDoctor[apt.doctorId] = [];
          }
          byDoctor[apt.doctorId].push(apt);
        });
        setData({
          total: snapshot.size,
          appointments,
          byDoctor,
          uniqueDoctorIds: Object.keys(byDoctor),
        });
      } catch (error) {
        ;
        setData({ error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };
    inspect();
  }, []);
  if (loading) return <div className="p-6">Inspection Firestore...</div>;
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔍 Firestore Collection Inspector</h1>
      {}
      <div className="bg-[#f0f2f1] p-4 rounded-lg mb-6 border border-[#cbd5d2]">
        <p className="text-2xl font-bold text-[#425950]">
          📊 Total Appointments: {data?.total || 0}
        </p>
        <p className="text-lg font-semibold text-[#5a6f6a] mt-2">
          👨‍⚕️ Unique Doctors: {data?.uniqueDoctorIds?.length || 0}
        </p>
      </div>
      {}
      <div className="space-y-4">
        {data?.uniqueDoctorIds?.map((doctorId: string) => (
          <div
            key={doctorId}
            className="bg-white p-4 rounded-lg border-l-4 border-purple-500"
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-gray-900">
                👨‍⚕️ Doctor ID: {doctorId === 'MISSING' ? '⚠️ MISSING' : doctorId}
              </h2>
              <span className="bg-purple-600 text-white px-3 py-1 rounded-full font-bold">
                {data.byDoctor[doctorId].length} appointments
              </span>
            </div>
            {}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Patient</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Doc ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDoctor[doctorId].map((apt: any, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{apt.patientName}</td>
                      <td className="p-2">
                        <span className="bg-gray-200 px-2 py-1 rounded text-xs font-semibold">
                          {apt.status}
                        </span>
                      </td>
                      <td className="p-2 text-xs">{apt.date}</td>
                      <td className="p-2 text-xs font-mono break-all max-w-40">
                        {apt.doctorId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {}
      <div className="mt-8 bg-gray-100 p-4 rounded-lg">
        <h3 className="text-lg font-bold mb-2">📋 Raw Data (JSON)</h3>
        <pre className="bg-white p-3 rounded text-xs overflow-auto max-h-60">
          {JSON.stringify(data?.appointments, null, 2)}
        </pre>
      </div>
    </div>
  );
};
export default FirestoreInspector;
