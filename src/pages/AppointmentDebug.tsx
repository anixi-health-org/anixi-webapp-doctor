import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
export const AppointmentDebug: React.FC = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const checkData = async () => {
      if (!user) return;
      try {
        const userInfo = {
          userId: user.id,
          email: user.email,
          role: (user as any).role,
        };
        const appointmentsRef = collection(db, 'appointments');
        const allAppointmentsSnapshot = await getDocs(appointmentsRef);
        const allAppointments = allAppointmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        const q = query(
          appointmentsRef,
          where('doctorId', '==', user.id)
        );
        const doctorAppointmentsSnapshot = await getDocs(q);
        const doctorAppointments = doctorAppointmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDebugInfo({
          userInfo,
          allAppointmentsCount: allAppointmentsSnapshot.size,
          allAppointments,
          doctorAppointmentsCount: doctorAppointmentsSnapshot.size,
          doctorAppointments,
        });
      } catch (error) {
        ;
        setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };
    checkData();
  }, [user]);
  if (loading) return <div className="p-6">Loading debug info...</div>;
  return (
    <div className="p-6 max-w-4xl mx-auto bg-gray-50 rounded-lg">
      <h1 className="text-2xl font-bold mb-6">🔍 Appointment Debug</h1>
      {}
      <div className="bg-white p-4 rounded-lg mb-4 border-l-4 border-[#425950]">
        <h2 className="text-lg font-semibold mb-2">👤 Connected User</h2>
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
          {JSON.stringify(debugInfo?.userInfo, null, 2)}
        </pre>
      </div>
      {}
      <div className="bg-white p-4 rounded-lg mb-4 border-l-4 border-green-500">
        <h2 className="text-lg font-semibold mb-2">
          📊 All Appointments in Database
        </h2>
        <p className="text-2xl font-bold text-green-600 mb-3">
          {debugInfo?.allAppointmentsCount || 0}
        </p>
        {debugInfo?.allAppointments?.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {debugInfo.allAppointments.map((apt: any, idx: number) => (
              <div key={idx} className="bg-gray-50 p-2 rounded text-sm">
                <strong>Doctor:</strong> {apt.doctorId} | <strong>Patient:</strong> {apt.patientName || apt.patientId} | <strong>Status:</strong> {apt.status}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-red-600 font-semibold">⚠️ NO APPOINTMENTS IN DATABASE</p>
        )}
      </div>
      {}
      <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
        <h2 className="text-lg font-semibold mb-2">
          📋 Appointments for Current Doctor (ID: {debugInfo?.userInfo?.userId})
        </h2>
        <p className="text-2xl font-bold text-purple-600 mb-3">
          {debugInfo?.doctorAppointmentsCount || 0}
        </p>
        {debugInfo?.doctorAppointments?.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {debugInfo.doctorAppointments.map((apt: any, idx: number) => (
              <div key={idx} className="bg-gray-50 p-2 rounded text-sm">
                <strong>Patient:</strong> {apt.patientName || apt.patientId} | <strong>Date:</strong> {apt.date?.toDate?.().toLocaleDateString() || 'N/A'}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-red-600 font-semibold">
            ⚠️ NO APPOINTMENTS FOR THIS DOCTOR
            <br />
            <span className="text-sm">Either: (1) No data exists, OR (2) The doctorId doesn't match</span>
          </p>
        )}
      </div>
      {}
      <div className="bg-white p-4 rounded-lg mb-4 border-l-4 border-red-500">
        <h2 className="text-lg font-semibold mb-4">
          🔴 POURQUOI 0 RENDEZ-VOUS? - VÉRIFICATION DOCTEUR ID
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {}
          <div className="bg-blue-50 p-3 rounded border border-blue-300">
            <p className="text-sm font-semibold text-blue-900">👨‍⚕️ TES DOCTOR ID</p>
            <code className="bg-white p-2 rounded block mt-2 text-xs break-all font-mono border">
              {debugInfo?.userInfo?.userId || 'N/A'}
            </code>
            <button
              onClick={() => {
                const id = debugInfo?.userInfo?.userId;
                if (id) {
                  navigator.clipboard.writeText(id);
                  alert('✅ Copié!');
                }
              }}
              className="mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              📋 Copier
            </button>
          </div>
          {}
          <div className="bg-purple-50 p-3 rounded border border-purple-300">
            <p className="text-sm font-semibold text-purple-900">📊 DOCTOR IDs TROUVÉS</p>
            <div className="bg-white p-2 rounded mt-2 text-xs font-mono border max-h-20 overflow-y-auto">
              {debugInfo?.allAppointments?.length > 0 ? (
                <div className="space-y-1">
                  {Array.from(new Set(debugInfo.allAppointments.map((a: any) => a.doctorId))).map((id: any) => (
                    <div key={id} className="flex justify-between items-center bg-gray-50 p-1 rounded">
                      <code className="break-all">{id}</code>
                      {id === debugInfo?.userInfo?.userId ? (
                        <span className="text-green-600 font-bold">✅ MATCH!</span>
                      ) : (
                        <span className="text-red-600 font-bold">❌ NON</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-red-600">Aucun rendez-vous trouvé</p>
              )}
            </div>
          </div>
        </div>
        {}
        <div className="bg-yellow-50 p-3 rounded border border-yellow-300">
          <p className="text-sm font-semibold text-yellow-900 mb-2">💡 DIAGNOSTIC:</p>
          {debugInfo?.userInfo?.userId && debugInfo?.allAppointments?.length > 0 ? (
            Array.from(new Set(debugInfo.allAppointments.map((a: any) => a.doctorId))).some((id: any) => id === debugInfo?.userInfo?.userId) ? (
              <p className="text-green-700 text-sm">
                ✅ Les IDs correspondent! Les rendez-vous devraient s'afficher.
                <br />
                <span className="text-xs">→ Recharge la page (F5)</span>
              </p>
            ) : (
              <div className="text-red-700 text-sm space-y-2">
                <p>❌ PROBLÈME TROUVÉ: Les doctorIds ne correspondent PAS!</p>
                <p className="font-semibold">Solution:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>Crée VES rendez-vous avec ce doctorId: <code className="bg-white px-1">{debugInfo?.userInfo?.userId}</code></li>
                  <li>OU modifie les doctorIds existants dans Firebase Console</li>
                </ul>
              </div>
            )
          ) : (
            <p className="text-gray-700 text-sm">Chargement du diagnostic...</p>
          )}
        </div>
      </div>
      {}
      <div className="bg-yellow-50 p-4 rounded-lg mt-6 border border-yellow-200">
        <h3 className="font-semibold text-yellow-900 mb-2">✨ Comment corriger:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-900">
          <li>Regarde le diagnostic ci-dessus</li>
          <li>Si les IDs ne correspondent pas: crée des rendez-vous avec le BON doctorId</li>
          <li>OU modifie les rendez-vous existants dans Firebase Console</li>
        </ol>
      </div>
    </div>
  );
};
export default AppointmentDebug;
