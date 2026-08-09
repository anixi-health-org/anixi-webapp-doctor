import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePatientSharingRequests } from '../hooks/usePatientSharingRequests';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { APPROVED_SHARES_SUBCOLLECTION } from '../shared/firestorePaths';
import { useEffect, useState } from 'react';

interface ApprovedShare {
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
}

export const MyDoctors: React.FC = () => {
  const { user } = useAuth();
  const { requests, isLoading, error } = usePatientSharingRequests(user?.id);
  const [approved, setApproved] = useState<ApprovedShare[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(true);

  useEffect(() => {
    const loadApproved = async () => {
      if (!user?.id) {
        setApprovedLoading(false);
        return;
      }
      try {
        const ref = collection(db, USERS_COLLECTION, user.id, APPROVED_SHARES_SUBCOLLECTION);
        const snap = await getDocs(ref);
        setApproved(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              doctorId: d.id,
              doctorName: String(data.doctorName ?? 'Doctor'),
              doctorSpecialty: data.doctorSpecialty as string | undefined,
            };
          })
        );
      } finally {
        setApprovedLoading(false);
      }
    };
    void loadApproved();
  }, [user?.id]);

  const pending = requests.filter((r) => r.status === 'pending');
  const revoked = requests.filter((r) => r.status === 'revoked');

  return (
    <div className="min-h-screen bg-anixi-beige">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0E2340]">My Doctors</h1>
            <p className="text-[#72829B] mt-1">Pending and approved doctor connections</p>
          </div>
          <Link
            to="/find-doctor"
            className="inline-flex justify-center rounded-xl bg-anixi-green text-white px-5 py-3 text-sm font-semibold"
          >
            Find a Doctor
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error.message}
          </div>
        )}

        <section className="rounded-2xl border border-[#E4EAF2] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#0E2340] mb-4">Approved</h2>
          {approvedLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : approved.length === 0 ? (
            <p className="text-sm text-gray-500">No approved doctors yet.</p>
          ) : (
            <ul className="space-y-3">
              {approved.map((a) => (
                <li
                  key={a.doctorId}
                  className="flex items-center justify-between p-4 border border-[#E4EAF2] rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{a.doctorName}</p>
                    {a.doctorSpecialty && (
                      <p className="text-sm text-[#72829B]">{a.doctorSpecialty}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                    Active
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#E4EAF2] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#0E2340] mb-4">Pending Requests</h2>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-500">No pending requests.</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="p-4 border border-[#E4EAF2] rounded-lg flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">{r.doctorName}</p>
                    {r.doctorSpecialty && (
                      <p className="text-sm text-[#72829B]">{r.doctorSpecialty}</p>
                    )}
                    {r.doctorCity && (
                      <p className="text-xs text-[#72829B]">{r.doctorCity}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {revoked.length > 0 && (
          <section className="rounded-2xl border border-[#E4EAF2] bg-white p-6">
            <h2 className="text-lg font-semibold text-[#0E2340] mb-4">Declined</h2>
            <ul className="space-y-2">
              {revoked.map((r) => (
                <li key={r.id} className="text-sm text-gray-600">
                  {r.doctorName} - declined
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

export default MyDoctors;
