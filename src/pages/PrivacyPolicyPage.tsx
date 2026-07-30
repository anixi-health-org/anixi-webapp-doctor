import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => (
  <div className="min-h-screen bg-anixi-beige px-4 py-10">
    <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-anixi-green">Privacy Notice</h1>
      <p className="mt-2 text-sm text-gray-500">Anixi Doctor Portal · POPIA baseline</p>

      <div className="prose prose-sm mt-8 max-w-none text-gray-700">
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Data controller</h2>
          <p className="mt-2">
            Anixi Health (Pty) Ltd operates the Anixi Doctor Portal. For privacy enquiries contact{' '}
            <a href="mailto:privacy@anixi.health" className="text-anixi-green underline">
              privacy@anixi.health
            </a>
            .
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">What we process</h2>
          <p className="mt-2">
            Account details, professional profile, practice settings, appointment and scheduling data,
            clinical notes and documents you create, invoices, and audit logs of portal activity.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Purposes</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Providing telehealth, scheduling, and practice management services</li>
            <li>Billing and invoicing where you use those features</li>
            <li>Security, fraud prevention, and service improvement</li>
            <li>Compliance with applicable health-sector and tax record-keeping obligations</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Retention</h2>
          <p className="mt-2">
            Clinical records, invoices, and appointment history linked to patient care may be retained
            for periods required by law or professional regulation, even after account closure. Account
            profile data is deleted or anonymised when you request account deletion, subject to lawful
            retention limits.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Your rights (POPIA)</h2>
          <p className="mt-2">
            You may request access to, correction of, or deletion of personal information we hold about
            you, subject to legal exceptions. To exercise these rights, email{' '}
            <a href="mailto:privacy@anixi.health" className="text-anixi-green underline">
              privacy@anixi.health
            </a>
            . You may lodge a complaint with the Information Regulator (South Africa).
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          <p className="mt-2">
            We use industry-standard authentication and encrypted transport. You are responsible for
            safeguarding your login credentials and ensuring telemedicine consent is obtained before
            virtual consultations, in line with HPCSA guidance.
          </p>
        </section>
      </div>

      <div className="mt-8 border-t border-gray-200 pt-6">
        <Link to="/login" className="text-sm font-medium text-anixi-green hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  </div>
);

export default PrivacyPolicyPage;
