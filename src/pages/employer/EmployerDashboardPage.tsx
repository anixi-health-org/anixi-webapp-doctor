import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import {
  addEmployeeEnrollment,
  createEmployerOrg,
  getEmployerDashboardStats,
  getEmployerForUser,
  listEmployerEnrollments,
} from '../../services/employerService';
import type { EmployeeEnrollment, EmployerOrg } from '../../types';

export const EmployerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [employer, setEmployer] = useState<EmployerOrg | null>(null);
  const [enrollments, setEnrollments] = useState<EmployeeEnrollment[]>([]);
  const [stats, setStats] = useState({ enrolled: 0, active: 0, invited: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const org = await getEmployerForUser(user.id);
      setEmployer(org);
      if (org) {
        const [rows, dash] = await Promise.all([
          listEmployerEnrollments(org.id),
          getEmployerDashboardStats(org.id),
        ]);
        setEnrollments(rows);
        setStats(dash);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateOrg = async () => {
    if (!user?.id || !orgName.trim()) return;
    setCreating(true);
    try {
      await createEmployerOrg(user.id, { name: orgName.trim() });
      await load();
    } finally {
      setCreating(false);
    }
  };

  const onAddEmployee = async () => {
    if (!employer || !employeeEmail.trim()) return;
    setAdding(true);
    try {
      await addEmployeeEnrollment(employer.id, employeeEmail, employeeName);
      setEmployeeEmail('');
      setEmployeeName('');
      await load();
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <PageShell className="py-8">
        <p className="text-sm text-[#65758b]">Loading employer portal…</p>
      </PageShell>
    );
  }

  if (!employer) {
    return (
      <PageShell maxWidth="default" className="py-8">
        <PageHeader
          title="Employer wellness portal"
          description="Set up your organisation to track employee health programme enrolments on Anixi."
        />
        <div className="mt-8 rounded-2xl border border-[#e1e7ef] bg-white p-6">
          <label className="block text-sm font-medium text-[#344256]">Organisation name</label>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#e1e7ef] px-3 py-2 text-sm"
            placeholder="e.g. Acme Holdings"
          />
          <button
            type="button"
            disabled={creating || !orgName.trim()}
            onClick={() => void onCreateOrg()}
            className="mt-4 rounded-full bg-[#1a4d4d] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create employer account'}
          </button>
          <p className="mt-4 text-xs text-[#65758b]">
            Already have a clinic account?{' '}
            <Link to="/clinic" className="font-semibold text-[#1a4d4d]">
              Go to clinic admin
            </Link>
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="wide" className="py-8">
      <PageHeader
        title={employer.name}
        description="Employee wellness enrolments and programme overview."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Enrolled', value: stats.enrolled },
          { label: 'Active on Anixi', value: stats.active },
          { label: 'Invited', value: stats.invited },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-[#1a4d4d]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-[#e1e7ef] bg-white p-6">
        <h2 className="text-sm font-semibold text-[#1a4d4d]">Add employee</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            value={employeeEmail}
            onChange={(e) => setEmployeeEmail(e.target.value)}
            placeholder="Employee email"
            className="rounded-xl border border-[#e1e7ef] px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="Name (optional)"
            className="rounded-xl border border-[#e1e7ef] px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={adding || !employeeEmail.trim()}
          onClick={() => void onAddEmployee()}
          className="mt-4 rounded-full bg-[#1a4d4d] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {adding ? 'Adding…' : 'Add to programme'}
        </button>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f6]">
            {enrollments.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{row.displayName || '-'}</td>
                <td className="px-4 py-3">{row.email}</td>
                <td className="px-4 py-3 capitalize">{row.status}</td>
              </tr>
            ))}
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[#65758b]">
                  No employees enrolled yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Link
        to="/login"
        className="mt-6 inline-block text-sm font-medium text-[#65758b] hover:text-[#1a4d4d]"
      >
        ← Back to sign in
      </Link>
    </PageShell>
  );
};

export default EmployerDashboardPage;
